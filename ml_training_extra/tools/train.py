"""
Training pipeline for Wrist Quality Random Forest & Anomaly Isolation Forest.
Uses GroupShuffleSplit by session_id to guarantee zero data leakage between train/test.
Saves models, metrics, feature importances, and confusion matrix plot.
"""

import os
import sys
import json
import joblib
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

# Ensure src is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from src.features import extract_window_features, FEATURE_NAMES

def load_data(data_path):
    with open(data_path, "r") as f:
        records = json.load(f)
    
    X = []
    y = []
    groups = []
    sources = []

    for item in records:
        feats = extract_window_features(item["samples"])
        X.append(feats)
        y.append(item["label"])
        groups.append(item.get("session_id", "default_session"))
        sources.append(item.get("source", "SIMULATED"))

    return np.array(X), np.array(y), np.array(groups), list(set(sources))

def train_wrist_models(data_path=None, output_models_dir=None):
    if data_path is None:
        data_path = os.path.join(parent_dir, "data", "synthetic_dataset.json")
    if output_models_dir is None:
        output_models_dir = os.path.join(parent_dir, "models")
    
    os.makedirs(output_models_dir, exist_ok=True)

    if not os.path.exists(data_path):
        from tools.make_synthetic_data import generate_dataset
        generate_dataset(output_dir=os.path.dirname(data_path))

    X, y, groups, sources = load_data(data_path)
    is_synthetic = "SIMULATED" in sources

    # GroupShuffleSplit by session_id to avoid session data leakage
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    # 1. Train Random Forest Quality Classifier
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=4,
        random_state=42,
        class_weight='balanced'
    )
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    classes = list(rf.classes_)
    cm = confusion_matrix(y_test, y_pred, labels=classes)

    # Feature importances
    importances = {name: float(val) for name, val in zip(FEATURE_NAMES, rf.feature_importances_)}
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # 2. Train Isolation Forest Anomaly Detector on "correct" windows only
    correct_mask = (y_train == 'correct')
    if np.sum(correct_mask) >= 5:
        iso_forest = IsolationForest(contamination=0.08, random_state=42)
        iso_forest.fit(X_train[correct_mask])
    else:
        iso_forest = IsolationForest(contamination=0.08, random_state=42)
        iso_forest.fit(X_train)

    # 3. Save artifacts
    rf_path = os.path.join(output_models_dir, "wrist_rf.joblib")
    iso_path = os.path.join(output_models_dir, "wrist_anomaly.joblib")
    metrics_path = os.path.join(output_models_dir, "metrics.json")
    cm_path = os.path.join(output_models_dir, "confusion_matrix.png")

    joblib.dump(rf, rf_path)
    joblib.dump(iso_forest, iso_path)

    metrics_payload = {
        "dataset_source": "SIMULATED" if is_synthetic else "REAL_DEVICE",
        "total_samples": len(X),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": accuracy,
        "classification_report": report,
        "feature_importances": sorted_importances,
        "classes": classes
    }

    with open(metrics_path, "w") as f:
        json.dump(metrics_payload, f, indent=2)

    # Plot Confusion Matrix
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title(f"Wrist Quality Confusion Matrix ({'SIMULATED' if is_synthetic else 'REAL'})")
    plt.colorbar()
    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes, rotation=45)
    plt.yticks(tick_marks, classes)
    
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     horizontalalignment="center",
                     color="white" if cm[i, j] > thresh else "black")

    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig(cm_path, dpi=120)
    plt.close()

    print(f"\n{'='*55}")
    print(f"WRIST MODEL TRAINING COMPLETE [{'SIMULATED' if is_synthetic else 'REAL'}]")
    print(f"Accuracy: {accuracy * 100:.2f}%")
    print(f"Models saved: {rf_path}, {iso_path}")
    print(f"Metrics saved: {metrics_path}")
    print(f"Confusion Matrix: {cm_path}")
    print(f"{'='*55}\n")

    return metrics_payload

if __name__ == "__main__":
    train_wrist_models()
