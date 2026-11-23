/*
  SmartPhysio - Intelligent Wearable Rehabilitation Sleeve ESP32 Firmware
  Version: 1.2.0

  Single Source of Truth Pinout (all ADC1 channels, Wi-Fi safe):
  -----------------------------------------------------------------
  Finger / Sensor | Pin           | ADC Channel | External Resistor
  -----------------------------------------------------------------
  Thumb Flex      | GPIO 36 (VP)  | ADC1_CH0    | 10k-22kΩ Pull-down to GND + 0.1µF to GND
  Index Flex      | GPIO 33 (D33) | ADC1_CH5    | 10k-22kΩ Pull-down to GND + 0.1µF to GND
  Middle Flex     | GPIO 34 (D34) | ADC1_CH6    | 10k-22kΩ Pull-down to GND + 0.1µF to GND
  Ring Flex       | GPIO 35 (D35) | ADC1_CH7    | 10k-22kΩ Pull-down to GND + 0.1µF to GND
  Little Flex     | GPIO 32 (D32) | ADC1_CH4    | 10k-22kΩ Pull-down to GND + 0.1µF to GND
  Elbow Flex      | GPIO 39 (VN)  | ADC1_CH3    | 10kΩ Pull-down to GND
  Pressure Force  | GPIO 25 (D25) | ADC2        | 10kΩ Pull-down to GND
  MPU6050 SDA     | GPIO 21 (D21) | I2C Data    | 4.7kΩ Onboard Pull-up to 3.3V
  MPU6050 SCL     | GPIO 22 (D22) | I2C Clock   | 4.7kΩ Onboard Pull-up to 3.3V
  -----------------------------------------------------------------

  Circuit per channel:
  3.3V -> Flex Sensor -> Node (to GPIO Pin) -> Fixed Resistor -> GND
                         Node -> 0.1µF Ceramic Capacitor -> GND
*/

#include <WiFi.h>
#include <Wire.h>
#include <MPU6050_tockn.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <Preferences.h>

// ============================================================================
// SINGLE SOURCE OF TRUTH PINOUT DEFINITION
// ============================================================================
const int NUM_FINGERS = 5;
const int FINGER_PINS[NUM_FINGERS]   = {36, 33, 34, 35, 32};
const char* FINGER_NAMES[NUM_FINGERS] = {"Thumb", "Index", "Middle", "Ring", "Little"};

const int PIN_ELBOW    = 39; // VN (GPIO 39)
const int PIN_PRESSURE = 25; // D25 (GPIO 25)

// ============================================================================
// SPARKFUN RESISTANCE-BASED FLEX SENSOR ENGINE
// ============================================================================
// Circuit: 3.3V -> Flex Sensor -> Node (GPIO Pin) -> 10k Resistor -> GND
// Formula: R_flex = R_div * (ADC_MAX / adcVal - 1.0)
const float R_DIV   = 10000.0f; // 10k fixed pull-down resistor to GND
const float ADC_MAX = 4095.0f; // ESP32 12-bit ADC

// Compute real-time flex resistance in Ohms from ADC
float computeResistance(int adcVal) {
  if (adcVal <= 10) return 999999.0f; // Disconnected / open circuit
  if (adcVal >= 4085) return 0.0f;    // Shorted to 3.3V rail
  return R_DIV * (ADC_MAX / (float)adcVal - 1.0f);
}

// Measured straight baseline resistance (Ohms) - measured at boot
float rStraight[NUM_FINGERS] = {25000.0f, 24000.0f, 25000.0f, 27000.0f, 29000.0f};

// Dynamic bend resistance span (Ohms) - typical finger bend is +10k to +20k Ohms above straight
float rBendSpan[NUM_FINGERS] = {12000.0f, 10000.0f, 15000.0f, 15000.0f, 10000.0f};

// Initial ADC defaults for fallback diagnostics
int calibFlat[NUM_FINGERS] = {250, 1205, 625, 900, 940};

