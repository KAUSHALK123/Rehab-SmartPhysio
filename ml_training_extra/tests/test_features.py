import pytest
import numpy as np
import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from src.features import extract_window_features, FEATURE_NAMES

def test_extract_window_features_shape():
    # 2 seconds at 20 Hz = 40 samples
    samples = [{"time": i * 0.05, "angle": 30.0 * np.sin(i * 0.1)} for i in range(40)]
    feats = extract_window_features(samples)
    assert isinstance(feats, np.ndarray)
    assert len(feats) == len(FEATURE_NAMES)
    assert not np.isnan(feats).any()

def test_empty_samples():
    feats = extract_window_features([])
    assert len(feats) == len(FEATURE_NAMES)
    assert np.all(feats == 0.0)

def test_static_signal_zero_velocity():
    samples = [{"time": i * 0.05, "angle": 25.0} for i in range(40)]
    feats = extract_window_features(samples)
    # Range is 0
    assert feats[0] == pytest.approx(0.0, abs=1e-5)
    # Mean is 25
    assert feats[1] == pytest.approx(25.0, abs=1e-5)
