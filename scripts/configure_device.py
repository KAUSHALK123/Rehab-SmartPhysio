import socket
import subprocess
import sys
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("Error: 'pyserial' library is required to run this script.")
    print("Please install it by running: pip install pyserial")
    sys.exit(1)

def get_host_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def get_wifi_ssid():
    try:
        output = subprocess.check_output("netsh wlan show interfaces", shell=True, errors='ignore')
        for line in output.split('\n'):
            if "SSID" in line and "BSSID" not in line:
                return line.split(":")[1].strip()
    except Exception:
        pass
    return ""

def main():
    print("==================================================")
    print("      SmartPhysio ESP32 Auto-Configurator         ")
    print("==================================================")
    
    # 1. Detect Host IP
    host_ip = get_host_ip()
    print(f"[+] Detected Host Machine IP: {host_ip}")
    
    # 2. Detect Wifi SSID
    detected_ssid = get_wifi_ssid()
    if detected_ssid:
        print(f"[+] Detected Connected Wi-Fi SSID: {detected_ssid}")
    else:
        print("[-] Could not automatically detect Wi-Fi SSID.")
        
    wifi_ssid = input(f"Enter Wi-Fi SSID [{detected_ssid}]: ").strip()
    if not wifi_ssid:
        wifi_ssid = detected_ssid
        
    if not wifi_ssid:
        print("Error: Wi-Fi SSID is required.")
        sys.exit(1)
        
    wifi_pass = input("Enter Wi-Fi Password: ").strip()
    
    server_ip = input(f"Enter Server Host IP [{host_ip}]: ").strip()
    if not server_ip:
        server_ip = host_ip
        
    # 3. Detect COM ports
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("\n[-] Error: No serial ports (COM ports) detected. Check USB connection to ESP32.")
        sys.exit(1)
        
    print("\nAvailable Serial Ports:")
    for idx, port in enumerate(ports):
        print(f"  [{idx + 1}] {port.device} - {port.description}")
        
    port_selection = input(f"Select ESP32 COM Port [1-{len(ports)}]: ").strip()
    try:
        port_idx = int(port_selection) - 1
        if port_idx < 0 or port_idx >= len(ports):
            raise ValueError
        com_port = ports[port_idx].device
    except ValueError:
        com_port = ports[0].device
        print(f"[!] Invalid selection, defaulting to {com_port}")
        
    # 4. Open serial and send configuration
    print(f"\n[+] Connecting to ESP32 on {com_port} at 115200 baud...")
    try:
        ser = serial.Serial(com_port, 115200, timeout=2)
        # Toggle DTR/RTS to reset ESP32
        ser.dtr = False
        time.sleep(0.1)
        ser.dtr = True
        time.sleep(0.5)
        
        # Flush serial buffers
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Build command payload
        payload = f"SET_CONFIG:{wifi_ssid},{wifi_pass},{server_ip}\n"
        print(f"[+] Sending configuration payload to device...")
        ser.write(payload.encode('utf-8'))
        
        # Monitor response
        print("[+] Monitoring Serial Output from ESP32 (Timeout 10s):")
        start_time = time.time()
        while time.time() - start_time < 10:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    print(f"  [ESP32] {line}")
                    if "Rebooting ESP32" in line or "Restarting ESP32" in line:
                        print("\n[+] SUCCESS: ESP32 has saved the new configuration and is rebooting!")
                        break
            time.sleep(0.1)
            
        ser.close()
    except Exception as e:
        print(f"[-] Serial error: {e}")
        
    print("\nConfiguration process finished.")

if __name__ == "__main__":
    main()