// Fault detection thresholds (Named Constants)
const int RAW_MIN_FAULT    = 10;   // Pulled to GND / short / unplugged with pulldown
const int RAW_MAX_FAULT    = 4085; // Pulled to 3.3V rail / open circuit
const int SPREAD_MAX_FAULT = 150;  // High ADC sample spread -> floating pin / extreme noise
const float DEADZONE_OHMS  = 350.0f; // Resistance deadzone: 350 Ohms (suppresses resting noise)
const float EMA_ALPHA[NUM_FINGERS] = {0.50f, 0.40f, 0.40f, 0.50f, 0.40f};

// ============================================================================
// WI-FI & SERVER CONFIGURATION
// ============================================================================
String wifi_ssid   = "JioFiber-Ys2sx";
String wifi_pass   = "MBMGREEN";
String server_host = "192.168.29.176";
const int server_port = 8000;

Preferences preferences;
MPU6050 mpu(Wire);
WebSocketsClient webSocket;

// ML-COACH HOOK: Hardware Constants & IMU Telemetry State
const int PIN_MPU_SDA = 21;
const int PIN_MPU_SCL = 22;
const uint8_t MPU_I2C_ADDR = 0x68;
const float MPU_FILTER_ALPHA = 0.98f;

uint32_t imuSeq = 0;
unsigned long lastImuStreamTime = 0;
const int imuStreamInterval = 20; // 20ms = 50 Hz

float compPitch = 0.0f;
float compRoll = 0.0f;
float compYaw = 0.0f;
float pitchOffset = 0.0f;
float rollOffset = 0.0f;
float yawOffset = 0.0f;
unsigned long lastCompFilterTime = 0;
bool mpuWarned = false;
// END ML-COACH HOOK

bool wsConnected = false;
bool mpuFound = false;
uint32_t seq = 0;
unsigned long lastStreamTime = 0;
unsigned long lastSerialLogTime = 0;
unsigned long lastReconnectLogTime = 0;
unsigned long lastMpuRetryTime = 0;
const int streamInterval = 50; // 50ms = 20 Hz frame rate

// Working sensor arrays
int rawValues[NUM_FINGERS]    = {0, 0, 0, 0, 0};
float curlValues[NUM_FINGERS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
int okFlags[NUM_FINGERS]      = {1, 1, 1, 1, 1};
float lastGoodCurl[NUM_FINGERS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};

// ============================================================================
// OVERSAMPLED ADC ACQUISITION WITH SPREAD (NOISE) TRACKING
// ============================================================================
int readOversampled(int pin, int* spread = nullptr) {
  volatile int dummy = analogRead(pin); // mux settle
  (void)dummy;
  delayMicroseconds(20);
  int minVal = 4095;
  int maxVal = 0;
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    int val = analogRead(pin);
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    sum += val;
    delayMicroseconds(30);
  }
  if (spread != nullptr) {
    *spread = maxVal - minVal;
  }
  return (int)(sum >> 4);
}

// ============================================================================
// WEBSOCKET EVENT HANDLER
// ============================================================================
void sendHelloFrame() {
  StaticJsonDocument<256> hello;
  hello["type"] = "hello";
  hello["src"] = "esp32";
  JsonObject pins = hello.createNestedObject("pins");
  pins["Thumb"] = 36;
  pins["Index"] = 33;
  pins["Middle"] = 34;
  pins["Ring"] = 35;
  pins["Little"] = 32;
  hello["fw"] = "1.2.0";

  String helloStr;
  serializeJson(hello, helloStr);
  webSocket.sendTXT(helloStr);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      wsConnected = true;
      sendHelloFrame();
      break;
    case WStype_TEXT:
      if (payload && length > 0) {
        String msg = String((char*)payload);
        if (msg.indexOf("\"zero\"") >= 0 || msg.indexOf("imu_zero") >= 0) {
          pitchOffset = compPitch;
          rollOffset = compRoll;
          yawOffset = compYaw;
          preferences.begin("coach_calib", false);
          preferences.putFloat("pitch_off", pitchOffset);
          preferences.putFloat("roll_off", rollOffset);
          preferences.putFloat("yaw_off", yawOffset);
          preferences.end();
          Serial.println("[WS] Zero-pose calibration stored via WebSocket command.");
        }
      }
      break;
    default:
      break;
  }
}

