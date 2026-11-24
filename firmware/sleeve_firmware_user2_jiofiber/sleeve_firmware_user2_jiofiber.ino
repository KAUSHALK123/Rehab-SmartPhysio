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

// DIGITAL SWITCH CONTACT TECHNIQUE:
// Pins configured with internal pull-up (no external resistors needed)
// Thumb Switch  : GPIO 23 (D23) / Alternate GPIO 16 (RX2)
// Index Switch  : GPIO 4  (D4) -> User physically attached D4 for Index
// Middle Switch : GPIO 17 (TX2)
// Ring Switch   : GPIO 18 (D18)
// Little Switch : GPIO 19 (D19)
//
// Logic:
// Disconnected (open circuit, digitalRead == HIGH): Finger is OPEN WIDE in GLB (faster smooth return)
// Connected (pin to GND, digitalRead == LOW): Finger is CLOSING / BENDING (smooth and slow movement)
const int SWITCH_PINS[NUM_FINGERS] = {23, 4, 17, 18, 19};
const int PIN_SWITCH_THUMB_ALT     = 16; // RX2 alternate for Thumb
int switchRaw[NUM_FINGERS]         = {HIGH, HIGH, HIGH, HIGH, HIGH};
bool isFingerOpen[NUM_FINGERS]      = {true, true, true, true, true};

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

// Measured 2-pose calibration values (Ohms) - loaded from Preferences ("flexcal")
float R_flat[NUM_FINGERS] = {25000.0f, 24000.0f, 25000.0f, 27000.0f, 29000.0f};
float R_bent[NUM_FINGERS] = {33000.0f, 32000.0f, 33000.0f, 35000.0f, 37000.0f};
bool isFlexCalibrated = false;

// Per-finger fault and diagnostic counters
int consecutiveSpreadFaults[NUM_FINGERS] = {0, 0, 0, 0, 0};
int totalFaultCount[NUM_FINGERS]         = {0, 0, 0, 0, 0};
int lowRangeFlags[NUM_FINGERS]           = {0, 0, 0, 0, 0};
unsigned long lastClampHintTime[NUM_FINGERS] = {0, 0, 0, 0, 0};

// Fault detection thresholds
const int RAW_MIN_FAULT    = 15;   // Pulled to GND / short / unplugged with pulldown
const int RAW_MAX_FAULT    = 4085; // Pulled to 3.3V rail / open circuit
const int SPREAD_MAX_FAULT = 1200; // Realistic ESP32 ADC noise ceiling
const float EMA_ALPHA[NUM_FINGERS] = {0.50f, 0.40f, 0.40f, 0.50f, 0.40f};

// ============================================================================
// NON-BLOCKING CALIBRATION STATE MACHINE
// ============================================================================
enum CalibState {
  CALIB_IDLE,
  CALIB_HOLD_FLAT,
  CALIB_PAUSE,
  CALIB_MAKE_FIST
};
CalibState calibState = CALIB_IDLE;
unsigned long calibStateStartTime = 0;
long calibAdcSum[NUM_FINGERS] = {0, 0, 0, 0, 0};
int calibAdcCount = 0;

// Range test state variables (Serial 't')
bool rangeTestRunning = false;
unsigned long rangeTestStartTime = 0;
int testMinRaw[NUM_FINGERS];
int testMaxRaw[NUM_FINGERS];
float testMinR[NUM_FINGERS];
float testMaxR[NUM_FINGERS];

// ============================================================================
// WI-FI & SERVER CONFIGURATION (Loaded from secrets.h or secrets.example.h if present)
// ============================================================================
#if __has_include("secrets.h")
  #include "secrets.h"
#elif __has_include("secrets.example.h")
  #include "secrets.example.h"
#endif

#ifndef SECRET_WIFI_SSID
  #define SECRET_WIFI_SSID    "JioFiber-Ys2sx"
  #define SECRET_WIFI_PASS    "MBMGREEN"
  #define SECRET_SERVER_HOST  "192.168.29.176"
  #define SECRET_SERVER_PORT  8000
#endif

