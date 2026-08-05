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
const int streamInterval = 100; // 100ms = 10Hz sample rate

// Calibration limits variables (Adjust based on sensor raw readings)
int thumbMin = 1500, thumbMax = 3200;
int indexMin = 1600, indexMax = 3100;
int middleMin = 1550, middleMax = 3300;
int ringMin = 1480, ringMax = 3050;
int littleMin = 1400, littleMax = 2900;
int elbowMin = 1500, elbowMax = 3400;

// Helper maps raw ADC values to percentages
int mapFlexSensor(int rawVal, int minVal, int maxVal) {
  // Constrain raw reading
  int val = constrain(rawVal, minVal, maxVal);
  // Map raw 12-bit ADC value (0-4095) to flex percentage (0-100%)
  // 100% means fully bent, 0% means flat / straight
  return map(val, minVal, maxVal, 0, 100);
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
        }
      }
      break;
  }
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

  // 2. Initialize I2C and MPU6050
  Wire.begin();
  delay(200); // Allow I2C bus pins to settle
  Serial.println("Initializing MPU6050 Accelerometer...");
  
  // Try to detect MPU6050 on address 0x68 (up to 3 retries)
  byte error = 1;
  for (int i = 0; i < 3; i++) {
    Wire.beginTransmission(0x68);
    error = Wire.endTransmission();
    if (error == 0) {
      break;
    }
    delay(50);
  }
  
  if (error != 0) {
    Serial.println("Warning: MPU6050 chip not found! Check SDA/SCL wire connections.");
    mpuFound = false;
  } else {
    mpu.begin();
    Serial.println("MPU6050 initialized successfully. Calibrating gyro offsets (Keep sleeve static)...");
    mpu.calcGyroOffsets(true);
    mpuFound = true;
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

  // Stream data at 10Hz interval
  unsigned long currentTime = millis();
  if (wsConnected && (currentTime - lastStreamTime >= streamInterval)) {
    lastStreamTime = currentTime;

    // A. Read raw ADC values from flex and pressure sensors (12-bit, range 0 - 4095)
    int rawThumb = analogRead(PIN_THUMB);
    int rawIndex = analogRead(PIN_INDEX);
    int rawMiddle = analogRead(PIN_MIDDLE);
    int rawRing = analogRead(PIN_RING);
    int rawLittle = analogRead(PIN_LITTLE);
    int rawElbow = analogRead(PIN_ELBOW);
    int rawPressure = analogRead(PIN_PRESSURE);

    // B. Calculate mapped percentages
    int thumbFlex = mapFlexSensor(rawThumb, thumbMin, thumbMax);
    int indexFlex = mapFlexSensor(rawIndex, indexMin, indexMax);
    int middleFlex = mapFlexSensor(rawMiddle, middleMin, middleMax);
    int ringFlex = mapFlexSensor(rawRing, ringMin, ringMax);
    int littleFlex = mapFlexSensor(rawLittle, littleMin, littleMax);
    
    // Elbow straight (180 deg) down to flexed (90 deg)
    int rawElbowPercent = mapFlexSensor(rawElbow, elbowMin, elbowMax);
    int elbowAngle = 180 - map(rawElbowPercent, 0, 100, 0, 90); 

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

    // D. Build JSON Telemetry payload
    StaticJsonDocument<512> doc;
    doc["battery"] = 94; // Simulating battery status level
    doc["thumb"] = thumbFlex;
    doc["index"] = indexFlex;
    doc["middle"] = middleFlex;
    doc["ring"] = ringFlex;
    doc["little"] = littleFlex;
    doc["elbow"] = elbowAngle;
    doc["pressure"] = gripForce;
    doc["wrist_pitch"] = round(wristPitch * 10.0) / 10.0;
    doc["wrist_roll"] = round(wristRoll * 10.0) / 10.0;
    doc["mpu_working"] = mpuFound;

    // E. Serialize and send JSON string over WebSocket
    String jsonString;
    serializeJson(doc, jsonString);
    webSocket.sendTXT(jsonString);
  }
}
