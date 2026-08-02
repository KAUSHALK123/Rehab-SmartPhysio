import pytest
import json
from fastapi.testclient import TestClient
from app.config.config import settings

def test_websocket_viewer_connect(client):
    # Connecting a viewer should return initial status
    with client.websocket_connect(f"{settings.API_V1_STR}/device/ws?client_type=viewer") as websocket:
        data = websocket.receive_text()
        packet = json.loads(data)
        assert packet["type"] == "status_update"
        assert packet["status"] == "hardware_status_changed"
        assert packet["hardware_connected"] is False

def test_websocket_device_and_viewer_relay(client):
    # Connect a viewer first
    with client.websocket_connect(f"{settings.API_V1_STR}/device/ws?client_type=viewer") as viewer_ws:
        # Get viewer's initial status message
        initial_msg = json.loads(viewer_ws.receive_text())
        assert initial_msg["hardware_connected"] is False

        # Connect a device
        with client.websocket_connect(f"{settings.API_V1_STR}/device/ws?client_type=device") as device_ws:
            # Viewer should receive a status update that hardware connected
            conn_msg = {}
            for _ in range(20):
                msg = json.loads(viewer_ws.receive_text())
                if msg.get("type") == "status_update":
                    conn_msg = msg
                    break
            assert conn_msg.get("type") == "status_update"
            assert conn_msg.get("status") == "hardware_status_changed"
            assert conn_msg.get("hardware_connected") is True

            # Send telemetry data from device
            telemetry_payload = {
                "battery": 95,
                "thumb": 10,
                "index": 12,
                "middle": 15,
                "ring": 10,
                "little": 8,
                "elbow": 180,
                "pressure": 50,
                "wrist_pitch": 15.5,
                "wrist_roll": -2.3
            }
            device_ws.send_text(json.dumps(telemetry_payload))

            # Viewer should receive the telemetry packet
            received_data = {}
            for _ in range(20):
                msg = json.loads(viewer_ws.receive_text())
                # We expect sensor_data with is_mock = False
                if msg.get("type") == "sensor_data" and not msg.get("is_mock", True):
                    received_data = msg
                    break
            assert received_data.get("type") == "sensor_data"
            assert received_data.get("is_mock") is False
            assert received_data.get("battery") == 95
            assert received_data.get("elbow") == 180

        # After device disconnects, viewer should receive disconnection status update
        disc_msg = {}
        for _ in range(20):
            msg = json.loads(viewer_ws.receive_text())
            if msg.get("type") == "status_update":
                disc_msg = msg
                break
        assert disc_msg.get("type") == "status_update"
        assert disc_msg.get("status") == "hardware_status_changed"
        assert disc_msg.get("hardware_connected") is False

