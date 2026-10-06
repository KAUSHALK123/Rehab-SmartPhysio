/*
  SmartPhysio - Intelligent Wearable Rehabilitation Sleeve ESP32 Firmware
  
  Description:
  This firmware runs on an ESP32 microcontroller, reads raw sensor inputs from:
  1. Five analog flex sensors (Thumb, Index, Middle, Ring, Little)
  2. One elbow curl flex sensor
  3. One force pressure resistor (Grip Squeeze)
  4. One MPU6050 Inertial Measurement Unit (I2C) for Wrist Pitch/Roll (Auto-detects 0x68 & 0x69)
  
  And streams the telemetry as a JSON payload over a WebSocket connection to the 
  FastAPI backend server at 20Hz (50ms interval).
  
  Wiring Connection Layout:
  -------------------------------------------------------------
  Sensor Name      | Type     | ESP32 Pin | Extra Components Required
  -------------------------------------------------------------
  Thumb Flex       | Analog   | GPIO 36 (VP)| 10k Ohm Resistor in Pull-down
  Index Flex       | Analog   | GPIO 33 (D33)| 10k Ohm Resistor in Pull-down
  Middle Flex      | Analog   | GPIO 34 (D34)| 10k Ohm Resistor in Pull-down
  Ring Flex        | Analog   | GPIO 35 (D35)| 10k Ohm Resistor in Pull-down
  Little Flex      | Analog   | GPIO 32 (D32)| 10k Ohm Resistor in Pull-down
  Elbow Flex       | Analog   | GPIO 39 (VN)| 10k Ohm Resistor in Pull-down
  Pressure Squeeze | Analog   | GPIO 25     | 10k Ohm Resistor in Pull-down
  MPU6050 SDA      | I2C Data | GPIO 21   | 4.7k Ohm Pull-up to 3.3V
  MPU6050 SCL      | I2C Clock| GPIO 22   | 4.7k Ohm Pull-up to 3.3V
  MPU6050 VCC      | Power    | 3.3V or 5V| Connect to 3.3V (or 5V if module has onboard 3.3V LDO)
  MPU6050 GND      | Ground   | GND       | Common ground with ESP32
  MPU6050 AD0      | Address  | GND/Float | Connect to GND (0x68) or 3.3V (0x69) - auto-detected!
  -------------------------------------------------------------
  
  External Libraries Required:
  1. ArduinoJson (by Benoit Blanchon)
  2. WebSockets (by Markus Sattler)
*/

#include <WiFi.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <Preferences.h>

// --- Wi-Fi & Server Configurations (Defaults loaded from NVS if present) ---
String wifi_ssid = "JioFiber-Ys2sx";
String wifi_pass = "MBMGREEN";
String server_host = "192.168.29.176";
const int server_port = 8000;

Preferences preferences;

// --- Analog Input Pins Assignment ---
// User Hardware Pinout:
// VP  (GPIO 36 / ADC1_CH0) -> Thumb Flex
// D33 (GPIO 33 / ADC1_CH5) -> Index Flex
// D34 (GPIO 34 / ADC1_CH6) -> Middle Flex
// D35 (GPIO 35 / ADC1_CH7) -> Ring Flex
// D32 (GPIO 32 / ADC1_CH4) -> Little Flex
// VN  (GPIO 39 / ADC1_CH3) -> Elbow Flex
// D25 (GPIO 25)            -> Grip Pressure Resistor
const int PIN_THUMB    = 36; // VP  (GPIO 36) -> THUMB FLEX
const int PIN_INDEX    = 33; // D33 (GPIO 33) -> INDEX FLEX
const int PIN_MIDDLE   = 34; // D34 (GPIO 34) -> MIDDLE FLEX
const int PIN_RING     = 35; // D35 (GPIO 35) -> RING FLEX
const int PIN_LITTLE   = 32; // D32 (GPIO 32) -> LITTLE FLEX
const int PIN_ELBOW    = 39; // VN  (GPIO 39) -> ELBOW FLEX
const int PIN_PRESSURE = 25; // D25 (GPIO 25) -> SQUEEZE FORCE

