"""
Data recording utility for training data collection.
Appends window samples and session metadata to ml_training_extra/data/raw/
"""

import os
import json
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
RAW_DATA_DIR = os.path.join(parent_dir, "data", "raw")

def save_recorded_session(label, samples, session_name=None, source="REAL_DEVICE"):
    os.makedirs(RAW_DATA_DIR, exist_ok=True)
    if session_name is None:
        session_name = f"session_{int(time.time())}"

    record = {
        "timestamp": time.time(),
        "source": source,
        "session_id": session_name,
        "label": label,
        "sample_count": len(samples),
        "samples": samples
    }

    file_path = os.path.join(RAW_DATA_DIR, f"{session_name}_{label}.json")
    with open(file_path, "w") as f:
        json.dump(record, f, indent=2)

    print(f"Recorded session saved: {file_path}")
    return file_path
