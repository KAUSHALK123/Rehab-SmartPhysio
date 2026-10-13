import asyncio
import json
import time
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(
    prefix="/device",
    tags=["device-websocket"]
)

DEBUG_WS = True

# Helper to manage connected websocket clients
class ConnectionManager:
    def __init__(self):
        self.device_connections: list[WebSocket] = []
        self.viewer_connections: list[WebSocket] = []
        self.viewer_queues: dict[WebSocket, asyncio.Queue] = {}
        self.viewer_tasks: dict[WebSocket, asyncio.Task] = {}
        self.device_msg_count_sec = 0
        self.last_metrics_log = time.time()
        self.last_broadcast_duration_ms = 0.0

    def record_device_msg(self):
        self.device_msg_count_sec += 1
        now = time.time()
        if DEBUG_WS and (now - self.last_metrics_log >= 1.0):
            elapsed = now - self.last_metrics_log
            rate = self.device_msg_count_sec / elapsed if elapsed > 0 else 0
            print(f"[WS DEBUG] Device rate: {rate:.1f} msg/s | Connected viewers: {len(self.viewer_connections)} | Last broadcast: {self.last_broadcast_duration_ms:.2f}ms")
            self.device_msg_count_sec = 0
            self.last_metrics_log = now

    async def connect_device(self, websocket: WebSocket):
        await websocket.accept()
        self.device_connections.append(websocket)
        if DEBUG_WS:
            print(f"[WS DEBUG] CONNECT device socket. Total devices: {len(self.device_connections)}")
        await self.broadcast_to_viewers({
            "type": "status_update",
            "status": "hardware_status_changed",
            "hardware_connected": True
        })

    def disconnect_device(self, websocket: WebSocket, code: int = None, exception: Exception = None):
        if websocket in self.device_connections:
            self.device_connections.remove(websocket)
            if DEBUG_WS:
                print(f"[WS DEBUG] DISCONNECT device socket. Code: {code}, Exception: {exception}. Remaining devices: {len(self.device_connections)}")
            # Notify viewers that hardware is disconnected (causes fallback to mock)
            asyncio.create_task(self.broadcast_to_viewers({
                "type": "status_update",
                "status": "hardware_status_changed",
                "hardware_connected": False
            }))

    async def _viewer_sender_loop(self, websocket: WebSocket, queue: asyncio.Queue):
        try:
            while True:
                message_str = await queue.get()
                try:
                    await asyncio.wait_for(websocket.send_text(message_str), timeout=0.5)
                except Exception as e:
                    if DEBUG_WS:
                        print(f"[WS DEBUG] Dropping slow/dead viewer client: {e}")
                    break
        except asyncio.CancelledError:
            pass
        except Exception as loop_e:
            if DEBUG_WS:
                print(f"[WS DEBUG] Viewer sender loop error: {loop_e}")
        finally:
            self.disconnect_viewer(websocket)

    async def connect_viewer(self, websocket: WebSocket):
        await websocket.accept()
        self.viewer_connections.append(websocket)
        queue = asyncio.Queue(maxsize=1)
        self.viewer_queues[websocket] = queue
        sender_task = asyncio.create_task(self._viewer_sender_loop(websocket, queue))
        self.viewer_tasks[websocket] = sender_task
        if DEBUG_WS:
            print(f"[WS DEBUG] CONNECT viewer socket. Total viewers: {len(self.viewer_connections)}")
        
        # Enqueue initial hardware status update to viewer
        init_msg = json.dumps({
            "type": "status_update",
            "status": "hardware_status_changed",
            "hardware_connected": len(self.device_connections) > 0
        })
        queue.put_nowait(init_msg)

    def disconnect_viewer(self, websocket: WebSocket, code: int = None, exception: Exception = None):
        if websocket in self.viewer_connections:
            self.viewer_connections.remove(websocket)
            if DEBUG_WS:
                print(f"[WS DEBUG] DISCONNECT viewer socket. Code: {code}, Exception: {exception}. Remaining viewers: {len(self.viewer_connections)}")
        self.viewer_queues.pop(websocket, None)
        task = self.viewer_tasks.pop(websocket, None)
        if task and not task.done():
            task.cancel()

    async def broadcast_to_viewers(self, message: dict):
        start_t = time.perf_counter()
        message_str = json.dumps(message)
        for ws, q in list(self.viewer_queues.items()):
            try:
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(message_str)
            except Exception as e:
                if DEBUG_WS:
                    print(f"[WS DEBUG] Exception enqueuing to viewer: {e}")
        self.last_broadcast_duration_ms = (time.perf_counter() - start_t) * 1000.0

manager = ConnectionManager()

