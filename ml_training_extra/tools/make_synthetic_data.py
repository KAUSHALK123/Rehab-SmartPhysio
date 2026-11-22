"""
Synthetic wrist data generator.
Generates realistic labeled synthetic kinematics windows labeled 'SIMULATED'
for testing and model training.
Classes: correct, too_shallow, too_fast, jerky
"""

import os
import json
import numpy as np
import pandas as pd

def generate_window(label, target_angle=45.0, duration=2.0, sampling_rate=20.0):
    t = np.linspace(0, duration, int(duration * sampling_rate))
    
    if label == 'correct':
        # Smooth rep reaching near target with slight physiological noise
        freq = np.random.uniform(0.4, 0.6)
        amp = target_angle * np.random.uniform(0.9, 1.05)
        angle = amp * np.sin(2 * np.pi * freq * t) + np.random.normal(0, 0.5, len(t))
    elif label == 'too_shallow':
        # Low amplitude (does not reach target)
        freq = np.random.uniform(0.4, 0.6)
        amp = target_angle * np.random.uniform(0.3, 0.55)
        angle = amp * np.sin(2 * np.pi * freq * t) + np.random.normal(0, 0.5, len(t))
    elif label == 'too_fast':
        # Rapid cadence / high velocity
        freq = np.random.uniform(1.2, 2.0)
        amp = target_angle * np.random.uniform(0.85, 1.1)
        angle = amp * np.sin(2 * np.pi * freq * t) + np.random.normal(0, 1.0, len(t))
    elif label == 'jerky':
        # Tremor / erratic steps / abrupt stops
        freq = np.random.uniform(0.4, 0.7)
        base = target_angle * 0.85 * np.sin(2 * np.pi * freq * t)
        jitter = np.random.choice([-6, 0, 6], size=len(t), p=[0.2, 0.6, 0.2])
        spikes = np.random.normal(0, 3.5, len(t))
        angle = base + jitter + spikes
    else:
        angle = np.zeros_like(t)

    return [{"time": float(round(ti, 3)), "angle": float(round(a, 2))} for ti, a in zip(t, angle)]

def generate_dataset(num_sessions=20, windows_per_session=15, output_dir=None):
    if output_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.path.join(base_dir, "data")
    
    os.makedirs(output_dir, exist_ok=True)
    labels = ['correct', 'too_shallow', 'too_fast', 'jerky']
    
    records = []
    
    for session_idx in range(num_sessions):
        session_id = f"sim_session_{session_idx:03d}"
        for _ in range(windows_per_session):
            label = np.random.choice(labels, p=[0.4, 0.2, 0.2, 0.2])
            samples = generate_window(label)
            records.append({
                "source": "SIMULATED",
                "session_id": session_id,
                "label": label,
                "samples": samples
            })

    output_file = os.path.join(output_dir, "synthetic_dataset.json")
    with open(output_file, "w") as f:
        json.dump(records, f, indent=2)

    print(f"[SIMULATED] Generated {len(records)} windows across {num_sessions} sessions -> {output_file}")
    return output_file

if __name__ == "__main__":
    generate_dataset()