// ============================================================================
// MPU6050 INITIALIZATION
// ============================================================================
void initMPU() {
  Wire.begin(PIN_MPU_SDA, PIN_MPU_SCL);
  Wire.setClock(400000);
  Wire.beginTransmission(MPU_I2C_ADDR);
  if (Wire.endTransmission() == 0) {
    mpu.begin();
    mpu.calcGyroOffsets(false);
    mpuFound = true;
    mpuWarned = false;
  } else {
    mpuFound = false;
    // ML-COACH HOOK: Rate-limited non-blocking warning (fingers continue operating)
    if (!mpuWarned) {
      Serial.println("[MPU WARNING] MPU6050 not detected at 0x68. IMU frames disabled; fingers continue operating.");
      mpuWarned = true;
    }
  }
}

// ============================================================================
// SETUP
// ============================================================================
void calibrateFlexBaselines() {
  Serial.println("\n[CALIB] Auto-calibrating resting resistance (SparkFun logic - keep hand flat)...");
  long sum[NUM_FINGERS] = {0, 0, 0, 0, 0};
  const int SAMPLES = 25;
  for (int s = 0; s < SAMPLES; s++) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      int rawVal = readOversampled(FINGER_PINS[i]);
      sum[i] += rawVal;
    }
    delay(10);
  }
  for (int i = 0; i < NUM_FINGERS; i++) {
    int avgAdc = (int)(sum[i] / SAMPLES);
    calibFlat[i] = avgAdc;
    rStraight[i] = computeResistance(avgAdc);
  }
  // Adaptive bend spans in Ohms: default to +10k..+15k above straight
  rBendSpan[0] = 12000.0f;
  rBendSpan[1] = 10000.0f;
  rBendSpan[2] = 15000.0f;
  rBendSpan[3] = 15000.0f;
  rBendSpan[4] = 10000.0f;

  Serial.println("=========================================================================");
  Serial.printf("[CALIB DONE] Straight R: T=%.1fkΩ, I=%.1fkΩ, M=%.1fkΩ, R=%.1fkΩ, L=%.1fkΩ\n",
                rStraight[0]/1000.0f, rStraight[1]/1000.0f, rStraight[2]/1000.0f, rStraight[3]/1000.0f, rStraight[4]/1000.0f);
  Serial.println("[CALIB] Ready! Type 'c' or 'r' in Serial Monitor to re-zero baseline anytime.");
  Serial.println("=========================================================================\n");
}

