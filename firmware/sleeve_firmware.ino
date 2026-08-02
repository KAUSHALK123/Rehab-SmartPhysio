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
  1. Adafruit MPU6050 (by Adafruit)
  2. ArduinoJson (by Benoit Blanchon)
  3. WebSockets (by Markus Sattler)
*/

#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

// --- Wi-Fi Settings ---
const char* ssid = "YOUR_WIFI_SSID";          // Replace with local Wi-Fi SSID
const char* password = "YOUR_WIFI_PASSWORD";  // Replace with Wi-Fi Password

// --- Backend Host Settings ---
const char* server_host = "192.168.29.176";    // Replace with backend server machine IP (e.g. 192.168.x.x)
const int server_port = 8000;

// --- Analog Input Pins Assignment ---
const int PIN_THUMB = 32;
const int PIN_INDEX = 33;
const int PIN_MIDDLE = 34;
const int PIN_RING = 35;
const int PIN_LITTLE = 36;
const int PIN_ELBOW = 39;
const int PIN_PRESSURE = 25;

// --- Sensors Variables & Objects ---
Adafruit_MPU6050 mpu;
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
  
  // 1. Initialize Wi-Fi Connection
  Serial.printf("\nConnecting to Wi-Fi SSID: %s\n", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected successfully!");
  Serial.print("Local IP Address: ");
  Serial.println(WiFi.localIP());

  // 2. Initialize I2C and MPU6050
  Serial.println("Initializing MPU6050 Accelerometer...");
  if (!mpu.begin()) {
    Serial.println("Warning: MPU6050 chip not found! Check SDA/SCL wire connections.");
    mpuFound = false;
  } else {
    Serial.println("MPU6050 initialized successfully.");
    mpuFound = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // 3. Initialize WebSocket client connection
  // client_type=device query parameter informs backend this is the hardware device socket
  Serial.printf("Connecting to WebSocket server: %s:%d...\n", server_host, server_port);
  webSocket.begin(server_host, server_port, "/api/v1/device/ws?client_type=device");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000); // Reconnect every 5 seconds if connection fails
}

void loop() {
  webSocket.loop();

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
    sensors_event_t a, g, temp;
    float wristPitch = 0.0;
    float wristRoll = 0.0;
    
    if (mpu.getEvent(&a, &g, &temp)) {
      // Calculate roll/pitch orientation angles (in degrees) from gravity vectors
      wristPitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180.0 / M_PI;
      wristRoll = atan2(a.acceleration.y, a.acceleration.z) * 180.0 / M_PI;
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
