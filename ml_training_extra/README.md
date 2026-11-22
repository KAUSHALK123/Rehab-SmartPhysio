# SmartPhysio Wrist Movement ML Coach

An intelligent, non-invasive wrist rehabilitation coach that tracks wrist movements (flexion/extension, radial/ulnar deviation, pronation/supination), counts exercise repetitions, evaluates movement quality with machine learning (Random Forest + Isolation Forest anomaly detection), and delivers real-time clinical feedback.

---

## 1. System Architecture

```
                 +-----------------------------------------------+
                 |             ESP32 Glove Firmware              |
                 |  - MPU6050 (SDA:21, SCL:22, I2C 0x68)         |
                 |  - 50 Hz Complementary Filter (alpha 0.98)    |
                 |  - 'z' Zero-Pose Calibration (Preferences)    |
                 +-----------------------+-----------------------+
                                         | JSON frame: {"type":"imu", ...} (50 Hz)
                                         v
                 +-----------------------------------------------+
                 |             FastAPI Backend                   |
                 |             (ws_device.py)                    |
                 |                                               |
                 |  Feature Flag: ENABLE_ML_COACH=1              |
                 |  Simulation:   COACH_SIMULATE=1               |
                 |                                               |
                 |  +-----------------------------------------+  |
                 |  |       WristCoach Pipeline (10 Hz)       |  |
                 |  | - Rolling Buffer (2-3s @ 50 Hz)         |  |
                 |  | - RepDetector (find_peaks + hysteresis) |  |
                 |  | - Preprocessing (sliding window feats)  |  |
                 |  | - RandomForestClassifier (Quality)      |  |
                 |  | - IsolationForest (Anomaly/Jerk)        |  |
                 |  | - Debounced Feedback Rules              |  |
                 |  +--------------------+--------------------+  |
                 +-----------------------|-----------------------+
                                         | Broadcast: {"type":"coach", ...} (10 Hz)
                                         v
                 +-----------------------------------------------+
                 |           React / Three.js Frontend           |
                 |  - LiveExercisePage.jsx (?coach=1)            |
                 |  - CoachOverlay.jsx (Side/Bottom HUD)         |
                 |  - GLB 3D Hand Canvas (Unchanged)             |
                 +-----------------------------------------------+
```

---

## 2. Feature Summary

1. **Repetition Counter (`RepDetector`)**:
   - Detects completed repetitions using peak detection with hysteresis on primary axis angle (pitch or roll).
   - Extracts peak angle, starting valley, ROM (range of motion), duration, and peak angular velocity.
2. **Quality Classifier (`RandomForestClassifier`)**:
   - Classifies movement into:
     - `correct`: smooth movement reaching target range of motion at safe cadence.
     - `too_shallow`: incomplete range of motion (insufficient bend).
     - `too_fast`: rep completed faster than clinically recommended.
     - `jerky`: high tremor, jitter, or irregular acceleration profile.
3. **Anomaly & Jerk Detection (`MovementAnomalyDetector`)**:
   - Fits an `IsolationForest` on feature windows strictly from `correct` reps.
   - Detects abnormal compensatory movement patterns and elevated jerk values.
4. **Clinical Feedback & Debouncing**:
   - Debounces visual feedback (minimum 700 ms) to avoid visual flicker.
   - Direct actionable cues: *"Bend 12° more"*, *"Slow down"*, *"Keep the movement smooth"*, *"Good rep! Maintain that form"*.
5. **Fail-Safe Operation**:
   - If trained models are absent, `WristCoach` falls back to rule-based kinematic estimation and rep counting.
   - Any sensor or ML error gracefully displays `"Coach unavailable"` without interrupting finger tracking or 3D GLB rendering.

---

## 3. How to Run the Simulated Demo (No Hardware Needed)

You can verify the entire data generation, training, and real-time inference loop in one command:

```bash
# From repository root:
python -m ml_training_extra.tools.demo_pipeline
```

To run the full application with the backend streaming simulated IMU data:

1. **Start the backend in simulation mode:**
   ```bash
   cd backend
   # In PowerShell / Windows:
   $env:ENABLE_ML_COACH="1"
   $env:COACH_SIMULATE="1"
   ..\backend\venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Open the frontend with coach enabled:**
   Navigate in your browser to:
   ```
   http://localhost:5173/exercise?coach=1
   ```
   The `CoachOverlay` will appear showing real-time rep counts, angle progress bar, quality classifications, and the visible **SIMULATED** badge.

---

## 4. How to Record Real Data from Hardware

1. Flash the firmware (`firmware/sleeve_firmware.ino`) to your ESP32.
2. Start the backend with `ENABLE_ML_COACH=1` and ensure the ESP32 is connected via Wi-Fi.
3. Run the session recorder CLI:

```bash
# Record 25 seconds of flexion/extension labeled as 'correct':
python -m ml_training_extra.tools.record_session --exercise flexion_extension --label correct --duration 25

# Record 20 seconds of radial/ulnar deviation labeled as 'too_shallow':
python -m ml_training_extra.tools.record_session --exercise radial_ulnar --label too_shallow --duration 20
```

The CLI displays a 3-second countdown and saves raw CSV files to `ml_training_extra/data/raw/RECORDED_<exercise>_<label>_<timestamp>.csv`.

---

## 5. How to Train or Retrain Models

Once you have recorded CSV sessions:

```bash
python -m ml_training_extra.src.train
```

This will:
- Partition sessions cleanly (split by session ID, never by random windows, avoiding data leakage).
- Extract 2.0-second sliding windows with 50% overlap.
- Train `RandomForestClassifier` and `IsolationForest`.
- Generate and save:
  - `models/wrist_coach_rf.joblib`
  - `models/anomaly.joblib`
  - `models/metrics.json`
  - `models/confusion_matrix.png`
  - `models/feature_importance.png`
- Print classification report and accuracy metrics.

---

## 6. How to Run Unit Tests

```bash
python -m pytest ml_training_extra/tests/test_coach.py -o norecursedirs="node_modules backend" -v
```

Verifies:
- Feature extraction and sliding window math.
- Rep detector accuracy on synthetic waveforms.
- Clinical feedback debouncing rules.
- Model-free graceful fallback mode.

---

## 7. Assumptions & Limitations

> [!IMPORTANT]
> **Educational & Rehabilitation Prototype Notice**:
> 1. **Orientation vs. True Joint Angle**: A single 6-axis IMU mounted on the back of the hand measures orientation relative to gravity and angular rate. It approximates wrist flexion/extension and forearm rotation, but does not measure true joint angle independently of forearm posture.
> 2. **Yaw Drift**: Without a magnetometer, yaw is subject to integration drift. Therefore, only **pitch** and **roll** are utilized.
> 3. **Synthetic Baseline**: Initial models and metrics are trained on kinematically realistic simulated data (tagged `SIMULATED`). Clinical deployment requires retraining on a diverse human participant cohort.
> 4. **Safety & Medical Scope**: This software is an engineering demo and decision-support feedback prototype, not a certified medical device.
