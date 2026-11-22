"""
Demo pipeline:
1. Generates synthetic dataset (labeled SIMULATED).
2. Trains RandomForest and IsolationForest models.
3. Tests inference on sample simulated windows for each class.
4. Demonstrates live quality assessment & fallback.
"""

import os
import sys
import json
import joblib

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from tools.make_synthetic_data import generate_dataset, generate_window
from tools.train import train_wrist_models
from src.features import extract_window_features

def run_demo():
    print("\n--- 1. Generating Synthetic Dataset (SIMULATED) ---")
    data_file = generate_dataset(num_sessions=24, windows_per_session=15)

    print("\n--- 2. Training Wrist ML Models ---")
    metrics = train_wrist_models(data_file)
    print(f"Test Accuracy: {metrics['accuracy'] * 100:.2f}%")

    print("\n--- 3. Running Live Inference Simulation ---")
    rf_model_path = os.path.join(parent_dir, "models", "wrist_rf.joblib")
    iso_model_path = os.path.join(parent_dir, "models", "wrist_anomaly.joblib")

    rf = joblib.load(rf_model_path)
    iso = joblib.load(iso_model_path)

    for true_label in ['correct', 'too_shallow', 'too_fast', 'jerky']:
        sample_window = generate_window(true_label)
        feats = extract_window_features(sample_window).reshape(1, -1)
        pred_label = rf.predict(feats)[0]
        probs = rf.predict_proba(feats)[0]
        conf = float(np.max(probs)) if 'np' in locals() else float(max(probs))
        anomaly_score = float(iso.decision_function(feats)[0])

        status = "✓ MATCH" if pred_label == true_label else "MISMATCH"
        print(f"Target: {true_label:<12} | Predicted: {pred_label:<12} | Conf: {conf*100:.1f}% | Anomaly Score: {anomaly_score:+.3f} [{status}]")

    print("\n[SUCCESS] Demo pipeline complete. Artifacts ready for backend inference endpoint.\n")

if __name__ == "__main__":
    run_demo()
