# SmartPhysio Wrist AI Coach & Kinematics ML Module

This directory contains the machine learning training pipeline, feature extraction, dataset generators, and model artifacts for real-time wrist rehabilitation coaching.

---

## 1. Architecture Overview

```
Raw IMU Wrist Telemetry (MPU6050 Pitch/Roll)
                   │
                   ▼
       Sliding 2-Second Kinematics Window (approx. 40 samples at 20 Hz)
                   │
                   ├────────────────────────────────┐
                   ▼                                ▼
       Rule-Based Coaching Engine       FastAPI POST /coach/predict
     (Always Active, 700ms Debounce)      (RandomForest + IsolationForest)
                   │                                │
                   │◄───────────────────────────────┘ (Fallback to Rules if Offline)
                   ▼
    High-Contrast Yellow AI Coaching Overlay
        (Upper Canvas + Bottom Card Box)
```

---

## 2. Feature Extraction (`src/features.py`)

Each sliding 2-second window of wrist angles is transformed into 12 kinematics and frequency features:
1. **Range**: `max(angle) - min(angle)`
2. **Mean**: Average angle across the window
3. **Std**: Angular deviation
4. **Min**: Minimum angle reached
5. **Max**: Peak angle reached
6. **RMS**: Root mean square amplitude
7. **Peak Count**: Count of prominent local extrema (peaks and valleys)
8. **Dominant Frequency**: Primary spectral frequency via Fast Fourier Transform (FFT)
9. **Mean Absolute Jerk**: Mean magnitude of the third derivative of angle (smoothness indicator)
10. **Zero Crossings**: Count of mean-centered directional transitions
11. **Velocity Mean**: Average angular velocity magnitude
12. **Velocity Std**: Standard deviation of angular velocity

---

## 3. Model Training & Validation (`tools/train.py`)

- **Classification Model**: `RandomForestClassifier` (100 estimators, balanced class weights).
- **Classes**:
  - `correct`: Smooth, full-range movement with physiological cadence (~0.5 Hz).
  - `too_shallow`: Low range of motion failing to meet rehabilitation target.
  - `too_fast`: Abrupt, high-cadence motion violating speed safety thresholds.
  - `jerky`: High-jerk trajectory with tremors, hesitations, or erratic stops.
- **Data Leakage Prevention**: Split using `GroupShuffleSplit` by `session_id` so windows from the same session never appear in both train and test sets.
- **Anomaly Detection**: `IsolationForest` trained exclusively on `correct` windows to compute smoothness and movement abnormality scores.

### Model Evaluation Results (from `tools/train.py` on Synthetic Data):
> **Note on Data Source:** The initial metrics below are computed on realistically modeled synthetic data labeled **`SIMULATED`** to validate the training pipeline and feature extraction before clinical data collection.

```json
{
  "dataset_source": "SIMULATED",
  "total_samples": 360,
  "train_samples": 270,
  "test_samples": 90,
  "accuracy": 1.0,
  "classification_report": {
    "correct": { "precision": 1.0, "recall": 1.0, "f1-score": 1.0 },
    "too_shallow": { "precision": 1.0, "recall": 1.0, "f1-score": 1.0 },
    "too_fast": { "precision": 1.0, "recall": 1.0, "f1-score": 1.0 },
    "jerky": { "precision": 1.0, "recall": 1.0, "f1-score": 1.0 }
  }
}
```

---

## 4. End-to-End Demo Pipeline

To run the complete synthetic dataset generation, training, and simulation:

```bash
python ml_training_extra/tools/demo_pipeline.py
```

Outputs generated:
- `models/wrist_rf.joblib`: Trained Random Forest classifier.
- `models/wrist_anomaly.joblib`: Trained Isolation Forest anomaly model.
- `models/metrics.json`: Detailed classification metrics and feature importances.
- `models/confusion_matrix.png`: Confusion matrix plot.

---

## 5. Backend Inference API

Endpoint: `POST /coach/predict`
Request payload:
```json
{
  "samples": [
    { "time": 0.0, "angle": 0.0 },
    { "time": 0.05, "angle": 5.2 },
    { "time": 0.10, "angle": 12.4 }
  ],
  "exercise_name": "Wrist Motion Test",
  "is_simulated": false
}
```

Response payload:
```json
{
  "quality": "correct",
  "confidence": 0.96,
  "anomaly": 0.015,
  "badge": "AI: ML MODEL"
}
```

**Graceful Fallback**: If the model file is absent or the endpoint is unreachable, the API returns `"badge": "AI: RULES ONLY"`. The frontend overlay automatically falls back to deterministic rule-based guidance with zero page interruptions or GLB freezing.

---

## 6. Manual Testing Checklist

| Step | Action | Expected Result |
|:---:|:---|:---|
| **1** | Open **Wrist Motion Test** in browser | The yellow AI suggestion text appears both in the upper 3D canvas and replacing the static text in the bottom card box. |
| **2** | Move wrist to 20° (target 45°) | Overlay displays **"Bend 25 deg more to the RIGHT"** in bold yellow text with high contrast. |
| **3** | Reach within ±5° of target (42°–48°) | Overlay transitions smoothly to **"Hold it! {t}s"** with active hold countdown. |
| **4** | Move past target (>50°) | Overlay displays **"Ease back {n} deg - too far"**. |
| **5** | Move in wrong direction (opposite sign) | Overlay displays **"Wrong way - move {DIR}"**. |
| **6** | Move wrist with extreme speed (>120°/s) | Overlay alerts **"Slow down"**. |
| **7** | Rest phase | Overlay displays **"Relax and rest {n}s"** or prompts **"Move your wrist to start"**. |
| **8** | Complete all prescribed reps (e.g. 5/5) | Rep counter caps at target (5/5) and overlay shows **"Great job! Set complete"**. |
| **9** | Stop FastAPI backend server | Badge switches seamlessly to **"AI: RULES ONLY"**; coaching and GLB hand continue moving smoothly without errors. |
| **10** | Dev recording toggle (`?dev=1` in URL) | A floating toolbar allows selecting quality label (`correct`, `too_shallow`, etc.) and recording labeled windows. |
| **11** | Switch to Finger or Elbow exercises | Wrist AI coach stays inactive; other exercises behave as before. |
