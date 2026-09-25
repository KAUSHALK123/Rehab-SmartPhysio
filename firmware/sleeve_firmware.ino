/*
  SmartPhysio - Intelligent Wearable Rehabilitation Sleeve ESP32 Firmware
  
  Description:
  This firmware runs on an ESP32 microcontroller, reads raw sensor inputs from:
  1. Five analog flex sensors (Thumb, Index, Middle, Ring, Little)
  2. One elbow curl flex sensor
  3. One force pressure resistor (Grip Squeeze)
  4. One MPU6050 Inertial Measurement Unit (I2C) for Wrist Pitch/Roll
  
  And streams the telemetry as a JSON payload over a WebSocket connection to the 
  FastAPI backend server at 10Hz (100ms interval).
  
  Wiring Connection Layout:
  -------------------------------------------------------------
  Sensor Name      | Type     | ESP32 Pin | Extra Components Required
  -------------------------------------------------------------
  Thumb Flex       | Analog   | GPIO 32   | 10k Ohm Resistor in Pull-down
  Index Flex       | Analog   | GPIO 33   | 10k Ohm Resistor in Pull-down
  Middle Flex      | Analog   | GPIO 34   | 10k Ohm Resistor in Pull-down
  Ring Flex        | Analog   | GPIO 35   | 10k Ohm Resistor in Pull-down
  Little Flex      | Analog   | GPIO 36   | 10k Ohm Resistor in Pull-down
  Elbow Flex       | Analog   | GPIO 39   | 10k Ohm Resistor in Pull-down
  Pressure Squeeze | Analog   | GPIO 25   | 10k Ohm Resistor in Pull-down
  MPU6050 SDA      | I2C Data | GPIO 21   | 4.7k Ohm Pull-up to 3.3V
  MPU6050 SCL      | I2C Clock| GPIO 22   | 4.7k Ohm Pull-up to 3.3V
  -------------------------------------------------------------
  
  External Libraries Required:
  1. MPU6050_tockn (by tockn)
  2. ArduinoJson (by Benoit Blanchon)
  3. WebSockets (by Markus Sattler)
*/

#include <WiFi.h>
#include <Wire.h>
#include <MPU6050_tockn.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <Preferences.h>

// --- Wi-Fi & Server Configurations (Defaults loaded from NVS if present) ---
String wifi_ssid = "YOUR_WIFI_SSID";
String wifi_pass = "YOUR_WIFI_PASSWORD";
String server_host = "10.30.134.199";
const int server_port = 8000;

Preferences preferences;

// --- Analog Input Pins Assignment ---
const int PIN_THUMB = 32;
const int PIN_INDEX = 33;
const int PIN_MIDDLE = 34;
const int PIN_RING = 35;
const int PIN_LITTLE = 36;
const int PIN_ELBOW = 39;
const int PIN_PRESSURE = 25;

// --- Sensors Variables & Objects ---
MPU6050 mpu(Wire);
WebSocketsClient webSocket;
bool wsConnected = false;
bool mpuFound = false;
unsigned long lastStreamTime = 0;
unsigned long lastMpuRetryTime = 0;
const int streamInterval = 100; // 100ms = 10Hz sample rate

// Finger and Elbow calibration storage variables (Loaded from NVS)
int thumbStraight = 0, thumbBent = 4095;
int indexStraight = 0, indexBent = 4095;
int middleStraight = 0, middleBent = 4095;
int ringStraight = 0, ringBent = 4095;
int littleStraight = 0, littleBent = 4095;
int elbowStraight = 0, elbowBent = 4095;

// EMA Filter variables
const float emaAlpha = 0.2;
float f_thumb = -1, f_index = -1, f_middle = -1, f_ring = -1, f_little = -1, f_elbow = -1;

// Last sent angle (for deadband stabilization)
const float angleDeadband = 1.0;
float a_thumb = 0, a_index = 0, a_middle = 0, a_ring = 0, a_little = 0, a_elbow = 0;
bool sensorsStable = false;

// Helper maps filtered ADC values to angles (0 to 90 degrees)
float mapFlexAngle(float filteredVal, int straightVal, int bentVal) {
  // Determine bounds
  float low = min(straightVal, bentVal);
  float high = max(straightVal, bentVal);
  
  // Constrain reading
  float val = constrain(filteredVal, low, high);
  
  // Map to 0-90 degrees
  if (bentVal == straightVal) return 0.0; // safety
  float angle = (val - straightVal) * 90.0 / (float)(bentVal - straightVal);
  
  // Safety constrain to expected anatomical bounds
  return constrain(angle, 0.0, 90.0);
}

