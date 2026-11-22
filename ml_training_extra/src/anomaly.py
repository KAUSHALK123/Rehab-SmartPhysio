"""
Movement Anomaly Detector
Fits an IsolationForest on feature windows from 'correct' exercise reps only.
At inference, outputs:
- is_anomaly (bool): True if movement is atypical, jerky, or compensated
- anomaly_score (float): normalized score where higher values mean more anomalous
"""

from pathlib import Path
from typing import Optional, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

DEFAULT_ANOMALY_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "anomaly.joblib"


class MovementAnomalyDetector:
    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or DEFAULT_ANOMALY_MODEL_PATH
        self.model: Optional[IsolationForest] = None
        self.feature_names: Optional[list] = None
        self.load()

    def fit(self, X_correct: pd.DataFrame, contamination: float = 0.05) -> "MovementAnomalyDetector":
        """Fits IsolationForest strictly on feature windows from 'correct' reps."""
        self.feature_names = list(X_correct.columns)
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_correct)
        return self

    def save(self, output_path: Optional[Path] = None):
        target = output_path or self.model_path
        target.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "feature_names": self.feature_names}, target)

    def load(self) -> bool:
        if self.model_path.exists():
            try:
                data = joblib.load(self.model_path)
                if isinstance(data, dict):
                    self.model = data.get("model")
                    self.feature_names = data.get("feature_names")
                else:
                    self.model = data
                return True
            except Exception:
                self.model = None
                return False
        return False

    def predict_anomaly(self, feature_dict_or_vector: dict) -> Tuple[bool, float]:
        """
        Inference on a single feature dictionary or vector.
        Returns:
            is_anomaly: bool (True if anomalous/jerky)
            anomaly_score: float in [0.0, 1.0] where 1.0 is extreme anomaly
        """
        if self.model is None:
            # Fallback heuristic based on jerk and range
            jerk = float(feature_dict_or_vector.get("jerk", 0.0))
            is_anom = jerk > 45.0
            return is_anom, round(min(1.0, jerk / 60.0), 3)

        try:
            if self.feature_names:
                df_feat = pd.DataFrame([{k: feature_dict_or_vector.get(k, 0.0) for k in self.feature_names}])
            else:
                df_feat = pd.DataFrame([feature_dict_or_vector])

            pred = self.model.predict(df_feat)[0]  # -1 for outlier, 1 for inlier
            # decision_function gives negative values for anomalies, positive for inliers
            score_raw = self.model.decision_function(df_feat)[0]
            # Convert decision score to [0, 1] range: lower score_raw -> higher anomaly
            # decision_function usually ranges from -0.3 to +0.2
            normalized_score = float(np.clip(0.5 - (score_raw * 2.0), 0.0, 1.0))
            is_anom = bool(pred == -1 or normalized_score > 0.65)
            return is_anom, round(normalized_score, 3)
        except Exception:
            return False, 0.0