# Global state for calibration steps (so viewers and simulator share it)
global_calibration_state = {
    "calibration_step": "idle", # mpu, flex, pressure, raise_arm, bend_elbow, close_hand
    "battery": 92
}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, client_type: str = "viewer"):
    if DEBUG_WS:
        print(f"[WS DEBUG] Incoming connection request from client_type={client_type}")
    if client_type == "device":
        await manager.connect_device(websocket)
        try:
            while True:
                # Receive raw telemetry reading from ESP32 with resilient timeout (120s) and ping keepalive
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=120.0)
                except asyncio.TimeoutError:
                    # Device might be idle or flex sensors unattended; send keep-alive ping before disconnecting
                    try:
                        print("[WS DEBUG] Telemetry paused for 120s. Sending keep-alive ping to device...")
                        await websocket.send_text(json.dumps({"type": "ping"}))
                        data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                    except Exception as ping_exc:
                        print(f"[WS DEBUG] Device ping timeout: {ping_exc}. Disconnecting...")
                        break

                try:
                    packet = json.loads(data)
                    if packet.get("type") == "pong":
                        continue
                    # Enforce type and is_mock flag
                    packet["type"] = "sensor_data"
                    packet["is_mock"] = False
                    packet["timestamp"] = int(time.time())
                    manager.record_device_msg()
                    # Broadcast telemetry to all listening viewer sockets (never echoing back to device)
                    await manager.broadcast_to_viewers(packet)
                except json.JSONDecodeError as json_err:
                    if DEBUG_WS:
                        print(f"[WS DEBUG] JSON decode error from device: {json_err}")
                except Exception as proc_err:
                    if DEBUG_WS:
                        print(f"[WS DEBUG] Error processing device packet: {proc_err}")
        except WebSocketDisconnect as ws_disc:
            manager.disconnect_device(websocket, code=getattr(ws_disc, 'code', None))
        except Exception as e:
            manager.disconnect_device(websocket, exception=e)
        finally:
            manager.disconnect_device(websocket)
            
    else: # viewer
        await manager.connect_viewer(websocket)
        
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
                        import math
                        flex_cycle = (math.sin(mock_time * 1.05) + 1.0) / 2.0  # 0.0 to 1.0
                        
                        if step == "close_hand":
                            finger_val = 75 + random.randint(-2, 2)
                        elif step == "bend_elbow":
                            finger_val = 5 + random.randint(-1, 1)
                        else:
                            finger_val = int(flex_cycle * 70)
                        
                        def to_adc(deg):
                            return max(0, min(4095, int((deg / 90.0) * 4095) + random.randint(-20, 20)))

                        packet = {
                            "type": "sensor_data",
                            "is_mock": True,
                            "timestamp": int(time.time()),
                            "battery": global_calibration_state["battery"],
                            
                            "thumb":  finger_val + random.randint(-2, 2),
                            "index":  finger_val + random.randint(-2, 2),
                            "middle": finger_val + random.randint(-2, 2),
                            "ring":   finger_val + random.randint(-2, 2),
                            "little": finger_val + random.randint(-2, 2),
                            
                            "raw_thumb":    to_adc(finger_val),
                            "raw_index":    to_adc(finger_val),
                            "raw_middle":   to_adc(finger_val),
                            "raw_ring":     to_adc(finger_val),
                            "raw_little":   to_adc(finger_val),
                            "raw_elbow":    to_adc(180 - (180 if step != "bend_elbow" else 90)),
                            "raw_pressure": 5 + random.randint(-1, 2) if step != "close_hand" else 650 + random.randint(-10, 10),
                            
                            "elbow": 180 + random.randint(-3, 3) if step != "bend_elbow" else 90 + random.randint(-2, 2),
                            "pressure": 5 + random.randint(-1, 2) if step != "close_hand" else 650 + random.randint(-10, 10),
                            
                            "wrist_pitch": 0.0 if step == "raise_arm" else 0.0,
                            "wrist_roll": 0.0 if step == "raise_arm" else 0.0,
                            "mpu_working": False,
                        }
                        q = manager.viewer_queues.get(websocket)
                        if q:
                            if q.full():
                                try:
                                    q.get_nowait()
                                except asyncio.QueueEmpty:
                                    pass
                            q.put_nowait(json.dumps(packet))
                    await asyncio.sleep(0.05) # 20Hz stream (matches firmware streamInterval=50ms)
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
                    status_packet = {
                        "type": "status_update",
                        "status": "current_state",
                        "state": {
                            "calibration_step": global_calibration_state["calibration_step"],
                            "hardware_connected": len(manager.device_connections) > 0,
                            "battery": global_calibration_state["battery"]
                        }
                    }
                    q = manager.viewer_queues.get(websocket)
                    if q:
                        if q.full():
                            try:
                                q.get_nowait()
                            except asyncio.QueueEmpty:
                                pass
                        q.put_nowait(json.dumps(status_packet))
                    
        except WebSocketDisconnect as ws_disc:
            manager.disconnect_viewer(websocket, code=getattr(ws_disc, 'code', None))
            if streaming_task:
                streaming_task.cancel()
        except Exception as e:
            manager.disconnect_viewer(websocket, exception=e)
            if streaming_task:
                streaming_task.cancel()
