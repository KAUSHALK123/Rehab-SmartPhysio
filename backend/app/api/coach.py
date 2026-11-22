import os
import sys
import logging
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coach", tags=["AI Coach"])

# Path to trained wrist models
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ML_DIR = os.path.join(PROJECT_ROOT, "ml_training_extra")
MODELS_DIR = os.path.join(ML_DIR, "models")
RF_MODEL_PATH = os.path.join(MODELS_DIR, "wrist_rf.joblib")
ISO_MODEL_PATH = os.path.join(MODELS_DIR, "wrist_anomaly.joblib")

# Ensure ml_training_extra is on sys.path for features import
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

class AngleSample(BaseModel):
    time: float
    angle: float

class CoachPredictRequest(BaseModel):
    samples: List[AngleSample]
    exercise_name: Optional[str] = "Wrist Motion Test"
    is_simulated: Optional[bool] = False

class CoachPredictResponse(BaseModel):
    quality: str
    confidence: float
    anomaly: float
    badge: str

_rf_model = None
_iso_model = None
_model_load_attempted = False

def get_models():
    global _rf_model, _iso_model, _model_load_attempted
    if not _model_load_attempted:
        _model_load_attempted = True
        try:
            import joblib
            if os.path.exists(RF_MODEL_PATH):
                _rf_model = joblib.load(RF_MODEL_PATH)
                logger.info(f"Loaded Wrist RF Model from {RF_MODEL_PATH}")
            if os.path.exists(ISO_MODEL_PATH):
                _iso_model = joblib.load(ISO_MODEL_PATH)
                logger.info(f"Loaded Wrist Anomaly Model from {ISO_MODEL_PATH}")
        except Exception as e:
            logger.warning(f"Could not load ML models: {e}. Falling back to rules only.")
            _rf_model = None
            _iso_model = None
    return _rf_model, _iso_model

@router.post("/predict", response_model=CoachPredictResponse)
def predict_wrist_quality(payload: CoachPredictRequest):
    rf, iso = get_models()

    if payload.is_simulated:
        badge = "AI: SIMULATED"
    elif rf is not None:
        badge = "AI: ML MODEL"
    else:
        badge = "AI: RULES ONLY"

    if rf is None or len(payload.samples) < 5:
        return CoachPredictResponse(
            quality="unknown",
            confidence=0.0,
            anomaly=0.0,
            badge=badge
        )

    try:
        from src.features import extract_window_features
        import numpy as np

        samples_dicts = [{"time": s.time, "angle": s.angle} for s in payload.samples]
        feats = extract_window_features(samples_dicts).reshape(1, -1)

        pred_quality = str(rf.predict(feats)[0])
        probs = rf.predict_proba(feats)[0]
        confidence = float(np.max(probs))

        anomaly_score = 0.0
        if iso is not None:
            anomaly_score = float(iso.decision_function(feats)[0])

        return CoachPredictResponse(
            quality=pred_quality,
            confidence=round(confidence, 2),
            anomaly=round(anomaly_score, 3),
            badge=badge
        )
    except Exception as e:
        logger.error(f"Inference error: {e}")
        return CoachPredictResponse(
            quality="unknown",
            confidence=0.0,
            anomaly=0.0,
            badge="AI: RULES ONLY"
        )
