import asyncio
import json
import time
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(
    prefix="/device",
    tags=["device-websocket"]
)

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
            # Notify viewers that hardware is disconnected (causes fallback to mock)
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

# Global state for calibration steps (so viewers and simulator share it)
global_calibration_state = {
    "calibration_step": "idle", # mpu, flex, pressure, raise_arm, bend_elbow, close_hand
    "battery": 92
}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, client_type: str = "viewer"):
    print(f"[WS] Incoming connection request from client_type={client_type}")
    if client_type == "device":
        print("[WS] Device connecting...")
        await manager.connect_device(websocket)
        print("[WS] Device connected successfully!")
        try:
            while True:
                # Receive raw telemetry reading from ESP32 with a 3.0-second timeout
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
                except asyncio.TimeoutError:
                    print("[WS] Device telemetry timeout: No data received for 3 seconds. Disconnecting...")
                    break
                try:
                    packet = json.loads(data)
                    # Enforce type and is_mock flag
                    packet["type"] = "sensor_data"
                    packet["is_mock"] = False
                    packet["timestamp"] = int(time.time())
                    # Broadcast telemetry to all listening viewer sockets
                    await manager.broadcast_to_viewers(packet)
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            print("[WS] Device disconnected (WebSocketDisconnect)")
        except Exception as e:
            print(f"[WS] Device connection error: {e}")
        finally:
            manager.disconnect_device(websocket)
            
    else: # viewer
        print("[WS] Viewer connecting...")
        await manager.connect_viewer(websocket)
        print("[WS] Viewer connected successfully!")
        
        # State flags for local simulation loop if no physical device is active
        streaming_task = None
        
        # Track animation time for smooth mock demo
        mock_time = 0.0
        
        async def stream_mock_data():
            nonlocal mock_time
            try:
                while True:
                    # Only send mock data if no physical device is currently streaming!
                    if len(manager.device_connections) == 0:
                        step = global_calibration_state["calibration_step"]
                        mock_time += 0.1  # Advance time by 100ms per tick
                        
                        # Sinusoidal animation: fingers smoothly open (0°) and close (70°)
                        # Period ~6 seconds, one full open-close cycle
                        import math
                        flex_cycle = (math.sin(mock_time * 1.05) + 1.0) / 2.0  # 0.0 to 1.0
                        
                        if step == "close_hand":
                            # Force close position for calibration steps
                            finger_val = 75 + random.randint(-2, 2)
                        elif step == "bend_elbow":
                            finger_val = 5 + random.randint(-1, 1)
                        else:
                            # Smooth animated open/close (0=straight, 70=bent)
                            finger_val = int(flex_cycle * 70)
                        
                        packet = {
                            "type": "sensor_data",
                            "is_mock": True,
                            "timestamp": int(time.time()),
                            "battery": global_calibration_state["battery"],
                            
                            # Angles in degrees 0=straight, 90=fully bent — matching real firmware
                            "thumb":  finger_val + random.randint(-2, 2),
                            "index":  finger_val + random.randint(-2, 2),
                            "middle": finger_val + random.randint(-2, 2),
                            "ring":   finger_val + random.randint(-2, 2),
                            "little": finger_val + random.randint(-2, 2),
                            
                            # Elbow: 180=straight, 90=bent
                            "elbow": 180 + random.randint(-3, 3) if step != "bend_elbow" else 90 + random.randint(-2, 2),
                            "pressure": 5 + random.randint(-1, 2) if step != "close_hand" else 650 + random.randint(-10, 10),
                            
                            "wrist_pitch": 5.0 + random.uniform(-0.5, 0.5) if step != "raise_arm" else 65.0 + random.uniform(-1.0, 1.0),
                            "wrist_roll": 0.0 + random.uniform(-0.5, 0.5) if step != "raise_arm" else 12.0 + random.uniform(-1.0, 1.0),
                        }
                        await websocket.send_text(json.dumps(packet))
                    await asyncio.sleep(0.1) # 10Hz stream
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        try:
            streaming_task = asyncio.create_task(stream_mock_data())
            while True:
                # Viewers can send commands (e.g. set_step during calibration)
                data = await websocket.receive_text()
                message = json.loads(data)
                command = message.get("command")
                
                if command == "set_step":
                    step = message.get("step")
                    global_calibration_state["calibration_step"] = step
                    
                    # Notify viewers of step change
                    await manager.broadcast_to_viewers({
                        "type": "status_update",
                        "status": "step_changed",
                        "step": step
                    })
                    
                    # Relay to physical devices if any are connected
                    for dev_conn in manager.device_connections:
                        try:
                            await dev_conn.send_text(json.dumps({
                                "command": "set_step",
                                "step": step
                            }))
                        except Exception:
                            pass
                
                elif command == "get_status":
                    await websocket.send_text(json.dumps({
                        "type": "status_update",
                        "status": "current_state",
                        "state": {
                            "calibration_step": global_calibration_state["calibration_step"],
                            "hardware_connected": len(manager.device_connections) > 0,
                            "battery": global_calibration_state["battery"]
                        }
                    }))
                    
        except WebSocketDisconnect:
            manager.disconnect_viewer(websocket)
            if streaming_task:
                streaming_task.cancel()
        except Exception:
            manager.disconnect_viewer(websocket)
            if streaming_task:
                streaming_task.cancel()