// WebSocket Event Handler Callback
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from server");
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to url: %s\n", payload);
      wsConnected = true;
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Received Text: %s\n", payload);
      // Process incoming commands from backend
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        const char* command = doc["command"];
        if (command && strcmp(command, "set_step") == 0) {
          const char* step = doc["step"];
          Serial.printf("[WS] Step changed to: %s\n", step);
        } else if (command && strcmp(command, "set_sensor_bounds") == 0) {
          const char* sensor = doc["sensor"];
          int strVal = doc["straight"];
          int bntVal = doc["bent"];
          
          if (!sensor) return;
          
          Serial.printf("[WS] Calibration Command: set_sensor_bounds for %s (S:%d B:%d)\n", sensor, strVal, bntVal);
          
          if (abs(strVal - bntVal) < 20) {
            Serial.printf("[FLEX] %s calibration invalid: insufficient sensor range (%d vs %d)\n", sensor, strVal, bntVal);
            return; // Ignore garbage calibration
          }
          
          preferences.begin("physio", false);
          if (strcmp(sensor, "thumb") == 0) {
            thumbStraight = strVal; thumbBent = bntVal;
            preferences.putInt("thumbStr", strVal); preferences.putInt("thumbBnt", bntVal);
          } else if (strcmp(sensor, "index") == 0) {
            indexStraight = strVal; indexBent = bntVal;
            preferences.putInt("indexStr", strVal); preferences.putInt("indexBnt", bntVal);
          } else if (strcmp(sensor, "middle") == 0) {
            middleStraight = strVal; middleBent = bntVal;
            preferences.putInt("middleStr", strVal); preferences.putInt("middleBnt", bntVal);
          } else if (strcmp(sensor, "ring") == 0) {
            ringStraight = strVal; ringBent = bntVal;
            preferences.putInt("ringStr", strVal); preferences.putInt("ringBnt", bntVal);
          } else if (strcmp(sensor, "little") == 0) {
            littleStraight = strVal; littleBent = bntVal;
            preferences.putInt("littleStr", strVal); preferences.putInt("littleBnt", bntVal);
          } else if (strcmp(sensor, "elbow") == 0) {
            elbowStraight = strVal; elbowBent = bntVal;
            preferences.putInt("elbowStr", strVal); preferences.putInt("elbowBnt", bntVal);
          }
          preferences.end();
          Serial.printf("[FLEX] Saved %s Calibration.\n", sensor);
        }
      }
      break;
  }
}

