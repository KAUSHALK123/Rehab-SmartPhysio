"""
Wrist Exercise Repetition Detector
Uses scipy.signal.find_peaks with hysteresis and kinematic thresholds to track:
- rep_count
- peak_angle
- min_angle
- range_of_motion (ROM)
- duration (seconds)
- peak_velocity (deg/s)
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy.signal import find_peaks

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


def load_exercise_config(config_path: Optional[Path] = None) -> dict:
    path = config_path or DEFAULT_CONFIG_PATH
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "exercises": {
            "flexion_extension": {
                "name": "Wrist Flexion / Extension",
                "primary_axis": "pitch",
                "target_angle": 40.0,
                "tolerance": 8.0,
                "min_rep_rom": 15.0,
                "prominence": 12.0,
                "min_duration": 0.8,
                "max_duration": 5.0,
            },
            "radial_ulnar": {
                "name": "Radial / Ulnar Deviation",
                "primary_axis": "roll",
                "target_angle": 25.0,
                "tolerance": 6.0,
                "min_rep_rom": 10.0,
                "prominence": 8.0,
                "min_duration": 0.8,
                "max_duration": 5.0,
            },
            "forearm_rotation": {
                "name": "Forearm Pronation / Supination",
                "primary_axis": "roll",
                "target_angle": 60.0,
                "tolerance": 12.0,
                "min_rep_rom": 20.0,
                "prominence": 15.0,
                "min_duration": 0.8,
                "max_duration": 5.0,
            },
        }
    }


class RepDetector:
    """Detects repetitions in wrist rehabilitation exercises from streaming or batch IMU angle data."""

    def __init__(self, exercise: str = "flexion_extension", config: Optional[dict] = None):
        all_config = config or load_exercise_config()
        self.exercises_config = all_config.get("exercises", {})
        self.set_exercise(exercise)

        # Online streaming state
        self.reset()

    def set_exercise(self, exercise: str):
        self.exercise = exercise
        cfg = self.exercises_config.get(exercise, {})
        self.primary_axis = cfg.get("primary_axis", "pitch")
        self.target_angle = float(cfg.get("target_angle", 40.0))
        self.tolerance = float(cfg.get("tolerance", 8.0))
        self.min_rep_rom = float(cfg.get("min_rep_rom", 15.0))
        self.prominence = float(cfg.get("prominence", 12.0))
        self.min_duration = float(cfg.get("min_duration", 0.8))
        self.max_duration = float(cfg.get("max_duration", 5.0))

    def reset(self):
        """Reset internal counter and buffers."""
        self.rep_count = 0
        self.last_rep_stats: Optional[Dict[str, float]] = None
        self.history_t: List[float] = []
        self.history_angle: List[float] = []
        self.completed_reps: List[Dict[str, float]] = []
        self._last_processed_idx = 0
        self._in_rep = False
        self._rep_start_t = 0.0
        self._rep_start_angle = 0.0
        self._current_rep_max_angle = 0.0
        self._current_rep_min_angle = 0.0

    def feed_sample(self, t_sec: float, angle: float) -> Optional[Dict[str, float]]:
        """
        Feed a single sample (timestamp in seconds, angle in degrees).
        Returns a rep stats dict if a repetition was just completed, else None.
        """
        self.history_t.append(t_sec)
        self.history_angle.append(angle)

        # Keep rolling buffer bounded to last 20 seconds (1000 samples @ 50Hz)
        if len(self.history_t) > 1000:
            self.history_t.pop(0)
            self.history_angle.pop(0)

        # Online state machine with hysteresis
        # Thresholds: start moving when |angle| > prominence * 0.4
        # Peak detected when direction reverses after crossing min_rep_rom
        abs_angle = abs(angle)
        start_threshold = max(5.0, self.prominence * 0.35)
        completion_threshold = max(4.0, self.prominence * 0.30)

        if not self._in_rep:
            if abs_angle > start_threshold:
                self._in_rep = True
                self._rep_start_t = t_sec
                self._rep_start_angle = angle
                self._current_rep_max_angle = abs_angle
                self._current_rep_min_angle = abs_angle
        else:
            if abs_angle > self._current_rep_max_angle:
                self._current_rep_max_angle = abs_angle

            # Check for completion (returned near neutral or trough)
            duration = t_sec - self._rep_start_t
            if abs_angle <= completion_threshold or (duration > self.max_duration):
                rom = self._current_rep_max_angle - abs(self._rep_start_angle)
                if rom >= self.min_rep_rom and duration >= self.min_duration:
                    self.rep_count += 1
                    # Approximate peak velocity
                    peak_velocity = (rom / (duration * 0.5)) if duration > 0 else 0.0
                    stats = {
                        "rep_number": self.rep_count,
                        "peak_angle": round(self._current_rep_max_angle, 2),
                        "min_angle": round(self._rep_start_angle, 2),
                        "range_of_motion": round(rom, 2),
                        "duration": round(duration, 3),
                        "peak_velocity": round(peak_velocity, 2),
                        "target_angle": self.target_angle,
                        "tolerance": self.tolerance,
                    }
                    self.last_rep_stats = stats
                    self.completed_reps.append(stats)
                    self._in_rep = False
                    return stats
                else:
                    # Incomplete / too small / noise - reset without counting rep
                    self._in_rep = False

        return None

    def analyze_batch(
        self, t_sec: np.ndarray, angles: np.ndarray, sampling_rate: float = 50.0
    ) -> List[Dict[str, float]]:
        """
        Batch detection of repetitions using scipy.signal.find_peaks with prominence & distance.
        """
        if len(angles) < int(sampling_rate * self.min_duration):
            return []

        # Find positive peaks on absolute angle
        abs_angles = np.abs(angles)
        min_distance = int(sampling_rate * self.min_duration)
        peaks, properties = find_peaks(
            abs_angles,
            height=self.min_rep_rom,
            prominence=self.prominence,
            distance=min_distance,
        )

        reps = []
        for i, peak_idx in enumerate(peaks):
            peak_t = t_sec[peak_idx]
            peak_val = float(abs_angles[peak_idx])

            # Find local valley before peak
            start_window = max(0, peak_idx - int(sampling_rate * self.max_duration / 2))
            left_slice = abs_angles[start_window:peak_idx]
            if len(left_slice) > 0:
                local_min_idx = start_window + int(np.argmin(left_slice))
                min_val = float(abs_angles[local_min_idx])
                start_t = t_sec[local_min_idx]
            else:
                min_val = 0.0
                start_t = peak_t - 1.0

            # Find local valley after peak
            end_window = min(len(abs_angles), peak_idx + int(sampling_rate * self.max_duration / 2))
            right_slice = abs_angles[peak_idx:end_window]
            if len(right_slice) > 0:
                local_end_idx = peak_idx + int(np.argmin(right_slice))
                end_t = t_sec[local_end_idx]
            else:
                end_t = peak_t + 1.0

            duration = max(0.1, end_t - start_t)
            rom = max(0.0, peak_val - min_val)
            peak_velocity = rom / max(0.1, (peak_t - start_t))

            rep_data = {
                "rep_number": i + 1,
                "peak_angle": round(peak_val, 2),
                "min_angle": round(min_val, 2),
                "range_of_motion": round(rom, 2),
                "duration": round(duration, 3),
                "peak_velocity": round(peak_velocity, 2),
                "target_angle": self.target_angle,
                "tolerance": self.tolerance,
            }
            reps.append(rep_data)

        self.rep_count = len(reps)
        if reps:
            self.last_rep_stats = reps[-1]
            self.completed_reps = reps
        return reps
