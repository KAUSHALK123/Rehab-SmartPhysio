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
// CALIBRATION BLOCK (Flex Sensor 12-bit ADC Benchmarks: Decreases when bent)
// ============================================================================
// To recalibrate:
// 1. Keep hand completely flat on a table, note raw ADC values over Serial (or send 'c').
// 2. Curl finger into a full fist, note raw ADC values.
// 3. Update the CALIB_FLAT and CALIB_BENT constants below.
// Rule: Flex ADC value DECREASES when bent (FLAT > BENT).
const int CALIB_FLAT[NUM_FINGERS] = {
  250,  // Thumb  (Sensor #5, GPIO 36) - placeholder default
  173,  // Index  (Sensor #1, GPIO 33)
  265,  // Middle (Sensor #2, GPIO 34)
  900,  // Ring   (Sensor #3, GPIO 35) - Measured: Flat ~ 900
  148   // Little (Sensor #4, GPIO 32) - Confirmed: Flat=148, Bent=41
};

const int CALIB_BENT[NUM_FINGERS] = {
  180,  // Thumb  (Sensor #5, GPIO 36) - placeholder default
  108,  // Index  (Sensor #1, GPIO 33)
  220,  // Middle (Sensor #2, GPIO 34)
  400,  // Ring   (Sensor #3, GPIO 35) - Measured: Bent ~ 400
  41    // Little (Sensor #4, GPIO 32) - Confirmed: Flat=148, Bent=41
};

// Fault detection thresholds (Named Constants)
const int RAW_MIN_FAULT    = 10;   // Pulled to GND / short / unplugged with pulldown
const int RAW_MAX_FAULT    = 4085; // Pulled to 3.3V rail / open circuit
const int SPREAD_MAX_FAULT = 150;  // High ADC sample spread -> floating pin / extreme noise
const int SWING_MIN_FAULT  = 20;   // Minimum required calibration span |FLAT - BENT|
const float DEADZONE[NUM_FINGERS]  = {0.04f, 0.04f, 0.04f, 0.03f, 0.04f}; // Per-finger deadzone (Ring = 0.03)
const float EMA_ALPHA[NUM_FINGERS] = {0.35f, 0.35f, 0.35f, 0.50f, 0.35f}; // Per-finger EMA factor (Ring = 0.50 fast)

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
struct SampleResult {
  int raw;
  int spread;
};

SampleResult readOversampled(int pin) {
  volatile int dummy = analogRead(pin); // mux settle
  (void)dummy;
  int minVal = 4095;
  int maxVal = 0;
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    int val = analogRead(pin);
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    sum += val;
    delayMicroseconds(40);
  }
  SampleResult res;
  res.raw = (int)(sum >> 4);
  res.spread = maxVal - minVal;
  return res;
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
      break;
    default:
      break;
  }
}

// ============================================================================
// MPU6050 INITIALIZATION
// ============================================================================
void initMPU() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) {
    mpu.begin();
    mpu.calcGyroOffsets(false);
    mpuFound = true;
  } else {
    mpuFound = false;
  }
}

// ============================================================================
// SETUP
// ============================================================================
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

  // Connect to Wi-Fi
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());

  // Configure WebSocket Client to FastAPI backend
  webSocket.begin(server_host.c_str(), server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);

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

  // ==========================================================================
  // SENSOR ACQUISITION & WEBSOCKET STREAMING (20 Hz = 50ms interval)
  // ==========================================================================
  if (currentTime - lastStreamTime >= streamInterval) {
    lastStreamTime = currentTime;

    for (int i = 0; i < NUM_FINGERS; i++) {
      SampleResult s = readOversampled(FINGER_PINS[i]);
      rawValues[i] = s.raw;
      int flat = CALIB_FLAT[i];
      int bent = CALIB_BENT[i];
      int swing = abs(flat - bent);

      // Fault detection: raw out-of-bounds, high sample spread (floating), or bad calibration
      bool fault = (s.raw < RAW_MIN_FAULT) ||
                   (s.raw > RAW_MAX_FAULT) ||
                   (s.spread > SPREAD_MAX_FAULT) ||
                   (swing < SWING_MIN_FAULT);

      okFlags[i] = fault ? 0 : 1;

      if (fault) {
        // HOLD last good curl; never compute a bend from a faulted reading.
        // Initialized to 0.0 (open hand). A fault must never produce a fist!
        curlValues[i] = lastGoodCurl[i];
      } else {
        // Normalization: curl = (FLAT - raw) / (FLAT - BENT)
        float rawCurl = (float)(flat - s.raw) / (float)(flat - bent);
        if (rawCurl < 0.0f) rawCurl = 0.0f;
        if (rawCurl > 1.0f) rawCurl = 1.0f;

        // Apply deadzone (per-finger)
        if (rawCurl < DEADZONE[i]) rawCurl = 0.0f;

        // Per-finger EMA smoothing: F[i].curl += EMA_ALPHA[i] * (c - F[i].curl)
        float smoothed = lastGoodCurl[i] + EMA_ALPHA[i] * (rawCurl - lastGoodCurl[i]);
        curlValues[i] = smoothed;
        lastGoodCurl[i] = smoothed;
      }
    }

    // Serialize and send JSON WebSocket frame
    if (wsConnected) {
      StaticJsonDocument<384> doc;
      doc["src"] = "esp32";
      doc["seq"] = ++seq;
      doc["t"]   = currentTime;

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
  // SINGLE-LINE SERIAL LOGGING (ONCE EVERY 500 ms)
  // ==========================================================================
  if (currentTime - lastSerialLogTime >= 500) {
    lastSerialLogTime = currentTime;
    const char* letters[NUM_FINGERS] = {"T", "I", "M", "R", "L"};
    char buf[128];
    int offset = snprintf(buf, sizeof(buf), "[%6lu ms] ", currentTime);
    for (int i = 0; i < NUM_FINGERS; i++) {
      int pct = (int)(curlValues[i] * 100.0f + 0.5f);
      if (!okFlags[i]) {
        offset += snprintf(buf + offset, sizeof(buf) - offset, "%s:%4d %2d%% !FAULT ", letters[i], rawValues[i], pct);
      } else {
        offset += snprintf(buf + offset, sizeof(buf) - offset, "%s:%4d %2d%% ", letters[i], rawValues[i], pct);
      }
    }
    Serial.println(buf);
  }
}