// --- Sensors Variables & Objects ---
WebSocketsClient webSocket;
bool wsConnected = false;
uint8_t mpuAddress = 0x68; // Auto-detected: 0x68 (AD0=GND) or 0x69 (AD0=VCC/Float)
bool mpuFound = false;
unsigned long lastStreamTime = 0;
unsigned long lastMpuRetryTime = 0;
unsigned long lastMpuUpdateTime = 0;
const int streamInterval = 50; // 50ms = 20Hz sample rate

// MPU6050 Orientation & Raw Values
float wristPitch = 0.0;
float wristRoll = 0.0;
int16_t mpuRawAx = 0, mpuRawAy = 0, mpuRawAz = 0;
int16_t mpuRawGx = 0, mpuRawGy = 0, mpuRawGz = 0;

// Finger and Elbow calibration storage variables (Defaults tuned for high sensitivity flex response)
int thumbStraight = 1400, thumbBent = 2200;
int indexStraight = 1350, indexBent = 2250;
int middleStraight = 1380, middleBent = 2280;
int ringStraight = 1400, ringBent = 2250;
int littleStraight = 1300, littleBent = 2150;
int elbowStraight = 1200, elbowBent = 2400;

// EMA Filter variables — alpha=0.7 gives instant response to micro-bends with clean filtering
const float emaAlpha = 0.7;
float f_thumb = -1, f_index = -1, f_middle = -1, f_ring = -1, f_little = -1, f_elbow = -1;

// Last sent angle (fine deadband 0.1 deg for maximum micro-bend sensitivity)
const float angleDeadband = 0.1;
float a_thumb = 0, a_index = 0, a_middle = 0, a_ring = 0, a_little = 0, a_elbow = 0;
bool sensorsStable = false;

// Helper maps filtered ADC values to angles (0 to 90 degrees)
float mapFlexAngle(float filteredVal, int straightVal, int bentVal) {
  float low = min(straightVal, bentVal);
  float high = max(straightVal, bentVal);
  float val = constrain(filteredVal, low, high);
  if (bentVal == straightVal) return 0.0;
  float angle = (val - straightVal) * 90.0 / (float)(bentVal - straightVal);
  return constrain(angle, 0.0, 90.0);
}

// ─── MPU-6050 Direct Hardware Driver (Universal 0x68 / 0x69 support) ─────────
void recoverI2CBus() {
  pinMode(21, INPUT_PULLUP);
  pinMode(22, OUTPUT);
  // Toggle clock line to clear any stuck I2C transaction
  for (int i = 0; i < 16; i++) {
    digitalWrite(22, LOW);
    delayMicroseconds(5);
    digitalWrite(22, HIGH);
    delayMicroseconds(5);
  }
  Wire.begin(21, 22);
  Wire.setTimeOut(50);
}

bool initMPUAtAddress(uint8_t addr) {
  Wire.beginTransmission(addr);
  byte err = Wire.endTransmission();
  if (err != 0) return false;

  // 1. Wake up MPU6050 (PWR_MGMT_1 = 0x00)
  Wire.beginTransmission(addr);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0x00); // Clear SLEEP bit (0 = wake up)
  if (Wire.endTransmission() != 0) return false;
  delay(10);

  // 2. Set Clock Source to X-Gyro PLL (PWR_MGMT_1 = 0x01) for best stability
  Wire.beginTransmission(addr);
  Wire.write(0x6B);
  Wire.write(0x01);
  Wire.endTransmission();
  delay(5);

  // 3. Accelerometer Config (ACCEL_CONFIG = 0x08 -> ±4g range)
  Wire.beginTransmission(addr);
  Wire.write(0x1C);
  Wire.write(0x08);
  Wire.endTransmission();

  // 4. Gyroscope Config (GYRO_CONFIG = 0x08 -> ±500 deg/s range)
  Wire.beginTransmission(addr);
  Wire.write(0x1B);
  Wire.write(0x08);
  Wire.endTransmission();

  // 5. Digital Low-Pass Filter (CONFIG = 0x03 -> 44Hz low-pass filter)
  Wire.beginTransmission(addr);
  Wire.write(0x1A);
  Wire.write(0x03);
  Wire.endTransmission();

  return true;
}

