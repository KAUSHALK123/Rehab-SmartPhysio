"""
One-Command Verification & Demo Pipeline for Wrist ML Coach
Steps:
1. Generates realistic synthetic wrist IMU datasets (flexion/extension, radial/ulnar, pronation/supination)
2. Trains RandomForestClassifier with session-level split & IsolationForest anomaly detector
3. Prints evaluation metrics, confusion matrix, and feature importances
4. Runs live simulation stream through WristCoach to demonstrate real-time rep detection and debounced feedback.

Usage:
  python -m ml_training_extra.tools.demo_pipeline
"""

import sys
import time
from pathlib import Path

from .make_synthetic_data import generate_all_synthetic_data, generate_session
from ..src.train import train_models
from ..src.coach import WristCoach

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
MODELS_DIR = BASE_DIR / "models"


def run_pipeline():
    print("=" * 65)
    print("      SMARTPHYSIO WRIST ML COACH - ONE-COMMAND DEMO PIPELINE")
    print("=" * 65)

    # Step 1: Synthetic data generation
    print("\n[STEP 1/4] Generating synthetic training and test sessions...")
    csv_files = generate_all_synthetic_data(DATA_DIR, sessions_per_combo=3)
    print(f"-> Successfully created {len(csv_files)} synthetic session CSVs in {DATA_DIR}")

    # Step 2: Training
    print("\n[STEP 2/4] Training RandomForestClassifier and IsolationForest...")
    metrics = train_models(data_dir=DATA_DIR, models_dir=MODELS_DIR)

    # Step 3: Print metrics summary
    print("\n[STEP 3/4] Model Verification & Metrics Summary:")
    print(f"-> Accuracy: {metrics['accuracy'] * 100:.2f}%")
    print(f"-> Data Source: {metrics['data_source']}")
    print(f"-> Classes: {metrics['classes']}")
    print(f"-> Models saved in: {MODELS_DIR}")

    # Step 4: Run simulated live inference through WristCoach
    print("\n[STEP 4/4] Testing Live WristCoach Inference Loop (Simulated Stream)...")
    coach = WristCoach(exercise="flexion_extension", target_angle=40.0)

    # Generate a sample sequence of 'correct' then 'too_shallow' reps
    print("-> Streaming 10 seconds of simulated 50 Hz IMU telemetry...")
    test_stream = generate_session("flexion_extension", "correct", session_id="live_demo", num_reps=3, fs=50.0)

    feedback_frames = []
    last_print = 0.0

    for idx, row in test_stream.iterrows():
        frame = {
            "type": "imu",
            "src": "simulated",
            "seq": int(row["seq"]),
            "t": float(row["t"]),
            "ax": float(row["ax"]),
            "ay": float(row["ay"]),
            "az": float(row["az"]),
            "gx": float(row["gx"]),
            "gy": float(row["gy"]),
            "gz": float(row["gz"]),
            "pitch": float(row["pitch"]),
            "roll": float(row["roll"]),
        }
        res = coach.update(frame)
        feedback_frames.append(res)

        now = time.time()
        if now - last_print >= 0.8:
            last_print = now
            print(
                f"   [t={res['t']/1000.0:4.1f}s] Reps: {res['rep_count']:2d} | "
                f"Angle: {res['current_angle']:4.1f}° / {res['target']}° | "
                f"Quality: {res['quality']:11s} (conf: {res['confidence']:.2f}) | "
                f"Msg: \"{res['message']}\""
            )

    print("\n" + "=" * 65)
    print(" DEMO PIPELINE COMPLETED SUCCESSFULLY!")
    print(" You can now start the backend with ENABLE_ML_COACH=1 COACH_SIMULATE=1")
    print(" and view the CoachOverlay in the browser with ?coach=1")
    print("=" * 65)


if __name__ == "__main__":
    run_pipeline()