// Helper to probe I2C bus and initialize MPU6050 on address 0x68 or 0x69 (or full bus scan)
bool detectAndInitMPU(bool fullCalib) {
  byte mpuAddress = 0;
  
  Wire.beginTransmission(0x68);
  byte err68 = Wire.endTransmission();
  
  Wire.beginTransmission(0x69);
  byte err69 = Wire.endTransmission();
  
  if (err68 == 0) {
    mpuAddress = 0x68;
  } else if (err69 == 0) {
    mpuAddress = 0x69;
  } else {
    // If standard addresses fail, scan full 1-127 I2C bus to see if anything is connected
    byte anyFound = 0;
    for (byte addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0) {
        anyFound = addr;
        break;
      }
    }
    
    if (anyFound != 0) {
      Serial.printf("[I2C SCAN] Found unknown I2C device at 0x%02X (Expected MPU at 0x68 or 0x69)!\n", anyFound);
      mpuAddress = anyFound;
    } else {
      if (fullCalib) {
        Serial.printf("[I2C SCAN] No I2C response on GPIO 21 (SDA) & 22 (SCL). (Err: 0x68=%d, 0x69=%d)\n", err68, err69);
        if (err68 == 4 || err68 == 5) {
          Serial.println("--> I2C bus is STUCK or SHORTED. Check if SDA and SCL are touching or shorted to GND.");
        } else {
          Serial.println("--> Check wires: SDA must be on GPIO 21, SCL on GPIO 22. Connect AD0 to GND.");
        }
      }
    }
  }

  if (mpuAddress != 0) {
    Serial.printf("[MPU] Found chip on I2C address 0x%02X! Initializing...\n", mpuAddress);
    mpu.begin();
    if (fullCalib) {
      Serial.println("[MPU] Calibrating gyro offsets (keep sleeve still for 3s)...");
      mpu.calcGyroOffsets(true);
    } else {
      mpu.calcGyroOffsets(false);
    }
    mpuFound = true;
    Serial.println("[MPU] Sensor successfully initialized and ready!");
    return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Load preferences from non-volatile storage (NVS)
  preferences.begin("physio", false);
  String stored_ssid = preferences.getString("wifi_ssid", "");
  String stored_pass = preferences.getString("wifi_pass", "");
  String stored_host = preferences.getString("server_host", "");
  preferences.end();

  if (stored_ssid.length() > 0) {
    wifi_ssid = stored_ssid;
    wifi_pass = stored_pass;
    Serial.printf("[NVS] Loaded Wi-Fi SSID from memory: %s\n", wifi_ssid.c_str());
  } else {
    Serial.println("[NVS] No Wi-Fi configuration stored in memory. Using code defaults.");
  }
  if (stored_host.length() > 0) {
    server_host = stored_host;
    Serial.printf("[NVS] Loaded server host from memory: %s\n", server_host.c_str());
  } else {
    Serial.println("[NVS] No server host stored in memory. Using code defaults.");
  }
  
  // Load Flex Calibration
  thumbStraight = preferences.getInt("thumbStr", 0); thumbBent = preferences.getInt("thumbBnt", 4095);
  indexStraight = preferences.getInt("indexStr", 0); indexBent = preferences.getInt("indexBnt", 4095);
  middleStraight = preferences.getInt("middleStr", 0); middleBent = preferences.getInt("middleBnt", 4095);
  ringStraight = preferences.getInt("ringStr", 0); ringBent = preferences.getInt("ringBnt", 4095);
  littleStraight = preferences.getInt("littleStr", 0); littleBent = preferences.getInt("littleBnt", 4095);
  elbowStraight = preferences.getInt("elbowStr", 0); elbowBent = preferences.getInt("elbowBnt", 4095);

  if (thumbStraight == 0 && thumbBent == 4095) {
    Serial.println("[FLEX] WARNING: Calibration required for finger flex sensors.");
  }
  
  // 1. Initialize Wi-Fi Connection
  Serial.printf("\nConnecting to Wi-Fi SSID: %s\n", wifi_ssid.c_str());
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());
  
  unsigned long startWifiTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    Serial.print(".");
    
    // Check for serial configuration commands during connection block!
    if (Serial.available() > 0) {
      String serialData = Serial.readStringUntil('\n');
      serialData.trim();
      if (serialData.startsWith("SET_CONFIG:")) {
        String configData = serialData.substring(11);
        int firstComma = configData.indexOf(',');
        int secondComma = configData.indexOf(',', firstComma + 1);
        if (firstComma != -1 && secondComma != -1) {
          String newSsid = configData.substring(0, firstComma);
          String newPass = configData.substring(firstComma + 1, secondComma);
          String newHost = configData.substring(secondComma + 1);
          newSsid.trim(); newPass.trim(); newHost.trim();
          
          preferences.begin("physio", false);
          preferences.putString("wifi_ssid", newSsid);
          preferences.putString("wifi_pass", newPass);
          preferences.putString("server_host", newHost);
          preferences.end();
          
          Serial.println("\n[CONFIG] Saved new config to memory! Rebooting...");
          delay(500);
          ESP.restart();
        }
      }
    }
    
    // 10 seconds connection timeout
    if (millis() - startWifiTime > 10000) {
      Serial.println("\n[WiFi] Connection timed out! Entering offline mode.");
      break;
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected successfully!");
    Serial.print("Local IP Address: ");
    Serial.println(WiFi.localIP());
  }

  // 2. Initialize I2C and MPU6050 with explicit ESP32 pins
  Wire.begin(21, 22); // GPIO 21 = SDA, GPIO 22 = SCL
  delay(200); // Allow I2C bus pins to settle
  Serial.println("Scanning I2C bus for MPU6050 on GPIO 21 (SDA) / GPIO 22 (SCL)...");
  
  if (!detectAndInitMPU(true)) {
    Serial.println("Warning: MPU6050 chip not detected at 0x68 or 0x69 on boot!");
    Serial.println("--> 1. Check if SDA is on GPIO 21 and SCL is on GPIO 22.");
    Serial.println("--> 2. Check if AD0 pin is floating; connect AD0 to GND for address 0x68.");
    Serial.println("--> 3. Power LED on MPU only indicates VCC/GND power, NOT I2C communication.");
    Serial.println("--> 4. Auto-reconnect is active: will automatically connect as soon as wires are seated!");
    mpuFound = false;
  }

  // 3. Initialize WebSocket client connection
  // client_type=device query parameter informs backend this is the hardware device socket
  Serial.printf("Connecting to WebSocket server: %s:%d...\n", server_host.c_str(), server_port);
  webSocket.begin(server_host.c_str(), server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000); // Reconnect every 5 seconds if connection fails
}

