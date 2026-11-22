"""
Session Recording Tool for Wrist Rehabilitation IMU Data
Connects to the backend/ESP32 WebSocket and records IMU frames into labeled CSV sessions.
Supports live ESP32 recording or local simulation via --simulate.

Usage:
  python -m ml_training_extra.tools.record_session --exercise flexion_extension --label correct --duration 20
  python -m ml_training_extra.tools.record_session --exercise radial_ulnar --label jerky --duration 15 --simulate
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
import pandas as pd

from .make_synthetic_data import generate_session

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


async def record_live_websocket(
    ws_url: str,
    exercise: str,
    label: str,
    duration_sec: float,
    output_csv: Path,
):
    import websockets

    print(f"\n[RECORDING] Connecting to {ws_url}...")
    try:
        async with websockets.connect(ws_url) as ws:
            print("[RECORDING] Connected! Starting 3-second countdown:")
            for i in [3, 2, 1]:
                print(f"  {i}...")
                await asyncio.sleep(1.0)
            print(">>> GO! PERFORM EXERCISE NOW <<<")

            records = []
            start_time = time.time()
            last_print = 0.0

            while time.time() - start_time < duration_sec:
                elapsed = time.time() - start_time
                remaining = max(0.0, duration_sec - elapsed)

                try:
                    msg = await asyncio.wait_for(ws.receive(), timeout=1.5)
                    data = json.loads(msg)
                    if data.get("type") == "imu":
                        data["exercise"] = exercise
                        data["label"] = label
                        data["session_id"] = output_csv.stem
                        data["is_simulated"] = 1 if data.get("src") == "simulated" else 0
                        records.append(data)
                except asyncio.TimeoutError:
                    pass

                # Live status update
                if elapsed - last_print >= 0.5:
                    last_print = elapsed
                    sys.stdout.write(f"\r[RECORDING] Remaining: {remaining:4.1f}s | Captured Frames: {len(records):4d}")
                    sys.stdout.flush()

            print(f"\n[RECORDING] Completed session with {len(records)} frames.")
            if records:
                df = pd.DataFrame(records)
                output_csv.parent.mkdir(parents=True, exist_ok=True)
                df.to_csv(output_csv, index=False)
                print(f"[SAVED] {output_csv}")
            else:
                print("[WARNING] No IMU frames captured. Is the ESP32 connected and streaming 'imu' frames?")

    except Exception as e:
        print(f"[ERROR] WebSocket connection failed: {e}")


def record_simulated_session(exercise: str, label: str, duration_sec: float, output_csv: Path):
    print(f"\n[RECORDING: SIMULATION] Generating {duration_sec}s of {label} {exercise}...")
    for i in [3, 2, 1]:
        print(f"  {i}...")
        time.sleep(0.4)
    print(">>> GENERATING SYNTHETIC SESSION <<<")

    num_reps = max(3, int(duration_sec / 2.2))
    df = generate_session(exercise, label, session_id=output_csv.stem, num_reps=num_reps, fs=50.0)

    # Trim to duration
    max_samples = int(duration_sec * 50.0)
    df = df.iloc[:max_samples]

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    print(f"[RECORDING: SIMULATION] Done! Generated {len(df)} frames.")
    print(f"[SAVED] {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="Record IMU session for wrist coach.")
    parser.add_argument(
        "--exercise",
        type=str,
        default="flexion_extension",
        choices=["flexion_extension", "radial_ulnar", "forearm_rotation"],
        help="Exercise name",
    )
    parser.add_argument(
        "--label",
        type=str,
        default="correct",
        choices=["correct", "too_shallow", "too_fast", "jerky"],
        help="Motion quality label",
    )
    parser.add_argument("--duration", type=float, default=20.0, help="Duration in seconds")
    parser.add_argument("--ws-url", type=str, default="ws://127.0.0.1:8000/api/v1/device/ws?client_type=viewer")
    parser.add_argument("--simulate", action="store_true", help="Record from synthetic generator instead of hardware")
    parser.add_argument("--out-dir", type=str, default=str(DEFAULT_DATA_DIR), help="Output directory")

    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    timestamp = int(time.time())
    prefix = "SIMULATED_" if args.simulate else "RECORDED_"
    filename = f"{prefix}{args.exercise}_{args.label}_{timestamp}.csv"
    out_path = out_dir / filename

    if args.simulate:
        record_simulated_session(args.exercise, args.label, args.duration, out_path)
    else:
        asyncio.run(
            record_live_websocket(
                args.ws_url,
                args.exercise,
                args.label,
                args.duration,
                out_path,
            )
        )


if __name__ == "__main__":
    main()