String wifi_ssid   = SECRET_WIFI_SSID;
String wifi_pass   = SECRET_WIFI_PASS;
String server_host = SECRET_SERVER_HOST;
const int server_port = SECRET_SERVER_PORT;

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
int rawValues[NUM_FINGERS]      = {0, 0, 0, 0, 0};
float curlValues[NUM_FINGERS]   = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
int okFlags[NUM_FINGERS]        = {1, 1, 1, 1, 1};
float lastGoodCurl[NUM_FINGERS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};

// Forward Declarations
void startFlexCalibration();
void reZeroFlatBaseline();
void startRangeTest();
void dumpDiagnostics();
void saveCalibration();
void printCalibrationTable();
void sendCalibStatus(const char* phase, const char* msg);

// ============================================================================
// OVERSAMPLED ADC ACQUISITION WITH TRIMMED MEAN & SPREAD TRACKING
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
  // Trimmed mean: drop the min and max samples, average the remaining 14
  return (int)((sum - minVal - maxVal) / 14);
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

void sendCalibStatus(const char* phase, const char* msg) {
  if (!wsConnected) return;
  StaticJsonDocument<256> doc;
  doc["type"]  = "calib_status";
  doc["phase"] = phase;
  doc["msg"]   = msg;
  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
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
        } else if (msg.indexOf("flex_calib") >= 0) {
          startFlexCalibration();
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
// CALIBRATION PERSISTENCE & HELPERS
// ============================================================================
void saveCalibration() {
  preferences.begin("flexcal", false);
  preferences.putBool("calib_ok", true);
  for (int i = 0; i < NUM_FINGERS; i++) {
    preferences.putFloat(("f_" + String(i)).c_str(), R_flat[i]);
    preferences.putFloat(("b_" + String(i)).c_str(), R_bent[i]);
    float span = fabs(R_bent[i] - R_flat[i]);
    lowRangeFlags[i] = (span < 6000.0f && span >= 1500.0f) ? 1 : 0;
  }
  preferences.end();
  isFlexCalibrated = true;
}

void printCalibrationTable() {
  Serial.println("\n====================== 2-POSE CALIBRATION RESULTS ======================");
  Serial.println("Finger  | R_flat (Ω) | R_bent (Ω) | Span (Ω)  | Verdict");
  Serial.println("------------------------------------------------------------------------");
  bool hasNoSignal = false;
  for (int i = 0; i < NUM_FINGERS; i++) {
    float span = fabs(R_bent[i] - R_flat[i]);
    const char* verdict = "GOOD";
    if (span < 1500.0f) {
      verdict = "NO SIGNAL";
      hasNoSignal = true;
    } else if (span < 6000.0f) {
      verdict = "LOW RANGE";
    }
    Serial.printf("%-7s | %-10.0f | %-10.0f | %-9.0f | %s\n",
                  FINGER_NAMES[i], R_flat[i], R_bent[i], span, verdict);
  }
  Serial.println("========================================================================");
  if (hasNoSignal) {
    Serial.println("[WARNING] One or more fingers have NO SIGNAL (<1500Ω). Check 3.3V/GND rail & wiring!");
  } else {
    Serial.println("[CALIB] 2-pose calibration successfully stored in Preferences.");
  }
  Serial.println();
}

void startFlexCalibration() {
  if (calibState != CALIB_IDLE) return;
  calibState = CALIB_HOLD_FLAT;
  calibStateStartTime = millis();
  calibAdcCount = 0;
  for (int i = 0; i < NUM_FINGERS; i++) calibAdcSum[i] = 0;

  Serial.println("\n[CALIB] Starting 2-pose calibration...");
  Serial.println("[CALIB] Phase 1: Hold hand FLAT for 3 seconds...");
  sendCalibStatus("flat", "Hold hand FLAT");
}

void reZeroFlatBaseline() {
  Serial.println("\n[CALIB] Re-zeroing flat resting baselines (Serial 'r')...");
  long s[NUM_FINGERS] = {0, 0, 0, 0, 0};
  const int SAMPLES = 20;
  for (int k = 0; k < SAMPLES; k++) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      s[i] += readOversampled(FINGER_PINS[i]);
    }
    delay(10);
  }
  for (int i = 0; i < NUM_FINGERS; i++) {
    int avgAdc = (int)(s[i] / SAMPLES);
    if (avgAdc < 15) avgAdc = 1400; // guard
    R_flat[i] = computeResistance(avgAdc);
    float span = fabs(R_bent[i] - R_flat[i]);
    lowRangeFlags[i] = (span < 6000.0f && span >= 1500.0f) ? 1 : 0;
  }
  preferences.begin("flexcal", false);
  for (int i = 0; i < NUM_FINGERS; i++) {
    preferences.putFloat(("f_" + String(i)).c_str(), R_flat[i]);
  }
  preferences.end();
  Serial.printf("[CALIB] Flat baselines updated & stored: T=%.1fkΩ, I=%.1fkΩ, M=%.1fkΩ, R=%.1fkΩ, L=%.1fkΩ\n\n",
                R_flat[0]/1000.0f, R_flat[1]/1000.0f, R_flat[2]/1000.0f, R_flat[3]/1000.0f, R_flat[4]/1000.0f);
}