void loop() {
  webSocket.loop();

  // Listen for serial configuration commands
  if (Serial.available() > 0) {
    String serialData = Serial.readStringUntil('\n');
    serialData.trim();
    if (serialData.startsWith("SET_CONFIG:")) {
      // Command format: SET_CONFIG:SSID,PASSWORD,SERVER_IP
      String configData = serialData.substring(11);
      int firstComma = configData.indexOf(',');
      int secondComma = configData.indexOf(',', firstComma + 1);
      
      if (firstComma != -1 && secondComma != -1) {
        String newSsid = configData.substring(0, firstComma);
        String newPass = configData.substring(firstComma + 1, secondComma);
        String newHost = configData.substring(secondComma + 1);
        
        newSsid.trim();
        newPass.trim();
        newHost.trim();
        
        Serial.println("\n[CONFIG] Received new configuration over Serial:");
        Serial.printf("SSID: %s\n", newSsid.c_str());
        Serial.printf("Host: %s\n", newHost.c_str());
        
        // Write to NVS
        preferences.begin("physio", false);
        preferences.putString("wifi_ssid", newSsid);
        preferences.putString("wifi_pass", newPass);
        preferences.putString("server_host", newHost);
        preferences.end();
        
        Serial.println("[CONFIG] Saved to NVS! Rebooting ESP32...");
        delay(1000);
        ESP.restart();
      } else {
        Serial.println("[CONFIG] Error: Invalid format. Expected: SET_CONFIG:SSID,PASSWORD,SERVER_IP");
      }
    }
  }

  unsigned long currentTime = millis();

  // Background auto-reconnect for MPU if it was disconnected or plugged after boot
  if (!mpuFound && (currentTime - lastMpuRetryTime >= 3000)) {
    lastMpuRetryTime = currentTime;
    detectAndInitMPU(false);
  }

  // Stream data at 10Hz interval
  if (currentTime - lastStreamTime >= streamInterval) {
    lastStreamTime = currentTime;

    // A. Read raw ADC values from flex and pressure sensors (12-bit, range 0 - 4095)
    int rawThumb = analogRead(PIN_THUMB);
    int rawIndex = analogRead(PIN_INDEX);
    int rawMiddle = analogRead(PIN_MIDDLE);
    int rawRing = analogRead(PIN_RING);
    int rawLittle = analogRead(PIN_LITTLE);
    int rawElbow = analogRead(PIN_ELBOW);
    int rawPressure = analogRead(PIN_PRESSURE);

    // Initialize EMA on first run
    if (f_thumb < 0) {
      f_thumb = rawThumb; f_index = rawIndex; f_middle = rawMiddle; f_ring = rawRing; f_little = rawLittle; f_elbow = rawElbow;
    } else {
      f_thumb = (emaAlpha * rawThumb) + ((1.0 - emaAlpha) * f_thumb);
      f_index = (emaAlpha * rawIndex) + ((1.0 - emaAlpha) * f_index);
      f_middle = (emaAlpha * rawMiddle) + ((1.0 - emaAlpha) * f_middle);
      f_ring = (emaAlpha * rawRing) + ((1.0 - emaAlpha) * f_ring);
      f_little = (emaAlpha * rawLittle) + ((1.0 - emaAlpha) * f_little);
      f_elbow = (emaAlpha * rawElbow) + ((1.0 - emaAlpha) * f_elbow);
    }
    
    // Check Stability (if raw variance from filtered is low across the board)
    bool isStableNow = (abs(rawThumb - f_thumb) < 8) && (abs(rawIndex - f_index) < 8) && 
                       (abs(rawMiddle - f_middle) < 8) && (abs(rawRing - f_ring) < 8) && 
                       (abs(rawLittle - f_little) < 8) && (abs(rawElbow - f_elbow) < 8);
    sensorsStable = isStableNow;

    // B. Calculate mapped angles
    float t_angle = mapFlexAngle(f_thumb, thumbStraight, thumbBent);
    if (abs(t_angle - a_thumb) > angleDeadband) a_thumb = t_angle;
    
    float i_angle = mapFlexAngle(f_index, indexStraight, indexBent);
    if (abs(i_angle - a_index) > angleDeadband) a_index = i_angle;
    
    float m_angle = mapFlexAngle(f_middle, middleStraight, middleBent);
    if (abs(m_angle - a_middle) > angleDeadband) a_middle = m_angle;
    
    float r_angle = mapFlexAngle(f_ring, ringStraight, ringBent);
    if (abs(r_angle - a_ring) > angleDeadband) a_ring = r_angle;
    
    float l_angle = mapFlexAngle(f_little, littleStraight, littleBent);
    if (abs(l_angle - a_little) > angleDeadband) a_little = l_angle;
    
    float el_angle = mapFlexAngle(f_elbow, elbowStraight, elbowBent);
    if (abs(el_angle - a_elbow) > angleDeadband) a_elbow = el_angle;

    // Grip pressure resistance force (arbitrary Newton approximation)
    int gripForce = map(constrain(rawPressure, 0, 3000), 0, 3000, 0, 800);

    // C. Read MPU6050 orientation variables
    float wristPitch = 0.0;
    float wristRoll = 0.0;
    
    if (mpuFound) {
      mpu.update();
      wristPitch = mpu.getAngleX();
      wristRoll = mpu.getAngleY();
    }

    // D. Always print readings to serial for user debugging/wiring tests
    Serial.printf("[TELEMETRY] ServerWS=%s | MPU_I2C=%s | elbow=%.1f | wrist_pitch=%.1f wrist_roll=%.1f\n",
                  wsConnected ? "CONNECTED" : "OFFLINE",
                  mpuFound ? "CONNECTED (OK)" : "DISCONNECTED (No I2C Ack)",
                  a_elbow, wristPitch, wristRoll);
    Serial.printf("[FLEX]\nThumb raw=%d filtered=%.0f angle=%.1f\nIndex raw=%d filtered=%.0f angle=%.1f\nMiddle raw=%d filtered=%.0f angle=%.1f\nRing raw=%d filtered=%.0f angle=%.1f\nLittle raw=%d filtered=%.0f angle=%.1f\n",
                  rawThumb, f_thumb, a_thumb,
                  rawIndex, f_index, a_index,
                  rawMiddle, f_middle, a_middle,
                  rawRing, f_ring, a_ring,
                  rawLittle, f_little, a_little);

    // E. Serialize and send JSON string over WebSocket only if connected
    if (wsConnected) {
      StaticJsonDocument<512> doc;
      doc["battery"] = 94; // Simulating battery status level
      doc["thumb"] = a_thumb;
      doc["index"] = a_index;
      doc["middle"] = a_middle;
      doc["ring"] = a_ring;
      doc["little"] = a_little;
      doc["elbow"] = a_elbow;
      doc["pressure"] = gripForce;
      doc["wrist_pitch"] = round(wristPitch * 10.0) / 10.0;
      doc["wrist_roll"] = round(wristRoll * 10.0) / 10.0;
      doc["mpu_working"] = mpuFound;
      doc["stable"] = sensorsStable;

      // Send Calibration Bounds for UI Display
      JsonObject bounds = doc.createNestedObject("bounds");
      bounds["thumbStr"] = thumbStraight; bounds["thumbBnt"] = thumbBent;
      bounds["indexStr"] = indexStraight; bounds["indexBnt"] = indexBent;
      bounds["middleStr"] = middleStraight; bounds["middleBnt"] = middleBent;
      bounds["ringStr"] = ringStraight; bounds["ringBnt"] = ringBent;
      bounds["littleStr"] = littleStraight; bounds["littleBnt"] = littleBent;
      bounds["elbowStr"] = elbowStraight; bounds["elbowBnt"] = elbowBent;

      // Add raw ADC telemetry fields for advanced dashboard diagnostics
      doc["raw_thumb"] = rawThumb;
      doc["raw_index"] = rawIndex;
      doc["raw_middle"] = rawMiddle;
      doc["raw_ring"] = rawRing;
      doc["raw_little"] = rawLittle;
      doc["raw_elbow"] = rawElbow;
      doc["raw_pressure"] = rawPressure;

      String jsonString;
      serializeJson(doc, jsonString);
      webSocket.sendTXT(jsonString);
    }
  }
}
