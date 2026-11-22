"""
Wrist Movement ML Coach
Maintains rolling IMU buffer, detects reps, runs quality classifier and anomaly detector,
and applies debounced clinical feedback rules.
Falls back safely to rule-based analysis if models are not loaded.
"""

import time
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np
import pandas as pd

from .rep_detector import RepDetector, load_exercise_config
from .preprocess import extract_window_features
from .anomaly import MovementAnomalyDetector

DEFAULT_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
DEFAULT_RF_PATH = DEFAULT_MODELS_DIR / "wrist_coach_rf.joblib"
DEFAULT_ANOMALY_PATH = DEFAULT_MODELS_DIR / "anomaly.joblib"


class WristCoach:
    def __init__(
        self,
        exercise: str = "flexion_extension",
        target_angle: Optional[float] = None,
        rf_model_path: Optional[Path] = None,
        anomaly_model_path: Optional[Path] = None,
    ):
        self.config = load_exercise_config()
        self.exercise = exercise
        self.rf_model_path = rf_model_path or DEFAULT_RF_PATH
        self.anomaly_model_path = anomaly_model_path or DEFAULT_ANOMALY_PATH

        self.rep_detector = RepDetector(exercise=exercise, config=self.config)
        if target_angle is not None:
            self.rep_detector.target_angle = float(target_angle)

        # Rolling buffer of 50 Hz samples (up to 3 seconds = 150 samples)
        self.buffer_size = 150
        self.samples: list[dict] = []

        # Debounce message state
        self.current_message = "Ready when you are"
        self.current_severity = "info"
        self.last_message_time = 0.0
        self.debounce_ms = 700
        self.last_activity_time = time.time()
        self.last_rep_number_seen = 0

        # Load ML models
        self.ml_loaded = False
        self.rf_classifier = None
        self.rf_feature_names = None
        self.rf_classes = None
        self.is_synthetic_model = False
        self.anomaly_detector = MovementAnomalyDetector(self.anomaly_model_path)

        self._load_models()

    def _load_models(self):
        """Attempts to load pre-trained models. If missing, runs in rule-based fallback mode."""
        try:
            if self.rf_model_path.exists():
                payload = joblib.load(self.rf_model_path)
                self.rf_classifier = payload.get("model")
                self.rf_feature_names = payload.get("feature_names")
                self.rf_classes = payload.get("classes")
                self.is_synthetic_model = payload.get("is_synthetic", False)
                self.ml_loaded = self.rf_classifier is not None
        except Exception as e:
            print(f"[WristCoach] Note: Could not load RF model ({e}). Using rule-based fallback.")
            self.ml_loaded = False

    def set_config(self, exercise: Optional[str] = None, target: Optional[float] = None):
        """Allows runtime reconfiguration of exercise type and target angle."""
        if exercise and exercise in self.config.get("exercises", {}):
            self.exercise = exercise
            self.rep_detector.set_exercise(exercise)
        if target is not None and target > 0:
            self.rep_detector.target_angle = float(target)

    def reset(self):
        """Resets rep counts, message state, and rolling buffers."""
        self.samples.clear()
        self.rep_detector.reset()
        self.current_message = "Ready when you are"
        self.current_severity = "info"
        self.last_message_time = 0.0
        self.last_activity_time = time.time()
        self.last_rep_number_seen = 0

    def _update_message(self, new_msg: str, new_severity: str, force: bool = False):
        """Debounces user message updates to prevent visual flickering."""
        now = time.time()
        elapsed_ms = (now - self.last_message_time) * 1000.0
        if force or elapsed_ms >= self.debounce_ms or new_severity == "warn":
            self.current_message = new_msg
            self.current_severity = new_severity
            self.last_message_time = now

    def update(self, imu_frame: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests a 50 Hz IMU telemetry frame:
        imu_frame = {
            "type": "imu",
            "src": "esp32" | "simulated",
            "seq": int,
            "t": timestamp_ms or float,
            "ax": float, "ay": float, "az": float,
            "gx": float, "gy": float, "gz": float,
            "pitch": float, "roll": float
        }
        Returns feedback frame. Never throws unhandled exceptions.
        """
        try:
            # Safe extraction with defaults
            t_ms = float(imu_frame.get("t", time.time() * 1000.0))
            t_sec = t_ms / 1000.0
            pitch = float(imu_frame.get("pitch", 0.0))
            roll = float(imu_frame.get("roll", 0.0))
            ax = float(imu_frame.get("ax", 0.0))
            ay = float(imu_frame.get("ay", 0.0))
            az = float(imu_frame.get("az", 1.0))
            gx = float(imu_frame.get("gx", 0.0))
            gy = float(imu_frame.get("gy", 0.0))
            gz = float(imu_frame.get("gz", 0.0))
            src = str(imu_frame.get("src", "esp32"))

            primary_axis = self.rep_detector.primary_axis
            current_angle = pitch if primary_axis == "pitch" else roll
            target_angle = self.rep_detector.target_angle
            tolerance = self.rep_detector.tolerance

            # Append to rolling buffer
            sample = {
                "t": t_sec,
                "pitch": pitch,
                "roll": roll,
                "ax": ax, "ay": ay, "az": az,
                "gx": gx, "gy": gy, "gz": gz,
            }
            self.samples.append(sample)
            if len(self.samples) > self.buffer_size:
                self.samples.pop(0)

            # Online rep detection
            completed_rep = self.rep_detector.feed_sample(t_sec, current_angle)

            # Detect activity / idle
            angular_velocity = abs(gy) if primary_axis == "pitch" else abs(gx)
            if angular_velocity > 8.0 or abs(current_angle) > 6.0:
                self.last_activity_time = time.time()

            now = time.time()
            is_idle = (now - self.last_activity_time) >= 5.0

            # Quality classification & anomaly detection
            quality = "correct"
            confidence = 1.0
            is_anomaly = False
            anomaly_score = 0.0
            mode = "ml_active" if self.ml_loaded else "rule_based_only"

            # Extract features if buffer has enough samples (at least 1s = 50 samples)
            features = {}
            if len(self.samples) >= 50:
                features = extract_window_features(
                    pd.DataFrame(self.samples), fs=50.0, apply_filter=False
                )

            if self.ml_loaded and features and self.rf_feature_names:
                try:
                    df_feats = pd.DataFrame([{k: features.get(k, 0.0) for k in self.rf_feature_names}])
                    probs = self.rf_classifier.predict_proba(df_feats)[0]
                    pred_idx = int(np.argmax(probs))
                    quality = str(self.rf_classifier.classes_[pred_idx])
                    confidence = round(float(probs[pred_idx]), 2)

                    # Anomaly check
                    is_anomaly, anomaly_score = self.anomaly_detector.predict_anomaly(features)
                    if is_anomaly and quality == "correct":
                        quality = "jerky"
                except Exception:
                    mode = "rule_based_only"

            # Rule-based fallback if ML not loaded or for rule verification
            if mode == "rule_based_only":
                last_rep = self.rep_detector.last_rep_stats
                if last_rep:
                    pk = last_rep["peak_angle"]
                    dur = last_rep["duration"]
                    if dur < 0.9:
                        quality = "too_fast"
                    elif pk < (target_angle - tolerance):
                        quality = "too_shallow"
                    elif features.get("jerk", 0.0) > 40.0:
                        quality = "jerky"
                    else:
                        quality = "correct"
                else:
                    quality = "correct"
                confidence = 0.85

            # Clinical feedback message rules
            # New rep completed event
            new_rep_event = completed_rep is not None
            peak_last_rep = self.rep_detector.last_rep_stats["peak_angle"] if self.rep_detector.last_rep_stats else 0.0

            if is_idle:
                self._update_message("Ready when you are", "info")
            elif new_rep_event:
                # Rep just finished: give specific clinical coaching
                delta = max(0.0, target_angle - peak_last_rep)
                if quality == "too_shallow":
                    self._update_message(f"Bend {delta:.0f}° more", "warn", force=True)
                elif quality == "too_fast":
                    self._update_message("Slow down your movement", "warn", force=True)
                elif quality == "jerky" or is_anomaly:
                    self._update_message("Keep the movement smooth", "warn", force=True)
                else:
                    self._update_message("Good rep! Maintain that form", "ok", force=True)
            else:
                # In-between reps / holding position
                if abs(current_angle) >= (target_angle - tolerance * 0.5):
                    self._update_message("Hold it there", "ok")
                elif quality == "jerky" or is_anomaly:
                    self._update_message("Keep the movement smooth", "warn")
                elif quality == "too_fast":
                    self._update_message("Slow down", "info")

            return {
                "type": "coach",
                "exercise": self.exercise,
                "rep_count": self.rep_detector.rep_count,
                "current_angle": round(float(current_angle), 1),
                "peak_angle_last_rep": round(float(peak_last_rep), 1),
                "target": round(float(target_angle), 1),
                "tolerance": round(float(tolerance), 1),
                "quality": quality,
                "confidence": confidence,
                "anomaly": is_anomaly,
                "anomaly_score": anomaly_score,
                "message": self.current_message + ("" if self.ml_loaded else " (Rule-based)"),
                "severity": self.current_severity,
                "mode": mode,
                "is_synthetic_model": self.is_synthetic_model,
                "src": src,
                "t": t_ms,
            }

        except Exception as e:
            # Safe failover
            return {
                "type": "coach",
                "exercise": self.exercise,
                "rep_count": 0,
                "current_angle": 0.0,
                "peak_angle_last_rep": 0.0,
                "target": 40.0,
                "tolerance": 8.0,
                "quality": "unknown",
                "confidence": 0.0,
                "anomaly": False,
                "message": f"Coach unavailable: {str(e)[:30]}",
                "severity": "warn",
                "mode": "rule_based_only",
                "src": "error",
                "t": time.time() * 1000.0,
            }
