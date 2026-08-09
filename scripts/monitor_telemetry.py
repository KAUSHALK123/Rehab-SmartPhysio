import asyncio
import websockets
import json

async def monitor():
    uri = "ws://127.0.0.1:8000/api/v1/device/ws?client_type=viewer"
    print("==================================================")
    print("      SmartPhysio Live Telemetry Monitor          ")
    print("==================================================")
    print(f"[+] Connecting to backend WebSocket at {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("[+] Connected successfully! Waiting for telemetry stream...\n")
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                
                # We only want to print sensor_data frames
                if data.get("type") == "sensor_data":
                    # Check if it's mock or physical data
                    source = "MOCK" if data.get("is_mock") else "PHYSICAL ESP32"
                    
                    print(f"[{source}] Telemetry Packet:")
                    print(f"  - Elbow Angle : {data.get('elbow')}°")
                    print(f"  - Wrist Roll  : {data.get('wrist_roll')}° | Pitch: {data.get('wrist_pitch')}°")
                    print(f"  - Fingers     : T:{data.get('thumb')}% | I:{data.get('index')}% | M:{data.get('middle')}% | R:{data.get('ring')}% | L:{data.get('little')}%")
                    print(f"  - Grip Force  : {data.get('pressure')} N")
                    print(f"  - MPU Status  : {'OK' if data.get('mpu_working') else 'ERROR'}")
                    print("-" * 50)
                    
    except ConnectionRefusedError:
        print("[-] Error: Connection refused. Please ensure uvicorn is running on port 8000!")
    except Exception as e:
        print(f"[-] Error: {e}")

if __name__ == "__main__":
    asyncio.run(monitor())
