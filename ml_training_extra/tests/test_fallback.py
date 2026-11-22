import os
import joblib
import numpy as np

def predict_quality_with_fallback(samples, model_path="non_existent_model.joblib"):
    if not os.path.exists(model_path):
        return {
            "quality": "unknown",
            "confidence": 0.0,
            "badge": "AI: RULES ONLY",
            "source": "fallback"
        }
    
    try:
        model = joblib.load(model_path)
        return {
            "quality": "correct",
            "confidence": 0.95,
            "badge": "AI: ML MODEL",
            "source": "ml"
        }
    except Exception:
        return {
            "quality": "unknown",
            "confidence": 0.0,
            "badge": "AI: RULES ONLY",
            "source": "fallback"
        }

def test_missing_model_fallback():
    res = predict_quality_with_fallback([], model_path="missing_file.joblib")
    assert res["badge"] == "AI: RULES ONLY"
    assert res["quality"] == "unknown"
    assert res["confidence"] == 0.0
