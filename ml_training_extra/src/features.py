import numpy as np
from scipy.signal import find_peaks

FEATURE_NAMES = [
    'range',
    'mean',
    'std',
    'min',
    'max',
    'rms',
    'peak_count',
    'dominant_freq',
    'mean_abs_jerk',
    'zero_crossings',
    'velocity_mean',
    'velocity_std'
]

def extract_window_features(samples, sampling_rate=20.0):
    """
    Extract kinematics and frequency features from a 2-second window of wrist angles.
    
    samples: list of dicts [{'time': float, 'angle': float}] or array-like of angles.
    sampling_rate: nominal Hz (e.g. 20 Hz = 40 samples per 2s).
    """
    if len(samples) == 0:
        return np.zeros(len(FEATURE_NAMES))

    if isinstance(samples[0], dict):
        angles = np.array([float(s.get('angle', 0.0)) for s in samples], dtype=float)
        times = np.array([float(s.get('time', i / sampling_rate)) for i, s in enumerate(samples)], dtype=float)
    else:
        angles = np.array(samples, dtype=float)
        times = np.linspace(0, len(angles) / sampling_rate, len(angles))

    n = len(angles)
    if n < 3:
        return np.zeros(len(FEATURE_NAMES))

    # 1. Range, min, max
    ang_min = float(np.min(angles))
    ang_max = float(np.max(angles))
    ang_range = float(ang_max - ang_min)

    # 2. Mean, std, RMS
    ang_mean = float(np.mean(angles))
    ang_std = float(np.std(angles))
    ang_rms = float(np.sqrt(np.mean(angles ** 2)))

    # 3. Peak count (prominence threshold avoids sensor noise)
    peaks, _ = find_peaks(angles, prominence=2.0)
    valleys, _ = find_peaks(-angles, prominence=2.0)
    peak_count = float(len(peaks) + len(valleys))

    # 4. Dominant frequency via FFT
    dt = float(np.mean(np.diff(times))) if n > 1 else (1.0 / sampling_rate)
    dt = dt if dt > 1e-4 else (1.0 / sampling_rate)
    fs = 1.0 / dt
    
    centered = angles - ang_mean
    fft_vals = np.abs(np.fft.rfft(centered))
    freqs = np.fft.rfftfreq(n, d=dt)
    
    if len(fft_vals) > 1:
        dom_idx = int(np.argmax(fft_vals[1:])) + 1
        dominant_freq = float(freqs[dom_idx])
    else:
        dominant_freq = 0.0

    # 5. Velocity, acceleration, and jerk
    vel = np.gradient(angles, dt)
    acc = np.gradient(vel, dt)
    jerk = np.gradient(acc, dt)
    mean_abs_jerk = float(np.mean(np.abs(jerk)))
    vel_mean = float(np.mean(np.abs(vel)))
    vel_std = float(np.std(vel))

    # 6. Zero crossings of mean-centered signal
    zero_crossings = float(np.sum(np.diff(np.sign(centered) >= 0) != 0))

    return np.array([
        ang_range,
        ang_mean,
        ang_std,
        ang_min,
        ang_max,
        ang_rms,
        peak_count,
        dominant_freq,
        mean_abs_jerk,
        zero_crossings,
        vel_mean,
        vel_std
    ], dtype=float)
