"""
Unit Tests for Wrist ML Coach
Tests:
1. Preprocessing: sliding window, feature extraction, shape and expected keys.
2. Rep Detector: known synthetic sine wave -> exact expected rep count and peak angle.
3. Message Rules & Debounce: clinical feedback messages and debouncing behavior.
4. Fallback without Model: WristCoach initializes and runs rule-based feedback safely when model file does not exist.
"""

import time
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from ml_training_extra.src.preprocess import (
    extract_window_features,
    extract_sliding_windows,
    compute_jerk,
)
from ml_training_extra.src.rep_detector import RepDetector
from ml_training_extra.src.coach import WristCoach


def test_preprocessing_window_features():
    # Construct 100 samples (2.0s @ 50Hz) of pure sine motion
    fs = 50.0
    t = np.linspace(0, 2.0, 100, endpoint=False)
    pitch = 30.0 * np.sin(2 * np.pi * 1.0 * t)
    roll = 5.0 * np.cos(2 * np.pi * 1.0 * t)
    ax = np.zeros(100)
    ay = np.zeros(100)
    az = np.ones(100)
    gx = np.zeros(100)
    gy = np.zeros(100)
    gz = np.zeros(100)

    window_dict = {
        "pitch": pitch,
        "roll": roll,
        "ax": ax, "ay": ay, "az": az,
        "gx": gx, "gy": gy, "gz": gz,
    }
    feats = extract_window_features(window_dict, fs=fs, apply_filter=False)

    assert "pitch_mean" in feats
    assert "pitch_range" in feats
    assert "pitch_dom_freq" in feats
    assert "jerk" in feats
    assert feats["pitch_range"] > 55.0  # ~60 deg peak-to-peak
    assert np.isclose(feats["pitch_dom_freq"], 1.0, atol=0.2)


def test_sliding_windows_extraction():
    # Construct 250 samples DataFrame with 2 sessions
    t = np.arange(250) * 0.02
    df = pd.DataFrame({
        "pitch": np.sin(t),
        "roll": np.cos(t),
        "ax": 0.0, "ay": 0.0, "az": 1.0,
        "gx": 0.0, "gy": 0.0, "gz": 0.0,
        "label": ["correct"] * 250,
        "session_id": ["sess_1"] * 125 + ["sess_2"] * 125,
    })

    X, y, sessions = extract_sliding_windows(df, window_sec=2.0, overlap=0.5, fs=50.0)
    # 250 samples / 50 samples stride = 4 windows of 100 samples
    assert len(X) == 4
    assert len(y) == 4
    assert list(sessions.unique()) == ["sess_1", "sess_2"]


def test_rep_detector_known_sine():
    """Verify known sine wave produces expected rep count and peak amplitude."""
    fs = 50.0
    detector = RepDetector(exercise="flexion_extension")
    detector.target_angle = 40.0
    detector.prominence = 10.0
    detector.min_rep_rom = 15.0

    # 4 distinct cycles of full sinusoidal reps from 0 to 40 degrees (period = 2.0s, 0.5 Hz)
    # total duration = 8 seconds = 400 samples
    total_samples = 400
    t = np.linspace(0, 8.0, total_samples, endpoint=False)
    angles = 20.0 * (1.0 - np.cos(2 * np.pi * 0.5 * t))

    reps = detector.analyze_batch(t, angles, sampling_rate=fs)

    assert len(reps) == 4
    for rep in reps:
        assert np.isclose(rep["peak_angle"], 40.0, atol=2.0)
        assert rep["range_of_motion"] >= 35.0
        assert np.isclose(rep["duration"], 2.0, atol=0.5)


def test_message_rules_and_debouncing():
    coach = WristCoach(
        exercise="flexion_extension",
        target_angle=40.0,
        rf_model_path=Path("non_existent_rf.joblib"),
        anomaly_model_path=Path("non_existent_anom.joblib"),
    )
    assert not coach.ml_loaded

    # 1. Idle state message
    frame_idle = {
        "type": "imu",
        "src": "simulated",
        "seq": 1,
        "t": 1000.0,
        "pitch": 0.0, "roll": 0.0,
        "ax": 0.0, "ay": 0.0, "az": 1.0,
        "gx": 0.0, "gy": 0.0, "gz": 0.0,
    }
    # Fast forward idle time
    coach.last_activity_time = time.time() - 6.0
    res = coach.update(frame_idle)
    assert "Ready when you are" in res["message"]

    # 2. Debouncing check: rapidly updating message should not flip continuously
    coach.last_message_time = time.time()
    coach.current_message = "Initial Message"
    coach._update_message("Second Message", "info", force=False)
    assert coach.current_message == "Initial Message"  # Debounced

    # Forced update overrides debounce
    coach._update_message("Forced Message", "warn", force=True)
    assert coach.current_message == "Forced Message"


def test_fallback_without_model():
    """WristCoach must gracefully fall back to rule-based logic without crashing when model is missing."""
    dummy_rf_path = Path("definitely_missing_model.joblib")
    dummy_anom_path = Path("definitely_missing_anom.joblib")

    coach = WristCoach(
        exercise="flexion_extension",
        target_angle=40.0,
        rf_model_path=dummy_rf_path,
        anomaly_model_path=dummy_anom_path,
    )

    assert coach.ml_loaded is False

    frame = {
        "type": "imu",
        "src": "esp32",
        "seq": 42,
        "t": 123456.0,
        "pitch": 38.5,
        "roll": 2.1,
        "ax": 0.1, "ay": 0.05, "az": 0.98,
        "gx": 1.2, "gy": 4.5, "gz": 0.1,
    }

    res = coach.update(frame)
    assert res["type"] == "coach"
    assert res["mode"] == "rule_based_only"
    assert res["current_angle"] == 38.5
    assert res["target"] == 40.0
    assert "Rule-based" in res["message"]
    assert res["severity"] in ["ok", "info", "warn"]
