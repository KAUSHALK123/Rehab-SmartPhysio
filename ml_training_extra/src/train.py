"""
Training Pipeline for Wrist Movement Quality Classifier
Trains:
1. RandomForestClassifier predicting exercise quality ('correct', 'too_shallow', 'too_fast', 'jerky')
2. IsolationForest anomaly detector trained strictly on 'correct' windows

Split is strictly by SESSION to prevent data leakage between overlapping windows.
Outputs:
- models/wrist_coach_rf.joblib
- models/anomaly.joblib
- models/metrics.json
- models/confusion_matrix.png
- models/feature_importance.png
"""

import json
from pathlib import Path
from typing import Dict, Any
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

from .preprocess import extract_sliding_windows
from .anomaly import MovementAnomalyDetector

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
MODELS_DIR = BASE_DIR / "models"


def load_all_sessions(data_dir: Path) -> pd.DataFrame:
    """Loads all CSV files in raw data directory into a single DataFrame."""
    csv_files = list(data_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV session files found in {data_dir}. Run make_synthetic_data.py first.")

    dfs = []
    for f in csv_files:
        try:
            df = pd.read_csv(f)
            # Ensure session_id and is_simulated are set
            if "session_id" not in df.columns:
                df["session_id"] = f.stem
            if "is_simulated" not in df.columns:
                df["is_simulated"] = 1 if "SIMULATED" in f.name.upper() else 0
            dfs.append(df)
        except Exception as e:
            print(f"Warning: could not read {f}: {e}")

    if not dfs:
        raise ValueError("Failed to load any valid session data.")
    return pd.concat(dfs, ignore_index=True)


def train_models(data_dir: Path = DATA_DIR, models_dir: Path = MODELS_DIR) -> Dict[str, Any]:
    models_dir.mkdir(parents=True, exist_ok=True)
    full_df = load_all_sessions(data_dir)

    is_synthetic = bool((full_df["is_simulated"] == 1).all())
    data_source_label = "SIMULATED SYNTHETIC DATA" if is_synthetic else "REAL / MIXED SENSOR DATA"
    print(f"\n=======================================================")
    print(f"  TRAINING WRIST ML COACH ({data_source_label})")
    print(f"=======================================================\n")

    # Group by session_id to perform leakage-free session-level split
    unique_sessions = full_df["session_id"].unique()
    print(f"Total sessions found: {len(unique_sessions)} ({unique_sessions.tolist()})")

    # Reserve 1/3 of sessions for testing (at least 1 session)
    np.random.seed(42)
    shuffled_sessions = np.random.permutation(unique_sessions)
    test_count = max(1, len(shuffled_sessions) // 3)
    test_sessions = set(shuffled_sessions[:test_count])
    train_sessions = set(shuffled_sessions[test_count:])
    print(f"Train sessions: {train_sessions}")
    print(f"Test sessions:  {test_sessions}\n")

    train_df = full_df[full_df["session_id"].isin(train_sessions)].copy()
    test_df = full_df[full_df["session_id"].isin(test_sessions)].copy()

    print("Extracting sliding window features (2.0s window, 50% overlap)...")
    X_train, y_train, _ = extract_sliding_windows(train_df, window_sec=2.0, overlap=0.5, fs=50.0)
    X_test, y_test, _ = extract_sliding_windows(test_df, window_sec=2.0, overlap=0.5, fs=50.0)

    print(f"Extracted {len(X_train)} training windows, {len(X_test)} testing windows.")
    feature_names = list(X_train.columns)

    # 1. Train Random Forest Classifier
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    # Predictions & evaluation
    y_pred = rf.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True)
    classes = sorted(list(set(y_train.unique()).union(set(y_test.unique()))))
    cm = confusion_matrix(y_test, y_pred, labels=classes)

    print(f"\nModel Accuracy on Held-Out Test Sessions: {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # 2. Train Anomaly Detector strictly on 'correct' windows
    print("Fitting IsolationForest on 'correct' windows for anomaly detection...")
    correct_mask = (y_train == "correct")
    X_train_correct = X_train[correct_mask]
    if len(X_train_correct) == 0:
        X_train_correct = X_train  # Fallback

    anomaly_detector = MovementAnomalyDetector(model_path=models_dir / "anomaly.joblib")
    anomaly_detector.fit(X_train_correct, contamination=0.05)
    anomaly_detector.save()
    print("Saved anomaly detector to models/anomaly.joblib")

    # 3. Save Random Forest Model
    rf_payload = {
        "model": rf,
        "feature_names": feature_names,
        "classes": list(rf.classes_),
        "is_synthetic": is_synthetic,
    }
    rf_model_path = models_dir / "wrist_coach_rf.joblib"
    joblib.dump(rf_payload, rf_model_path)
    print(f"Saved primary classifier to {rf_model_path}")

    # 4. Save Metrics JSON
    metrics = {
        "accuracy": round(acc, 4),
        "data_source": data_source_label,
        "is_synthetic": is_synthetic,
        "classes": classes,
        "report": report,
        "confusion_matrix": cm.tolist(),
        "train_window_count": len(X_train),
        "test_window_count": len(X_test),
    }
    metrics_path = models_dir / "metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

    # 5. Plot Confusion Matrix
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    plt.title(f"Confusion Matrix ({'SIMULATED' if is_synthetic else 'REAL'})\nAcc: {acc*100:.1f}%")
    plt.colorbar()
    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes, rotation=35, ha="right")
    plt.yticks(tick_marks, classes)
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], "d"),
                     horizontalalignment="center",
                     color="white" if cm[i, j] > thresh else "black")
    plt.tight_layout()
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    cm_path = models_dir / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"Saved confusion matrix plot to {cm_path}")

    # 6. Plot Feature Importance
    importances = rf.feature_importances_
    indices = np.argsort(importances)[::-1][:15]
    top_features = [feature_names[i] for i in indices]
    top_importances = importances[indices]

    plt.figure(figsize=(8, 5))
    plt.title(f"Top 15 Feature Importances ({'SIMULATED' if is_synthetic else 'REAL'})")
    plt.barh(range(len(indices)), top_importances[::-1], align="center", color="#3b82f6")
    plt.yticks(range(len(indices)), top_features[::-1])
    plt.xlabel("Relative Importance")
    plt.tight_layout()
    fi_path = models_dir / "feature_importance.png"
    plt.savefig(fi_path, dpi=150)
    plt.close()
    print(f"Saved feature importance plot to {fi_path}")

    return metrics


if __name__ == "__main__":
    train_models()
