from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.websocket.ws_device import manager as ws_manager

router = APIRouter(
    prefix="/device",
    tags=["device"]
)

# Shared memory state representing current device status
# Useful for simulation and checks.
device_state = {
    "connected": False,
    "battery": 95,
    "firmware": "1.0.0"
}

@router.get("/status")
def get_device_status(current_user: User = Depends(get_current_user)):
    is_connected = len(ws_manager.device_connections) > 0
    device_state["connected"] = is_connected
    return device_state

@router.post("/connect")
def connect_device(current_user: User = Depends(get_current_user)):
    device_state["connected"] = len(ws_manager.device_connections) > 0
    return {"message": "Device connected successfully", "status": device_state}

@router.post("/disconnect")
def disconnect_device(current_user: User = Depends(get_current_user)):
    # Note: WebSocket client connection handles cleanup automatically, but we update REST status as well
    device_state["connected"] = False
    return {"message": "Device disconnected successfully", "status": device_state}
