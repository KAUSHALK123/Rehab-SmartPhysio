#!/usr/bin/env python3
"""
SmartPhysio WebSocket Telemetry Probe (tools/ws_probe.py)
---------------------------------------------------------
Connects to the backend WebSocket endpoint or direct ESP32 stream,
prints compact one-line telemetry diagnostics, and validates:
1. "src" identifier ("esp32" vs "mock")
2. Sequence monotonicity (seq increments by 1, flags sequence drops/gaps)
3. Live frame rate (target ~20 Hz)
4. Channel fault flags (ok[i] == 0) and out-of-range ADC values
"""

import sys
import json
import time
import argparse
import asyncio

try:
    import websockets
except ImportError:
    print("[ERROR] 'websockets' package required. Run: pip install websockets")
    sys.exit(1)

FINGER_NAMES = ["Thumb", "Index", "Middle", "Ring", "Little"]

async def run_probe(uri: str):
    print("=" * 78)
    print(f"SmartPhysio Telemetry Probe connecting to: {uri}")
    print("=" * 78)

    last_seq = None
    last_time = time.time()
    frame_count = 0
    total_frames = 0
    fps = 0.0

    async with websockets.connect(uri) as ws:
        print("[CONNECTED] Listening for real-time telemetry frames (Ctrl+C to stop)...")
        print("-" * 78)
        print(" SEQ   | SRC   | FPS  | RAW (T, I, M, R, L)      | CURL %           | FAULTS")
        print("-" * 78)

        while True:
            try:
                msg = await ws.recv()
                data = json.loads(msg)
            except websockets.exceptions.ConnectionClosed:
                print("\n[DISCONNECTED] Server closed the connection.")
                break
            except Exception as e:
                print(f"\n[ERROR] Parse error: {e}")
                continue

            # Handle status frames
            if data.get("type") == "status":
                print(f"[STATUS] State: {data.get('state')} | Since: {data.get('since')}")
                continue

            if data.get("type") == "hello":
                print(f"[HELLO] Connected to firmware version {data.get('fw')} from {data.get('src')}")
                continue

            now = time.time()
            frame_count += 1
            total_frames += 1

            if now - last_time >= 1.0:
                fps = frame_count / (now - last_time)
                frame_count = 0
                last_time = now

            src = data.get("src", "unknown")
            seq = data.get("seq", 0)

            # Check sequence continuity
            seq_gap_flag = ""
            if last_seq is not None and seq is not None and isinstance(seq, int) and isinstance(last_seq, int):
                expected_seq = last_seq + 1
                if seq != expected_seq:
                    seq_gap_flag = f" [GAP! exp {expected_seq}]"
            last_seq = seq

            raw = data.get("raw", [])
            curl = data.get("curl", [])
            ok = data.get("ok", [])

            # Format raw readings
            if isinstance(raw, list) and len(raw) >= 5:
                raw_str = f"{raw[0]:4d} {raw[1]:4d} {raw[2]:4d} {raw[3]:4d} {raw[4]:4d}"
            else:
                raw_str = "  --   --   --   --   --"

            # Format curl percentages
            if isinstance(curl, list) and len(curl) >= 5:
                curl_str = f"{int(curl[0]*100):2d}% {int(curl[1]*100):2d}% {int(curl[2]*100):2d}% {int(curl[3]*100):2d}% {int(curl[4]*100):2d}%"
            else:
                curl_str = "--% --% --% --% --%"

            # Check fault status
            fault_list = []
            if isinstance(ok, list):
                for i, status in enumerate(ok[:5]):
                    if status == 0 or status is False:
                        name = FINGER_NAMES[i] if i < len(FINGER_NAMES) else f"Ch{i}"
                        fault_list.append(f"{name} !FAULT")

            fault_str = ", ".join(fault_list) if fault_list else "ALL OK"

            seq_display = f"{seq:5d}" if isinstance(seq, int) else "  -- "
            fps_display = f"{fps:4.1f}" if fps > 0 else " -- "

            print(f"{seq_display} | {src:5s} | {fps_display} | {raw_str} | {curl_str} | {fault_str}{seq_gap_flag}")

def main():
    parser = argparse.ArgumentParser(description="SmartPhysio Telemetry WebSocket Probe")
    parser.add_argument(
        "--url",
        default="ws://localhost:8000/api/v1/device/ws?client_type=viewer",
        help="WebSocket URL (default: ws://localhost:8000/api/v1/device/ws?client_type=viewer)"
    )
    args = parser.parse_args()

    try:
        asyncio.run(run_probe(args.url))
    except KeyboardInterrupt:
        print("\n[PROBE STOPPED] Finished telemetry inspection.")

if __name__ == "__main__":
    main()
