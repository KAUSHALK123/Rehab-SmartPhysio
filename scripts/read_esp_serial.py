import serial
import sys
import time

def main():
    print("==================================================")
    print("        SmartPhysio ESP32 Serial Logger           ")
    print("==================================================")
    
    com_port = 'COM3'
    baud_rate = 115200
    
    print(f"[+] Opening {com_port} at {baud_rate} baud...")
    try:
        ser = serial.Serial(com_port, baud_rate, timeout=1)
        # Reset the ESP32 so we capture the boot logs from the beginning
        print("[+] Resetting ESP32...")
        ser.dtr = False
        time.sleep(0.1)
        ser.dtr = True
        time.sleep(0.5)
        
        ser.reset_input_buffer()
        print("[+] Listening to ESP32 logs (Press Ctrl+C to stop)...\n")
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    print(f"[ESP32] {line}")
            time.sleep(0.01)
            
    except serial.SerialException as e:
        print(f"[-] Serial error: {e}")
        print("Please ensure your ESP32 is plugged in and no other serial monitors are open.")
    except KeyboardInterrupt:
        print("\n[+] Exiting logger.")
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    main()