void setup() {
  Serial.begin(115200);

  // Load preferences if saved
  preferences.begin("physio", false);
  String stored_ssid = preferences.getString("wifi_ssid", "");
  String stored_pass = preferences.getString("wifi_pass", "");
  String stored_host = preferences.getString("server_host", "");
  preferences.end();

  if (stored_ssid.length() > 0) wifi_ssid = stored_ssid;
  if (stored_pass.length() > 0) wifi_pass = stored_pass;
  if (stored_host.length() > 0) server_host = stored_host;

  // Configure ADC for full 12-bit resolution and 11dB attenuation
  analogReadResolution(12);
  for (int i = 0; i < NUM_FINGERS; i++) {
    analogSetPinAttenuation(FINGER_PINS[i], ADC_11db);
    pinMode(FINGER_PINS[i], INPUT);
  }
  analogSetPinAttenuation(PIN_ELBOW, ADC_11db);
  pinMode(PIN_ELBOW, INPUT);
  pinMode(PIN_PRESSURE, INPUT);

  initMPU();

  // ML-COACH HOOK: Load stored zero-pose calibration offsets from Preferences
  preferences.begin("coach_calib", true);
  pitchOffset = preferences.getFloat("pitch_off", 0.0f);
  rollOffset = preferences.getFloat("roll_off", 0.0f);
  preferences.end();
  // END ML-COACH HOOK

  // Connect to Wi-Fi
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());

  // Configure WebSocket Client to FastAPI backend
  webSocket.begin(server_host.c_str(), server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);

  // Auto-calibrate flex baselines to current resting hand position
  calibrateFlexBaselines();

  Serial.println("[BOOT] SmartPhysio ESP32 Glove Firmware v1.2.0 ready.");
  Serial.println("[BOOT] Pinout: Thumb:36 Index:33 Middle:34 Ring:35 Little:32");
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  webSocket.loop();

  unsigned long currentTime = millis();

  // Rate-limited reconnect logging (once every 3 seconds)
  if (!wsConnected && (currentTime - lastReconnectLogTime >= 3000)) {
    lastReconnectLogTime = currentTime;
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[NET] Wi-Fi OK (%s). Connecting WS to %s:%d...\n", WiFi.localIP().toString().c_str(), server_host.c_str(), server_port);
    } else {
      Serial.println("[NET] Wi-Fi connecting...");
    }
  }

  // Periodic MPU reconnect check if disconnected
  if (!mpuFound && (currentTime - lastMpuRetryTime >= 3000)) {
    lastMpuRetryTime = currentTime;
    initMPU();
  }

  // Serial commands: 'z' for MPU zero-pose, 'c' or 'r' for Flex baselines recalibration
  if (Serial.available() > 0) {
    char ch = Serial.read();
    if (ch == 'z' || ch == 'Z') {
      pitchOffset = compPitch;
      rollOffset = compRoll;
      preferences.begin("coach_calib", false);
      preferences.putFloat("pitch_off", pitchOffset);
      preferences.putFloat("roll_off", rollOffset);
      preferences.end();
      Serial.printf("[COACH CALIB] Zero-pose stored: pitch_off=%.2f, roll_off=%.2f\n", pitchOffset, rollOffset);
    } else if (ch == 'c' || ch == 'C' || ch == 'r' || ch == 'R') {
      calibrateFlexBaselines();
    }
  }

  // ==========================================================================
  // ML-COACH HOOK: 50 Hz COMPLEMENTARY FILTER & IMU STREAM (20 ms interval)
  // ==========================================================================
  if (mpuFound && (currentTime - lastImuStreamTime >= imuStreamInterval)) {
    float dt = (lastCompFilterTime > 0) ? (float)(currentTime - lastCompFilterTime) / 1000.0f : 0.02f;
    lastCompFilterTime = currentTime;
    lastImuStreamTime = currentTime;

    mpu.update();

    float ax = mpu.getAccX();
    float ay = mpu.getAccY();
    float az = mpu.getAccZ();
    float gx = mpu.getGyroX();
    float gy = mpu.getGyroY();
    float gz = mpu.getGyroZ();

    // Accelerometer tilt estimation
    float accelPitch = atan2(-ax, sqrt(ay * ay + az * az)) * 180.0f / PI;
    float accelRoll  = atan2(ay, az) * 180.0f / PI;

    // Complementary filter (alpha ~ 0.98)
    compPitch = MPU_FILTER_ALPHA * (compPitch + gy * dt) + (1.0f - MPU_FILTER_ALPHA) * accelPitch;
    compRoll  = MPU_FILTER_ALPHA * (compRoll + gx * dt) + (1.0f - MPU_FILTER_ALPHA) * accelRoll;
    compYaw  += gz * dt;

    float adjPitch = compPitch - pitchOffset;
    float adjRoll  = compRoll - rollOffset;
    float adjYaw   = compYaw - yawOffset;

    // Convert Euler angles (in radians) to quaternion
    float pRad = adjPitch * DEG_TO_RAD * 0.5f;
    float rRad = adjRoll  * DEG_TO_RAD * 0.5f;
    float yRad = adjYaw   * DEG_TO_RAD * 0.5f;

    float cp = cos(pRad); float sp = sin(pRad);
    float cr = cos(rRad); float sr = sin(rRad);
    float cy = cos(yRad); float sy = sin(yRad);

    float qw = cr * cp * cy + sr * sp * sy;
    float qx = sr * cp * cy - cr * sp * sy;
    float qy = cr * sp * cy + sr * cp * sy;
    float qz = cr * cp * sy - sr * sp * cy;

    // Send separate JSON frame type every 20 ms (does not alter finger frame)
    if (wsConnected) {
      StaticJsonDocument<384> imuDoc;
      imuDoc["type"]  = "imu";
      imuDoc["src"]   = "esp32";
      imuDoc["seq"]   = ++imuSeq;
      imuDoc["t"]     = currentTime;
      imuDoc["ax"]    = round(ax * 1000.0f) / 1000.0f;
      imuDoc["ay"]    = round(ay * 1000.0f) / 1000.0f;
      imuDoc["az"]    = round(az * 1000.0f) / 1000.0f;
      imuDoc["gx"]    = round(gx * 10.0f) / 10.0f;
      imuDoc["gy"]    = round(gy * 10.0f) / 10.0f;
      imuDoc["gz"]    = round(gz * 10.0f) / 10.0f;
      imuDoc["pitch"] = round(adjPitch * 10.0f) / 10.0f;
      imuDoc["roll"]  = round(adjRoll * 10.0f) / 10.0f;
      imuDoc["yaw"]   = round(adjYaw * 10.0f) / 10.0f;
      imuDoc["qw"]    = round(qw * 1000.0f) / 1000.0f;
      imuDoc["qx"]    = round(qx * 1000.0f) / 1000.0f;
      imuDoc["qy"]    = round(qy * 1000.0f) / 1000.0f;
      imuDoc["qz"]    = round(qz * 1000.0f) / 1000.0f;
      imuDoc["wrist_pitch"] = imuDoc["pitch"];
      imuDoc["wrist_roll"]  = imuDoc["roll"];
      imuDoc["wrist_yaw"]   = imuDoc["yaw"];
      imuDoc["mpu_working"] = true;

      String imuPayload;
      serializeJson(imuDoc, imuPayload);
      webSocket.sendTXT(imuPayload);
    }
  }
  // END ML-COACH HOOK

  // ==========================================================================
  // SENSOR ACQUISITION & WEBSOCKET STREAMING (20 Hz = 50ms interval)
  // ==========================================================================
  if (currentTime - lastStreamTime >= streamInterval) {
    lastStreamTime = currentTime;

    for (int i = 0; i < NUM_FINGERS; i++) {
      int spread = 0;
      int raw = readOversampled(FINGER_PINS[i], &spread);
      rawValues[i] = raw;

      // SparkFun resistance calculation in Ohms: R_flex = R_div * (4095.0 / adc - 1.0)
      float flexR = computeResistance(raw);
      float deltaR = flexR - rStraight[i];

      // Fault detection: raw out-of-bounds, high sample spread (floating)
      bool fault = (raw < RAW_MIN_FAULT) ||
                   (raw > RAW_MAX_FAULT) ||
                   (spread > SPREAD_MAX_FAULT);

      okFlags[i] = fault ? 0 : 1;

      if (fault) {
        curlValues[i] = lastGoodCurl[i];
      } else {
        if (deltaR <= DEADZONE_OHMS) {
          // Zero deadzone at rest: eliminates noise completely
          curlValues[i] = 0.0f;
          lastGoodCurl[i] = 0.0f;
        } else {
          // Dynamic span expansion: expands if user bends further than current span
          if (deltaR > rBendSpan[i]) {
            rBendSpan[i] = deltaR;
          }

          // SparkFun map: linear ratio from straight to bend span
          float ratio = (deltaR - DEADZONE_OHMS) / (rBendSpan[i] - DEADZONE_OHMS);
          ratio = constrain(ratio, 0.0f, 1.0f);

          // Gamma curve 0.65 for instant, visible response to slight curls
          float curled = pow(ratio, 0.65f);

          // Smooth EMA
          float smoothed = lastGoodCurl[i] + EMA_ALPHA[i] * (curled - lastGoodCurl[i]);
          curlValues[i] = smoothed;
          lastGoodCurl[i] = smoothed;
        }
      }
    }

    // Serialize and send JSON WebSocket frame
    if (wsConnected) {
      StaticJsonDocument<512> doc;
      doc["src"] = "esp32";
      doc["seq"] = ++seq;
      doc["t"]   = currentTime;

      // Finger angles (0 - 90 deg) for direct frontend compatibility
      doc["thumb"]  = round(curlValues[0] * 90.0f * 10.0f) / 10.0f;
      doc["index"]  = round(curlValues[1] * 90.0f * 10.0f) / 10.0f;
      doc["middle"] = round(curlValues[2] * 90.0f * 10.0f) / 10.0f;
      doc["ring"]   = round(curlValues[3] * 90.0f * 10.0f) / 10.0f;
      doc["little"] = round(curlValues[4] * 90.0f * 10.0f) / 10.0f;

      // Raw ADC readings for dashboard diagnostics
      doc["raw_thumb"]  = rawValues[0];
      doc["raw_index"]  = rawValues[1];
      doc["raw_middle"] = rawValues[2];
      doc["raw_ring"]   = rawValues[3];
      doc["raw_little"] = rawValues[4];

      // ML-COACH HOOK: Include wrist orientation in regular frame for dashboard gauges
      if (mpuFound) {
        float adjP = compPitch - pitchOffset;
        float adjR = compRoll - rollOffset;
        doc["wrist_pitch"] = round(adjP * 10.0f) / 10.0f;
        doc["wrist_roll"]  = round(adjR * 10.0f) / 10.0f;
        doc["pitch"]       = round(adjP * 10.0f) / 10.0f;
        doc["roll"]        = round(adjR * 10.0f) / 10.0f;
        doc["mpu_working"] = true;
      } else {
        doc["mpu_working"] = false;
      }
      // END ML-COACH HOOK

      JsonArray rawArr  = doc.createNestedArray("raw");
      JsonArray curlArr = doc.createNestedArray("curl");
      JsonArray okArr   = doc.createNestedArray("ok");

      for (int i = 0; i < NUM_FINGERS; i++) {
        rawArr.add(rawValues[i]);
        curlArr.add(round(curlValues[i] * 1000.0f) / 1000.0f);
        okArr.add(okFlags[i]);
      }

      String payload;
      serializeJson(doc, payload);
      webSocket.sendTXT(payload);
    }
  }

  // ==========================================================================
  // SINGLE-LINE SERIAL LOGGING (ONCE EVERY 250 ms) - WITH REAL OHMS RESISTANCE
  // ==========================================================================
  if (currentTime - lastSerialLogTime >= 250) {
    lastSerialLogTime = currentTime;
    Serial.printf("[FLEX-R] T:%.1fkΩ(%2d%%) | I:%.1fkΩ(d:+%.1fk %2d%%) | M:%.1fkΩ(d:+%.1fk %2d%%) | R:%.1fkΩ(d:+%.1fk %2d%%) | L:%.1fkΩ(d:+%.1fk %2d%%)%s\n",
                  computeResistance(rawValues[0])/1000.0f, (int)(curlValues[0] * 100.0f + 0.5f),
                  computeResistance(rawValues[1])/1000.0f, max(0.0f, computeResistance(rawValues[1]) - rStraight[1])/1000.0f, (int)(curlValues[1] * 100.0f + 0.5f),
                  computeResistance(rawValues[2])/1000.0f, max(0.0f, computeResistance(rawValues[2]) - rStraight[2])/1000.0f, (int)(curlValues[2] * 100.0f + 0.5f),
                  computeResistance(rawValues[3])/1000.0f, max(0.0f, computeResistance(rawValues[3]) - rStraight[3])/1000.0f, (int)(curlValues[3] * 100.0f + 0.5f),
                  computeResistance(rawValues[4])/1000.0f, max(0.0f, computeResistance(rawValues[4]) - rStraight[4])/1000.0f, (int)(curlValues[4] * 100.0f + 0.5f),
                  mpuFound ? " | MPU:OK" : "");
  }
}