bool detectAndInitMPU(bool verbose) {
  // Try default address 0x68 (AD0 connected to GND)
  if (initMPUAtAddress(0x68)) {
    mpuAddress = 0x68;
    mpuFound = true;
    if (verbose) Serial.println("[MPU] MPU6050 found & initialized on I2C address 0x68 (AD0=GND)!");
    return true;
  }
  // Try alternate address 0x69 (AD0 connected to 3.3V or floating)
  if (initMPUAtAddress(0x69)) {
    mpuAddress = 0x69;
    mpuFound = true;
    if (verbose) Serial.println("[MPU] MPU6050 found & initialized on I2C address 0x69 (AD0=3.3V/Float)!");
    return true;
  }

  // Fallback: full I2C bus scan (1 to 127)
  for (byte addr = 1; addr < 127; addr++) {
    if (addr == 0x68 || addr == 0x69) continue;
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      if (initMPUAtAddress(addr)) {
        mpuAddress = addr;
        mpuFound = true;
        if (verbose) Serial.printf("[MPU] Found and initialized on custom I2C address 0x%02X!\n", addr);
        return true;
      }
    }
  }

  mpuFound = false;
  if (verbose) {
    Serial.println("[MPU] No MPU6050 acknowledged on I2C bus (checked 0x68 & 0x69).");
    Serial.println("--> Check wiring: SDA -> GPIO 21, SCL -> GPIO 22, VCC -> 3.3V/5V, GND -> GND.");
    Serial.println("--> Background auto-reconnect is active: will connect immediately when wire is seated.");
  }
  return false;
}

bool readMPUData() {
  if (!mpuFound) return false;

  Wire.beginTransmission(mpuAddress);
  Wire.write(0x3B); // ACCEL_XOUT_H register
  if (Wire.endTransmission(false) != 0) {
    mpuFound = false;
    return false;
  }

  // Request 14 bytes: 6 accel, 2 temp, 6 gyro
  uint8_t bytesRead = Wire.requestFrom((int)mpuAddress, 14);
  if (bytesRead < 14) {
    mpuFound = false;
    return false;
  }

  mpuRawAx = (Wire.read() << 8) | Wire.read();
  mpuRawAy = (Wire.read() << 8) | Wire.read();
  mpuRawAz = (Wire.read() << 8) | Wire.read();
  int16_t raw_temp = (Wire.read() << 8) | Wire.read();
  mpuRawGx = (Wire.read() << 8) | Wire.read();
  mpuRawGy = (Wire.read() << 8) | Wire.read();
  mpuRawGz = (Wire.read() << 8) | Wire.read();

  // Convert accel to G's (at ±4g sensitivity: 8192 LSB/g)
  float ax = (float)mpuRawAx / 8192.0;
  float ay = (float)mpuRawAy / 8192.0;
  float az = (float)mpuRawAz / 8192.0;

  // Convert gyro to deg/sec (at ±500 deg/s sensitivity: 65.5 LSB/(deg/s))
  float gx = (float)mpuRawGx / 65.5;
  float gy = (float)mpuRawGy / 65.5;

  // Compute direct anatomical pitch (flexion/extension) & roll (pronation/supination / radial/ulnar deviation)
  float accPitch = atan2(ay, sqrt(ax * ax + az * az)) * 180.0 / PI;
  float accRoll  = atan2(-ax, az) * 180.0 / PI;

  unsigned long now = millis();
  float dt = (lastMpuUpdateTime > 0) ? (now - lastMpuUpdateTime) / 1000.0 : 0.05;
  if (dt <= 0 || dt > 0.5) dt = 0.05;
  lastMpuUpdateTime = now;

  // Smooth complementary filter fusion: 95% gyro integration + 5% accelerometer correction
  static bool firstRead = true;
  if (firstRead) {
    wristPitch = accPitch;
    wristRoll  = accRoll;
    firstRead = false;
  } else {
    wristPitch = 0.95 * (wristPitch + gx * dt) + 0.05 * accPitch;
    wristRoll  = 0.95 * (wristRoll  + gy * dt) + 0.05 * accRoll;
  }

  wristPitch = constrain(wristPitch, -90.0, 90.0);
  wristRoll  = constrain(wristRoll, -180.0, 180.0);

  return true;
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
            return;
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
  thumbStraight = preferences.getInt("thumbStr", 1400); thumbBent = preferences.getInt("thumbBnt", 2200);
  indexStraight = preferences.getInt("indexStr", 1350); indexBent = preferences.getInt("indexBnt", 2250);
  middleStraight = preferences.getInt("middleStr", 1380); middleBent = preferences.getInt("middleBnt", 2280);
  ringStraight = preferences.getInt("ringStr", 1400); ringBent = preferences.getInt("ringBnt", 2250);
  littleStraight = preferences.getInt("littleStr", 1300); littleBent = preferences.getInt("littleBnt", 2150);
  elbowStraight = preferences.getInt("elbowStr", 1200); elbowBent = preferences.getInt("elbowBnt", 2400);
  
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
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
  }

  // 2. Initialize I2C and MPU6050 with explicit ESP32 pins
  recoverI2CBus();
  Serial.println("Scanning I2C bus for MPU6050 on GPIO 21 (SDA) / GPIO 22 (SCL)...");
  detectAndInitMPU(true);

  // 3. Initialize WebSocket client connection
  Serial.printf("Connecting to WebSocket server: %s:%d...\n", server_host.c_str(), server_port);
  webSocket.begin(server_host.c_str(), server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000); // Reconnect quickly (3s) if connection drops
  webSocket.enableHeartbeat(15000, 3000, 2); // Keep-alive ping every 15s to prevent router timeouts

  // 4. Configure ADC resolution & analog input pins (Full 12-bit, 0V - 3.3V range)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(PIN_THUMB, INPUT);
  pinMode(PIN_INDEX, INPUT);
  pinMode(PIN_MIDDLE, INPUT);
  pinMode(PIN_RING, INPUT);
  pinMode(PIN_LITTLE, INPUT);
  pinMode(PIN_ELBOW, INPUT);
  pinMode(PIN_PRESSURE, INPUT);
}

