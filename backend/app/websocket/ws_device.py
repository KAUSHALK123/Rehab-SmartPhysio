import os
import asyncio
import json
import time
import math
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(
    prefix="/device",
    tags=["device-websocket"]
)

# Environment configuration: Allow mock fallback only when explicitly enabled (default "0")
ALLOW_MOCK = os.getenv("ALLOW_MOCK", "0") == "1"

# Helper to manage connected websocket clients
class ConnectionManager:
    def __init__(self):
        self.device_connections: list[WebSocket] = []
        self.viewer_connections: list[WebSocket] = []

    async def connect_device(self, websocket: WebSocket):
        await websocket.accept()
        self.device_connections.append(websocket)
        await self.broadcast_to_viewers({
            "type": "status_update",
            "status": "hardware_status_changed",
            "hardware_connected": True
        })

    def disconnect_device(self, websocket: WebSocket):
        if websocket in self.device_connections:
            self.device_connections.remove(websocket)
            asyncio.create_task(self.broadcast_to_viewers({
                "type": "status_update",
                "status": "hardware_status_changed",
                "hardware_connected": False
            }))

    async def connect_viewer(self, websocket: WebSocket):
        await websocket.accept()
        self.viewer_connections.append(websocket)
        # Notify about current hardware status
        await websocket.send_text(json.dumps({
            "type": "status_update",
            "status": "hardware_status_changed",
            "hardware_connected": len(self.device_connections) > 0
        }))

    def disconnect_viewer(self, websocket: WebSocket):
        if websocket in self.viewer_connections:
            self.viewer_connections.remove(websocket)

    async def broadcast_to_viewers(self, message: dict):
        message_str = json.dumps(message)
        dead_connections = []
        for connection in self.viewer_connections:
            try:
                await connection.send_text(message_str)
            except Exception:
                dead_connections.append(connection)
        for dc in dead_connections:
            self.disconnect_viewer(dc)

manager = ConnectionManager()

# Global device tracking state
device_state = {
    "last_packet_time": 0.0,
    "last_seq": None,
    "frame_count": 0,
    "seq_gap_count": 0,
    "mock_time": 0.0,
    "calibration_step": "idle",
    "battery": 92
}

monitor_task = None

async def telemetry_monitor_loop():
    """Background monitor that logs stats once per second and broadcasts offline status when no device is active."""
    while True:
        try:
            await asyncio.sleep(1.0)
            now = time.time()
            fps = device_state["frame_count"]
            device_state["frame_count"] = 0
            has_device_conn = len(manager.device_connections) > 0
            is_active = has_device_conn and (now - device_state["last_packet_time"] <= 1.0)

            if is_active:
                print(f"[TELEMETRY] src=esp32 seq={device_state['last_seq']} fps={fps}")
            else:
                if has_device_conn and (now - device_state["last_packet_time"] > 1.0):
                    stale_duration = now - device_state["last_packet_time"]
                    print(f"[WS WARNING] Device stale! No frame received for {stale_duration:.1f}s")

                if ALLOW_MOCK:
                    # When ALLOW_MOCK=1, every mock frame MUST include "src":"mock" so it can never be mistaken for hardware
                    device_state["mock_time"] += 1.0
                    flex_cycle = (math.sin(device_state["mock_time"] * 1.05) + 1.0) / 2.0  # 0.0 to 1.0
                    mock_curl = round(flex_cycle, 3)
                    mock_raw = int(148 - (mock_curl * 107))
                    mock_frame = {
                        "type": "sensor_data",
                        "src": "mock",
                        "seq": int(now),
                        "t": int(now * 1000),
                        "raw": [mock_raw, mock_raw, mock_raw, mock_raw, mock_raw],
                        "curl": [mock_curl, mock_curl, mock_curl, mock_curl, mock_curl],
                        "ok": [1, 1, 1, 1, 1],
                        "battery": 92,
                        "is_mock": True
                    }
                    await manager.broadcast_to_viewers(mock_frame)
                else:
                    # When ALLOW_MOCK=0 and no device frame for >1s, broadcast offline status once per second and send NO fake sensor data.
                    offline_since = int(device_state["last_packet_time"]) if device_state["last_packet_time"] > 0 else int(now)
                    await manager.broadcast_to_viewers({
                        "type": "status",
                        "state": "device_offline",
                        "since": offline_since
                    })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[WS MONITOR ERROR] {e}")

@router.on_event("startup")
async def start_monitor():
    global monitor_task
    if monitor_task is None or monitor_task.done():
        monitor_task = asyncio.create_task(telemetry_monitor_loop())

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, client_type: str = "viewer"):
    global monitor_task
    if monitor_task is None or monitor_task.done():
        monitor_task = asyncio.create_task(telemetry_monitor_loop())

    if client_type == "device":
        print("[WS] Device connecting...")
        await manager.connect_device(websocket)
        print("[WS] Device connected successfully!")
        device_state["last_seq"] = None
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    packet = json.loads(data)
                except json.JSONDecodeError:
                    continue

                # Pass real device frames through unchanged (preserve src, seq, t, raw, curl, ok)
                if not packet.get("src"):
                    packet["src"] = "esp32"
                if not packet.get("type"):
                    packet["type"] = "sensor_data"

                cur_seq = packet.get("seq")
                if cur_seq is not None:
                    if device_state["last_seq"] is not None and cur_seq != device_state["last_seq"] + 1:
                        print(f"[WS WARNING] Sequence gap detected: expected {device_state['last_seq'] + 1}, got {cur_seq}")
                        device_state["seq_gap_count"] += 1
                    device_state["last_seq"] = cur_seq

                device_state["last_packet_time"] = time.time()
                device_state["frame_count"] += 1

                # Broadcast real hardware frame unchanged to all viewers
                await manager.broadcast_to_viewers(packet)

        except WebSocketDisconnect:
            print("[WS] Device disconnected (WebSocketDisconnect)")
        except Exception as e:
            print(f"[WS] Device connection error: {e}")
        finally:
            manager.disconnect_device(websocket)

    else:  # viewer
        await manager.connect_viewer(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                command = message.get("command")

                if command == "set_step":
                    step = message.get("step")
                    device_state["calibration_step"] = step
                    await manager.broadcast_to_viewers({
                        "type": "status_update",
                        "status": "step_changed",
                        "step": step
                    })
                    for dev_conn in manager.device_connections:
                        try:
                            await dev_conn.send_text(json.dumps({
                                "command": "set_step",
                                "step": step
                            }))
                        except Exception:
                            pass

                elif command == "get_status":
                    now = time.time()
                    is_active = (len(manager.device_connections) > 0) and (now - device_state["last_packet_time"] <= 1.0)
                    await websocket.send_text(json.dumps({
                        "type": "status_update",
                        "status": "current_state",
                        "state": {
                            "calibration_step": device_state["calibration_step"],
                            "hardware_connected": is_active,
                            "allow_mock": ALLOW_MOCK,
                            "battery": device_state["battery"]
                        }
                    }))

        except WebSocketDisconnect:
            manager.disconnect_viewer(websocket)
        except Exception:
            manager.disconnect_viewer(websocket)
