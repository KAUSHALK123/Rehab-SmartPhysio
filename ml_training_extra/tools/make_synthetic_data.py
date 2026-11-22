"""
Synthetic IMU Data Generator for Wrist Rehabilitation Coach
Generates realistic 50 Hz IMU sessions for wrist exercises:
- flexion_extension (primary axis: pitch)
- radial_ulnar (primary axis: roll)
- forearm_rotation (primary axis: roll)

Quality classes simulated:
- correct: smooth sinusoidal reps matching target angle (+/- 4 deg), ~2.0-2.5s duration per rep
- too_shallow: clean movement but peak angle is only ~50% of target (insufficient ROM)
- too_fast: rapid reps completed in under 0.9s
- jerky: movement with high jerk, jitter, secondary tremors, and hesitation

All files and records are explicitly tagged 'SIMULATED'.
"""

import argparse
import os
import time
from pathlib import Path
import numpy as np
import pandas as pd

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

EXERCISE_PARAMS = {
    "flexion_extension": {
        "primary": "pitch",
        "target": 40.0,
        "shallow_target": 20.0,
        "base_period": 2.4,
    },
    "radial_ulnar": {
        "primary": "roll",
        "target": 25.0,
        "shallow_target": 12.0,
        "base_period": 2.2,
    },
    "forearm_rotation": {
        "primary": "roll",
        "target": 60.0,
        "shallow_target": 28.0,
        "base_period": 2.6,
    },
}


def generate_session(
    exercise: str,
    label: str,
    session_id: str,
    num_reps: int = 8,
    fs: float = 50.0,
) -> pd.DataFrame:
    """Generates a single synthetic session dataframe with realistic IMU telemetry."""
    cfg = EXERCISE_PARAMS.get(exercise, EXERCISE_PARAMS["flexion_extension"])
    primary_axis = cfg["primary"]

    # Repetition timing and amplitude customization by label
    if label == "correct":
        target_amp = cfg["target"] + np.random.uniform(-3.0, 3.0)
        rep_duration = cfg["base_period"] + np.random.uniform(-0.2, 0.2)
        noise_level = 0.6
        jerk_multiplier = 0.0
    elif label == "too_shallow":
        target_amp = cfg["shallow_target"] + np.random.uniform(-2.0, 2.0)
        rep_duration = cfg["base_period"] + np.random.uniform(-0.2, 0.2)
        noise_level = 0.5
        jerk_multiplier = 0.0
    elif label == "too_fast":
        target_amp = cfg["target"] + np.random.uniform(-4.0, 4.0)
        rep_duration = 0.75 + np.random.uniform(-0.1, 0.1)  # fast < 1.0s
        noise_level = 0.7
        jerk_multiplier = 0.2
    elif label == "jerky":
        target_amp = cfg["target"] + np.random.uniform(-5.0, 5.0)
        rep_duration = cfg["base_period"] + np.random.uniform(-0.3, 0.5)
        noise_level = 2.8
        jerk_multiplier = 1.0
    else:
        raise ValueError(f"Unknown label: {label}")

    total_duration = (num_reps + 1) * rep_duration
    total_samples = int(total_duration * fs)
    t = np.linspace(0, total_duration, total_samples, endpoint=False)

    # Primary angle waveform (half-wave rectified sine waves with rest at 0)
    omega = 2.0 * np.pi / rep_duration
    # Phase shift slightly for realism
    base_wave = np.maximum(0.0, np.sin(omega * t)) * target_amp

    # Add minor inter-rep baseline pause and natural variation
    variation = 1.0 + 0.08 * np.sin(0.4 * t)
    primary_signal = base_wave * variation

    # Add jitter / jerks if labeled jerky
    if jerk_multiplier > 0:
        high_freq_tremor = np.sin(28.0 * t) * (3.5 * jerk_multiplier)
        random_spikes = (np.random.rand(total_samples) > 0.94) * np.random.uniform(-6.0, 6.0, total_samples) * jerk_multiplier
        primary_signal += high_freq_tremor + random_spikes

    # Add Gaussian sensor noise
    primary_signal += np.random.normal(0, noise_level, total_samples)

    # Secondary axis (minor cross-coupling)
    secondary_signal = 0.15 * primary_signal + np.random.normal(0, 0.8, total_samples)

    if primary_axis == "pitch":
        pitch = primary_signal
        roll = secondary_signal
    else:
        roll = primary_signal
        pitch = secondary_signal

    # Angular velocity (gx, gy, gz in deg/s): approx derivative + bias
    dt = 1.0 / fs
    dpitch_dt = np.gradient(pitch, dt)
    droll_dt = np.gradient(roll, dt)

    gx = droll_dt + np.random.normal(0.5, 1.0, total_samples)
    gy = dpitch_dt + np.random.normal(-0.3, 1.0, total_samples)
    gz = np.random.normal(0.0, 1.5, total_samples)

    # Acceleration in g's (ax, ay, az): Hand oriented roughly flat with gravity ~ 1g on az
    pitch_rad = np.radians(pitch)
    roll_rad = np.radians(roll)
    ax = -np.sin(pitch_rad) + np.random.normal(0, 0.03, total_samples)
    ay = np.sin(roll_rad) * np.cos(pitch_rad) + np.random.normal(0, 0.03, total_samples)
    az = np.cos(roll_rad) * np.cos(pitch_rad) + np.random.normal(0, 0.03, total_samples)

    seq = np.arange(1, total_samples + 1, dtype=int)
    t_ms = (t * 1000).astype(int)

    df = pd.DataFrame({
        "seq": seq,
        "t": t_ms,
        "ax": np.round(ax, 4),
        "ay": np.round(ay, 4),
        "az": np.round(az, 4),
        "gx": np.round(gx, 2),
        "gy": np.round(gy, 2),
        "gz": np.round(gz, 2),
        "pitch": np.round(pitch, 2),
        "roll": np.round(roll, 2),
        "exercise": exercise,
        "label": label,
        "session_id": session_id,
        "is_simulated": 1,
    })
    return df


def generate_all_synthetic_data(out_dir: Path, sessions_per_combo: int = 3) -> list:
    """Generates synthetic datasets across all exercises and labels for robust session-split training."""
    out_dir.mkdir(parents=True, exist_ok=True)
    exercises = ["flexion_extension", "radial_ulnar", "forearm_rotation"]
    labels = ["correct", "too_shallow", "too_fast", "jerky"]

    created_files = []
    timestamp = int(time.time())

    for ex in exercises:
        for lbl in labels:
            for s_idx in range(1, sessions_per_combo + 1):
                session_id = f"sim_sess_{s_idx}"
                df = generate_session(ex, lbl, session_id=session_id, num_reps=10)
                filename = f"SIMULATED_{ex}_{lbl}_{session_id}_{timestamp}.csv"
                file_path = out_dir / filename
                df.to_csv(file_path, index=False)
                created_files.append(file_path)

    return created_files


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic IMU datasets for wrist coach.")
    parser.add_argument("--out-dir", type=str, default=str(DEFAULT_OUTPUT_DIR), help="Output directory")
    parser.add_argument("--sessions", type=int, default=3, help="Number of sessions per exercise/label combo")
    args = parser.parse_args()

    target_dir = Path(args.out_dir)
    files = generate_all_synthetic_data(target_dir, sessions_per_combo=args.sessions)
    print(f"Generated {len(files)} SIMULATED CSV dataset files in {target_dir}")