void loop() {
  webSocket.loop();

  // Listen for serial configuration commands
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
        
        newSsid.trim();
        newPass.trim();
        newHost.trim();
        
        Serial.println("\n[CONFIG] Received new configuration over Serial:");
        Serial.printf("SSID: %s\n", newSsid.c_str());
        Serial.printf("Host: %s\n", newHost.c_str());
        
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

  // Background auto-reconnect for MPU if disconnected or plugged in after boot
  if (!mpuFound && (currentTime - lastMpuRetryTime >= 2000)) {
    lastMpuRetryTime = currentTime;
    detectAndInitMPU(false);
  }

  // Stream data at 20Hz interval (50ms)
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
    
    // Check Stability
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

    // Grip pressure resistance force
    int gripForce = map(constrain(rawPressure, 0, 3000), 0, 3000, 0, 800);

    // C. Read MPU6050 orientation
    bool mpuReadSuccess = readMPUData();

    // D. Print readings to serial for user debugging/wiring tests
    Serial.printf("[TELEMETRY] ServerWS=%s | MPU_I2C=%s (0x%02X) | elbow=%.1f | wrist_pitch=%.1f wrist_roll=%.1f\n",
                  wsConnected ? "CONNECTED" : "OFFLINE",
                  mpuFound ? "OK" : "NO ACK",
                  mpuAddress,
                  a_elbow, wristPitch, wristRoll);

    // E. Serialize and send JSON string over WebSocket only if connected
    if (wsConnected) {
      StaticJsonDocument<512> doc;
      doc["battery"] = 94;
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

      // Raw ADC & MPU telemetry fields for advanced dashboard diagnostics
      doc["raw_thumb"] = rawThumb;
      doc["raw_index"] = rawIndex;
      doc["raw_middle"] = rawMiddle;
      doc["raw_ring"] = rawRing;
      doc["raw_little"] = rawLittle;
      doc["raw_elbow"] = rawElbow;
      doc["raw_pressure"] = rawPressure;
      doc["raw_ax"] = mpuRawAx;
      doc["raw_ay"] = mpuRawAy;
      doc["raw_az"] = mpuRawAz;
      doc["raw_gx"] = mpuRawGx;
      doc["raw_gy"] = mpuRawGy;
      doc["raw_gz"] = mpuRawGz;

      String jsonString;
      serializeJson(doc, jsonString);
      webSocket.sendTXT(jsonString);
    }
  }
}
