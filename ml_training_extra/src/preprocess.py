"""
Preprocessing & Feature Extraction for IMU Wrist Movement
Extracts sliding window features (2s window, 50% overlap @ 50Hz = 100 samples window, 50 samples stride):
- mean, std, min, max, range, RMS
- peak count
- dominant frequency (via FFT)
- jerk: mean |d(accel)/dt|
- zero-crossings
for pitch, roll, gx, gy, gz, and accel magnitude.
"""

from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, find_peaks


def butter_lowpass_filter(
    data: np.ndarray, cutoff: float = 5.0, fs: float = 50.0, order: int = 2
) -> np.ndarray:
    """Applies a 2nd-order low-pass Butterworth filter to remove high-frequency sensor noise."""
    if len(data) <= 15:
        return data
    nyq = 0.5 * fs
    normal_cutoff = min(0.99, max(0.01, cutoff / nyq))
    b, a = butter(order, normal_cutoff, btype="low", analog=False)
    try:
        return filtfilt(b, a, data)
    except Exception:
        return data


def extract_signal_features(signal: np.ndarray, prefix: str, fs: float = 50.0) -> Dict[str, float]:
    """Extracts statistical, frequency, and morphological features from a 1D signal window."""
    n = len(signal)
    if n == 0:
        return {
            f"{prefix}_mean": 0.0,
            f"{prefix}_std": 0.0,
            f"{prefix}_min": 0.0,
            f"{prefix}_max": 0.0,
            f"{prefix}_range": 0.0,
            f"{prefix}_rms": 0.0,
            f"{prefix}_peak_count": 0.0,
            f"{prefix}_dom_freq": 0.0,
            f"{prefix}_zero_crossings": 0.0,
        }

    s_mean = float(np.mean(signal))
    s_std = float(np.std(signal))
    s_min = float(np.min(signal))
    s_max = float(np.max(signal))
    s_range = s_max - s_min
    s_rms = float(np.sqrt(np.mean(signal**2)))

    # Zero crossings (relative to mean)
    zero_centered = signal - s_mean
    zero_crossings = float(np.sum(np.diff(np.signbit(zero_centered)) != 0))

    # Peak count
    peaks, _ = find_peaks(signal, distance=max(1, int(fs * 0.2)))
    peak_count = float(len(peaks))

    # Dominant frequency via real FFT
    if n >= 8:
        fft_vals = np.abs(np.fft.rfft(zero_centered))
        fft_freqs = np.fft.rfftfreq(n, d=1.0 / fs)
        # Ignore DC component
        if len(fft_vals) > 1:
            dom_idx = 1 + np.argmax(fft_vals[1:])
            dom_freq = float(fft_freqs[dom_idx])
        else:
            dom_freq = 0.0
    else:
        dom_freq = 0.0

    return {
        f"{prefix}_mean": round(s_mean, 4),
        f"{prefix}_std": round(s_std, 4),
        f"{prefix}_min": round(s_min, 4),
        f"{prefix}_max": round(s_max, 4),
        f"{prefix}_range": round(s_range, 4),
        f"{prefix}_rms": round(s_rms, 4),
        f"{prefix}_peak_count": peak_count,
        f"{prefix}_dom_freq": round(dom_freq, 3),
        f"{prefix}_zero_crossings": zero_crossings,
    }


def compute_jerk(ax: np.ndarray, ay: np.ndarray, az: np.ndarray, fs: float = 50.0) -> float:
    """Computes mean jerk: mean |d(accel_magnitude)/dt|."""
    accel_mag = np.sqrt(ax**2 + ay**2 + az**2)
    if len(accel_mag) < 2:
        return 0.0
    dt = 1.0 / fs
    d_accel = np.diff(accel_mag) / dt
    return float(np.mean(np.abs(d_accel)))


def extract_window_features(
    window_df_or_dict: Any, fs: float = 50.0, apply_filter: bool = True
) -> Dict[str, float]:
    """
    Extracts complete multi-channel feature vector from a single 2-second window.
    Accepts pandas DataFrame or dict of arrays.
    """
    if isinstance(window_df_or_dict, pd.DataFrame):
        pitch = window_df_or_dict["pitch"].values.astype(float)
        roll = window_df_or_dict["roll"].values.astype(float)
        gx = window_df_or_dict["gx"].values.astype(float)
        gy = window_df_or_dict["gy"].values.astype(float)
        gz = window_df_or_dict["gz"].values.astype(float)
        ax = window_df_or_dict["ax"].values.astype(float)
        ay = window_df_or_dict["ay"].values.astype(float)
        az = window_df_or_dict["az"].values.astype(float)
    else:
        pitch = np.asarray(window_df_or_dict["pitch"], dtype=float)
        roll = np.asarray(window_df_or_dict["roll"], dtype=float)
        gx = np.asarray(window_df_or_dict["gx"], dtype=float)
        gy = np.asarray(window_df_or_dict["gy"], dtype=float)
        gz = np.asarray(window_df_or_dict["gz"], dtype=float)
        ax = np.asarray(window_df_or_dict["ax"], dtype=float)
        ay = np.asarray(window_df_or_dict["ay"], dtype=float)
        az = np.asarray(window_df_or_dict["az"], dtype=float)

    if apply_filter and len(pitch) > 15:
        pitch = butter_lowpass_filter(pitch, cutoff=6.0, fs=fs)
        roll = butter_lowpass_filter(roll, cutoff=6.0, fs=fs)

    features: Dict[str, float] = {}
    features.update(extract_signal_features(pitch, "pitch", fs=fs))
    features.update(extract_signal_features(roll, "roll", fs=fs))
    features.update(extract_signal_features(gx, "gx", fs=fs))
    features.update(extract_signal_features(gy, "gy", fs=fs))
    features.update(extract_signal_features(gz, "gz", fs=fs))

    accel_mag = np.sqrt(ax**2 + ay**2 + az**2)
    features.update(extract_signal_features(accel_mag, "accel_mag", fs=fs))
    features["jerk"] = round(compute_jerk(ax, ay, az, fs=fs), 4)

    return features


def extract_sliding_windows(
    df: pd.DataFrame,
    window_sec: float = 2.0,
    overlap: float = 0.5,
    fs: float = 50.0,
) -> Tuple[pd.DataFrame, pd.Series, pd.Series]:
    """
    Slices session DataFrame into sliding windows and extracts features.
    Returns:
    - X: DataFrame of extracted features per window
    - y_label: Series of target labels (e.g. 'correct', 'too_shallow', 'too_fast', 'jerky')
    - session_ids: Series of session identifiers for leakage-free splitting
    """
    window_size = int(window_sec * fs)  # 100 samples
    step = int(window_size * (1.0 - overlap))  # 50 samples

    rows: List[Dict[str, float]] = []
    labels: List[str] = []
    sessions: List[str] = []

    n_samples = len(df)
    for start in range(0, n_samples - window_size + 1, step):
        end = start + window_size
        sub_df = df.iloc[start:end]

        feats = extract_window_features(sub_df, fs=fs, apply_filter=True)
        rows.append(feats)

        # Mode label and session from window
        label = sub_df["label"].iloc[-1] if "label" in sub_df.columns else "unknown"
        session = sub_df["session_id"].iloc[-1] if "session_id" in sub_df.columns else "default"
        labels.append(label)
        sessions.append(session)

    X = pd.DataFrame(rows)
    y_label = pd.Series(labels, name="label")
    session_ids = pd.Series(sessions, name="session_id")
    return X, y_label, session_ids