void startRangeTest() {
  if (rangeTestRunning) return;
  rangeTestRunning = true;
  rangeTestStartTime = millis();
  for (int i = 0; i < NUM_FINGERS; i++) {
    int curRaw = readOversampled(FINGER_PINS[i]);
    testMinRaw[i] = curRaw;
    testMaxRaw[i] = curRaw;
    float curR = computeResistance(curRaw);
    testMinR[i] = curR;
    testMaxR[i] = curR;
  }
  Serial.println("\n======================== 6-SECOND RANGE TEST STARTED ========================");
  Serial.println("[TEST] Bend each finger repeatedly through full range of motion for 6 seconds...");
}

void dumpDiagnostics() {
  Serial.println("\n======================== SENSOR DIAGNOSTICS DUMP ('d') ========================");
  Serial.println("Finger  | Raw  | R (Ω)      | R_flat (Ω) | R_bent (Ω) | Span (Ω)  | Curl  | OK | Faults");
  Serial.println("----------------------------------------------------------------------------------");
  for (int i = 0; i < NUM_FINGERS; i++) {
    float r = computeResistance(rawValues[i]);
    float span = fabs(R_bent[i] - R_flat[i]);
    Serial.printf("%-7s | %-4d | %-10.0f | %-10.0f | %-10.0f | %-9.0f | %-5.2f | %-2d | %d\n",
                  FINGER_NAMES[i], rawValues[i], r, R_flat[i], R_bent[i], span, curlValues[i], okFlags[i], totalFaultCount[i]);
  }
  Serial.println("==================================================================================\n");
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);

  // Load Wi-Fi / Server preferences if saved
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
    // Configure digital switch pin with internal pull-up (no external resistors needed)
    pinMode(SWITCH_PINS[i], INPUT_PULLUP);
  }
  pinMode(PIN_SWITCH_THUMB_ALT, INPUT_PULLUP);
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

  // TASK 1: Load 2-pose flex calibration from Preferences namespace "flexcal"
  preferences.begin("flexcal", true);
  isFlexCalibrated = preferences.getBool("calib_ok", false);
  if (isFlexCalibrated) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      R_flat[i] = preferences.getFloat(("f_" + String(i)).c_str(), R_flat[i]);
      R_bent[i] = preferences.getFloat(("b_" + String(i)).c_str(), R_bent[i]);
      float span = fabs(R_bent[i] - R_flat[i]);
      lowRangeFlags[i] = (span < 6000.0f && span >= 1500.0f) ? 1 : 0;
    }
    Serial.println("[FLEXCAL] Stored 2-pose calibration loaded from flash.");
  } else {
    Serial.println("NOT CALIBRATED - send c");
  }
  preferences.end();

  // Connect to Wi-Fi
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());

  // Configure WebSocket Client to FastAPI backend
  webSocket.begin(server_host.c_str(), server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);

  Serial.println("[BOOT] SmartPhysio ESP32 Glove Firmware v1.2.0 ready.");
  Serial.println("[BOOT] Pinout: Thumb:36 Index:33 Middle:34 Ring:35 Little:32");
  Serial.println("[BOOT] Commands: 'c'=Calibrate flat+fist, 'r'=Re-zero flat, 't'=Range test 6s, 'd'=Dump diagnostics, 'z'=Zero MPU");
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

  // Serial commands handler
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
    } else if (ch == 'c' || ch == 'C') {
      startFlexCalibration();
    } else if (ch == 'r' || ch == 'R') {
      reZeroFlatBaseline();
    } else if (ch == 't' || ch == 'T') {
      startRangeTest();
    } else if (ch == 'd' || ch == 'D') {
      dumpDiagnostics();
    }
  }

  // ==========================================================================
  // NON-BLOCKING CALIBRATION STATE MACHINE
  // ==========================================================================
  if (calibState != CALIB_IDLE) {
    if (calibState == CALIB_HOLD_FLAT) {
      for (int i = 0; i < NUM_FINGERS; i++) {
        calibAdcSum[i] += readOversampled(FINGER_PINS[i]);
      }
      calibAdcCount++;
      if (currentTime - calibStateStartTime >= 3000) {
        for (int i = 0; i < NUM_FINGERS; i++) {
          int avgAdc = (int)(calibAdcSum[i] / max(1, calibAdcCount));
          if (avgAdc < 15) avgAdc = 1400; // guard
          R_flat[i] = computeResistance(avgAdc);
        }
        calibState = CALIB_PAUSE;
        calibStateStartTime = currentTime;
        Serial.println("[CALIB] 2-second pause: Get ready to make a tight FIST...");
        sendCalibStatus("pause", "Get ready to make a FIST");
      }
    } else if (calibState == CALIB_PAUSE) {
      if (currentTime - calibStateStartTime >= 2000) {
        calibState = CALIB_MAKE_FIST;
        calibStateStartTime = currentTime;
        calibAdcCount = 0;
        for (int i = 0; i < NUM_FINGERS; i++) calibAdcSum[i] = 0;
        Serial.println("[CALIB] Phase 2: Make a tight FIST for 3 seconds...");
        sendCalibStatus("fist", "Make a tight FIST");
      }
    } else if (calibState == CALIB_MAKE_FIST) {
      for (int i = 0; i < NUM_FINGERS; i++) {
        calibAdcSum[i] += readOversampled(FINGER_PINS[i]);
      }
      calibAdcCount++;
      if (currentTime - calibStateStartTime >= 3000) {
        for (int i = 0; i < NUM_FINGERS; i++) {
          int avgAdc = (int)(calibAdcSum[i] / max(1, calibAdcCount));
          if (avgAdc < 15) avgAdc = 1400; // guard
          R_bent[i] = computeResistance(avgAdc);
        }
        calibState = CALIB_IDLE;
        saveCalibration();
        printCalibrationTable();
        sendCalibStatus("done", "Calibration complete");
      }
    }
  }

  // ==========================================================================
  // NON-BLOCKING RANGE TEST (Serial 't')
  // ==========================================================================
  if (rangeTestRunning) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      int curRaw = readOversampled(FINGER_PINS[i]);
      float curR = computeResistance(curRaw);
      if (curRaw < testMinRaw[i]) testMinRaw[i] = curRaw;
      if (curRaw > testMaxRaw[i]) testMaxRaw[i] = curRaw;
      if (curR < testMinR[i]) testMinR[i] = curR;
      if (curR > testMaxR[i]) testMaxR[i] = curR;
    }
    if (currentTime - rangeTestStartTime >= 6000) {
      rangeTestRunning = false;
      Serial.println("\n====================== 6-SECOND RANGE TEST RESULTS ======================");
      Serial.println("Finger  | MinRaw | MaxRaw | SpanADC | Span (Ω)  | Verdict");
      Serial.println("------------------------------------------------------------------------");
      for (int i = 0; i < NUM_FINGERS; i++) {
        int spanCounts = testMaxRaw[i] - testMinRaw[i];
        float spanOhms = fabs(testMaxR[i] - testMinR[i]);
        const char* verdict = "GOOD";
        if (testMinRaw[i] < RAW_MIN_FAULT || testMaxRaw[i] > RAW_MAX_FAULT) {
          verdict = "FAULTY";
        } else if (spanOhms < 1500.0f || spanCounts < 20) {
          verdict = "NO SIGNAL";
        } else if (spanOhms < 6000.0f) {
          verdict = "LOW RANGE";
        }
        Serial.printf("%-7s | %-6d | %-6d | %-7d | %-9.0f | %s\n",
                      FINGER_NAMES[i], testMinRaw[i], testMaxRaw[i], spanCounts, spanOhms, verdict);
      }
      Serial.println("========================================================================");
      Serial.println("HARDWARE HINTS:");
      for (int i = 0; i < NUM_FINGERS; i++) {
        float spanOhms = fabs(testMaxR[i] - testMinR[i]);
        if (testMinRaw[i] < RAW_MIN_FAULT) {
          Serial.printf("  * %s: Reading 0 ADC. Check 3.3V power jumper wire & strip connection.\n", FINGER_NAMES[i]);
        } else if (spanOhms < 1500.0f) {
          Serial.printf("  * %s: Little to no bend swing. Check strip mounting over the knuckle & loose breadboard contact.\n", FINGER_NAMES[i]);
        } else if (spanOhms < 6000.0f) {
          Serial.printf("  * %s: Low resistance swing (~%.0fΩ). Calibration will scale this to full 0..100%% GLB movement.\n", FINGER_NAMES[i], spanOhms);
        } else {
          Serial.printf("  * %s: Optimal range (~%.0fΩ swing).\n", FINGER_NAMES[i], spanOhms);
        }
      }
      Serial.println();
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
      // 1. Read digital switch state
      // Index is on GPIO 4 (D4). Thumb reads GPIO 23 (D23) or alternate GPIO 16 (RX2).
      // Disconnected (HIGH) = Contacts open / separated -> Finger is OPEN WIDE in GLB (fast smooth return)
      // Connected (LOW)    = Contacts touched to GND -> Finger is CLOSING / BENDING (slow smooth movement)
      if (i == 0) {
        int rPrimary = digitalRead(SWITCH_PINS[0]);
        int rAlt = digitalRead(PIN_SWITCH_THUMB_ALT);
        switchRaw[0] = (rPrimary == LOW || rAlt == LOW) ? LOW : HIGH;
      } else {
        switchRaw[i] = digitalRead(SWITCH_PINS[i]);
      }
      
      bool isTouchedGND = (switchRaw[i] == LOW);
      isFingerOpen[i] = !isTouchedGND; // Disconnected (HIGH) -> OPEN WIDE; Connected (LOW) -> CLOSING

      // Log switch transitions immediately to Serial Monitor for hardware verification
      static int lastSwLogged[NUM_FINGERS] = {-1, -1, -1, -1, -1};
      if (switchRaw[i] != lastSwLogged[i]) {
        lastSwLogged[i] = switchRaw[i];
        Serial.printf("[SWITCH] %s (GPIO %d): %s -> %s\n",
                      FINGER_NAMES[i], SWITCH_PINS[i],
                      isTouchedGND ? "CONNECTED to GND (LOW)" : "DISCONNECTED (HIGH)",
                      isFingerOpen[i] ? "OPEN WIDE (FAST)" : "CLOSING (SMOOTH SLOW)");
      }

      int spread = 0;
      int raw = readOversampled(FINGER_PINS[i], &spread);
      rawValues[i] = raw;

      float flexR = computeResistance(raw);

      // TASK 3: 3-consecutive spread fault filter & hard faults
      if (spread > SPREAD_MAX_FAULT) {
        consecutiveSpreadFaults[i]++;
      } else {
        consecutiveSpreadFaults[i] = 0;
      }
      bool spreadFault = (consecutiveSpreadFaults[i] >= 3);
      bool hardFault = (raw < RAW_MIN_FAULT) || (raw > RAW_MAX_FAULT);
      bool fault = spreadFault || hardFault;

      if (fault) {
        totalFaultCount[i]++;
      }

      if (isFingerOpen[i]) {
        // ================================================================
        // SWITCH DISCONNECTED: Finger is confirmed OPEN WIDE in GLB
        // Faster return to open neutral (0.0 curl)
        // ================================================================
        float fastReturnAlpha = 0.45f;
        float smoothed = lastGoodCurl[i] + fastReturnAlpha * (0.0f - lastGoodCurl[i]);
        if (smoothed < 0.015f) smoothed = 0.0f;
        curlValues[i] = smoothed;
        lastGoodCurl[i] = smoothed;
        okFlags[i] = 1;
      } else {
        // ================================================================
        // SWITCH CONNECTED (Touched to GND): Finger is CLOSING
        // Switch is the main determination.
        // Parallel fusion: If flex sensor has valid range, fuse analog bend.
        // If flex sensor reads 0 ADC or faults, switch alone drives bend!
        // Smooth and slow closing movement (gentle EMA alpha = 0.15)
        // ================================================================
        float targetCurl = 0.75f; // Base bend when switch is closed to GND

        if (!fault && isFlexCalibrated) {
          float span = R_bent[i] - R_flat[i];
          float absSpan = fabs(span);
          if (absSpan >= 100.0f) {
            float deadzone = max(100.0f, 0.04f * absSpan);
            float deadzoneRatio = deadzone / absSpan;
            float ratio = (flexR - R_flat[i]) / span;
            if (ratio > deadzoneRatio) {
              float norm = (ratio - deadzoneRatio) / (1.0f - deadzoneRatio);
              norm = constrain(norm, 0.0f, 1.0f);
              float curled = pow(norm, 0.65f);
              targetCurl = 0.50f + 0.50f * curled;
            }
          }
        }

        float slowAlpha = 0.15f; // Gentle, slow closing movement
        float smoothed = lastGoodCurl[i] + slowAlpha * (targetCurl - lastGoodCurl[i]);
        curlValues[i] = smoothed;
        lastGoodCurl[i] = smoothed;
        okFlags[i] = 1;
      }
    }

    // Serialize and send JSON WebSocket frame
    if (wsConnected) {
      StaticJsonDocument<768> doc;
      doc["type"] = "sensor_data";
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

      JsonArray rawArr      = doc.createNestedArray("raw");
      JsonArray curlArr     = doc.createNestedArray("curl");
      JsonArray okArr       = doc.createNestedArray("ok");
      JsonArray lowRangeArr = doc.createNestedArray("lowrange");
      JsonArray swArr       = doc.createNestedArray("sw");
      JsonArray connArr     = doc.createNestedArray("connected");

      for (int i = 0; i < NUM_FINGERS; i++) {
        rawArr.add(rawValues[i]);
        curlArr.add(round(curlValues[i] * 1000.0f) / 1000.0f);
        okArr.add(okFlags[i]);
        lowRangeArr.add(lowRangeFlags[i]);
        swArr.add(switchRaw[i]);       // 0 = LOW (connected to GND), 1 = HIGH (disconnected)
        connArr.add(isFingerOpen[i]);  // true = open finger, false = bending
      }

      String payload;
      serializeJson(doc, payload);
      webSocket.sendTXT(payload);
    }
  }

  // ==========================================================================
  // SINGLE-LINE SERIAL LOGGING (ONCE EVERY 250 ms)
  // Shows real Ohms resistance, LOW flag for low-range fingers, and !F for faults
  // ==========================================================================
  if (currentTime - lastSerialLogTime >= 250) {
    lastSerialLogTime = currentTime;
    Serial.printf("[FLEX] T:%.1fkΩ(%2d%%%s%s) | I:%.1fkΩ(%2d%%%s%s) | M:%.1fkΩ(%2d%%%s%s) | R:%.1fkΩ(%2d%%%s%s) | L:%.1fkΩ(%2d%%%s%s)%s\n",
                  computeResistance(rawValues[0])/1000.0f, (int)(curlValues[0] * 100.0f + 0.5f), lowRangeFlags[0] ? " LOW" : "", okFlags[0] ? "" : " !F",
                  computeResistance(rawValues[1])/1000.0f, (int)(curlValues[1] * 100.0f + 0.5f), lowRangeFlags[1] ? " LOW" : "", okFlags[1] ? "" : " !F",
                  computeResistance(rawValues[2])/1000.0f, (int)(curlValues[2] * 100.0f + 0.5f), lowRangeFlags[2] ? " LOW" : "", okFlags[2] ? "" : " !F",
                  computeResistance(rawValues[3])/1000.0f, (int)(curlValues[3] * 100.0f + 0.5f), lowRangeFlags[3] ? " LOW" : "", okFlags[3] ? "" : " !F",
                  computeResistance(rawValues[4])/1000.0f, (int)(curlValues[4] * 100.0f + 0.5f), lowRangeFlags[4] ? " LOW" : "", okFlags[4] ? "" : " !F",
                  mpuFound ? " | MPU:OK" : "");
  }
}
