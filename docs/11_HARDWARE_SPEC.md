# SmartPhysio
# Hardware Specification

Version: 1.0 (MVP)

---

# 1. Purpose

This document defines the complete hardware architecture of SmartPhysio.

It serves as the reference for:

- Hardware Design
- ESP32 Firmware Development
- Backend Communication
- Calibration Logic
- Sensor Placement
- Power Management
- Future Hardware Expansion

The MVP focuses on upper-limb physiotherapy monitoring using a wearable rehabilitation sleeve.

---

# 2. Hardware Overview

The SmartPhysio wearable consists of an arm sleeve that houses sensors capable of measuring:

- Finger bending
- Wrist orientation
- Elbow movement
- Shoulder movement
- Grip pressure

All sensor data is collected by an ESP32 microcontroller and transmitted wirelessly to the SmartPhysio web application.

---

# 3. Hardware Architecture

```
                SmartPhysio Arm Sleeve

      ----------------------------------------

         Thumb Flex Sensor

         Index Flex Sensor

         Middle Flex Sensor

         Ring Flex Sensor

         Little Finger Flex Sensor

                    |

          Pressure Sensor (Palm)

                    |

             MPU6050 (Wrist)

                    |

           Elbow Flex Sensor

                    |

        Shoulder Angle Sensor (Future Support)

                    |

                ESP32 Controller

                    |

             WiFi (MQTT/WebSocket)

                    |

            SmartPhysio Backend

                    |

           SmartPhysio Web App
```

---

# 4. Hardware Components

| Component | Quantity | Purpose |
|-----------|---------:|---------|
| ESP32 Dev Board | 1 | Main Controller |
| MPU6050 | 1 | Wrist Orientation & Angle |
| Flex Sensor | 5 | Finger Bend Detection |
| Flex Sensor | 1 | Elbow Movement |
| Pressure Sensor (FSR) | 1 | Grip Strength |
| Li-ion Battery | 1 | Portable Power |
| TP4056 Charging Module | 1 | Battery Charging |
| Voltage Regulator | 1 | Stable Power Supply |
| On/Off Switch | 1 | Device Power |
| LEDs | 3 | Device Status |

---

# 5. Sensor Placement

## Hand

Thumb

↓

Thumb Flex Sensor

---

Index Finger

↓

Index Flex Sensor

---

Middle Finger

↓

Middle Flex Sensor

---

Ring Finger

↓

Ring Flex Sensor

---

Little Finger

↓

Little Finger Flex Sensor

---

Palm

↓

Pressure Sensor

Measures grip force during squeezing exercises.

---

Wrist

↓

MPU6050

Measures:

- Pitch
- Roll
- Wrist Rotation
- Orientation

---

Elbow

↓

Flex Sensor

Measures elbow flexion and extension.

---

Shoulder

Version 1

Estimated using arm orientation and elbow movement.

Future versions may include an additional IMU near the shoulder for improved accuracy.

---

# 6. ESP32 Pin Mapping

**Note:** Final GPIO numbers may change depending on PCB design and available ADC pins.

| ESP32 Pin | Connected Device |
|------------|------------------|
| GPIO34 (ADC) | Thumb Flex |
| GPIO35 (ADC) | Index Flex |
| GPIO32 (ADC) | Middle Flex |
| GPIO33 (ADC) | Ring Flex |
| GPIO39 (ADC) | Little Finger Flex |
| GPIO36 (ADC) | Elbow Flex |
| GPIO25 (ADC) | Pressure Sensor |
| GPIO21 | MPU6050 SDA |
| GPIO22 | MPU6050 SCL |
| 3.3V | Sensor Power |
| GND | Common Ground |

---

# 7. Sensor Sampling

Recommended Sampling Rate

50 Hz

(50 readings per second)

Reasons

- Smooth movement
- Low latency
- Suitable for physiotherapy
- Lower battery consumption

---

# 8. Calibration Strategy

Calibration is mandatory before every rehabilitation session.

Calibration consists of three stages.

---

## Stage 1

Hardware Detection

Verify:

- ESP32 Connected
- Battery Available
- WiFi Connected

---

## Stage 2

Sensor Detection

Verify:

- MPU6050
- Pressure Sensor
- Thumb Flex
- Index Flex
- Middle Flex
- Ring Flex
- Little Flex
- Elbow Flex

Status

Green → Working

Yellow → Checking

Red → Failed

---

## Stage 3

Motion Verification

Patient performs:

✔ Raise Arm

✔ Bend Elbow

✔ Rotate Wrist

✔ Open Hand

✔ Close Hand

The system confirms that the correct sensors respond within expected ranges.

---

# 9. Data Packet Format

ESP32 sends JSON packets.

```json
{
  "timestamp": 1720000000,

  "thumb": 81,

  "index": 79,

  "middle": 82,

  "ring": 80,

  "little": 78,

  "elbow": 64,

  "pressure": 540,

  "wrist_pitch": 21.5,

  "wrist_roll": 4.2,

  "battery": 91
}
```

---

# 10. Sensor Processing

Raw sensor values should not be sent directly to the user interface.

Firmware should perform:

- Moving Average Filter
- Noise Reduction
- Basic Range Validation
- Sensor Normalization

The backend performs:

- Angle Calculations
- Exercise Validation
- Rule-Based Guidance
- Analytics

---

# 11. Power Management

Battery

Rechargeable Li-ion

Charging

USB Type-C (recommended)

Battery Monitoring

Displayed on dashboard

Warnings

Battery < 20%

Display

"Low Battery"

Battery < 10%

Disable exercise start until the user acknowledges the warning.

---

# 12. Communication

Preferred

MQTT

Alternative

WebSocket

Data Direction

ESP32

↓

Backend

↓

Frontend

Feedback Direction

Frontend

↓

Backend

↓

ESP32 (future)

---

# 13. Hardware Status LEDs

Green

Device Ready

Blue

WiFi Connected

Red

Hardware Error

During calibration, LEDs may blink to indicate active testing.

---

# 14. Safety Considerations

- Operate only at low voltage.
- Ensure battery is enclosed safely.
- Insulate exposed wiring.
- Secure sensors to prevent movement during exercise.
- Avoid sharp edges on the sleeve.
- Ensure comfortable wear for extended sessions.

---

# 15. Future Hardware Expansion

Potential future additions:

- Additional IMU for shoulder tracking
- EMG (Muscle Activity) Sensors
- Vibration Motor for Haptic Feedback
- Pulse Sensor
- SpO₂ Sensor
- Temperature Sensor
- Bluetooth Low Energy Support
- Custom PCB
- Rechargeable Smart Sleeve

---

# 16. Bill of Materials (Estimated)

| Component | Qty |
|-----------|----:|
| ESP32 | 1 |
| MPU6050 | 1 |
| Flex Sensors | 6 |
| Force Sensitive Resistor (FSR) | 1 |
| Li-ion Battery | 1 |
| TP4056 Charging Module | 1 |
| Switch | 1 |
| LEDs | 3 |
| Resistors | As Required |
| Connecting Wires | As Required |
| Wearable Arm Sleeve/Glove | 1 |

---

# 17. Hardware Development Checklist

✅ ESP32 powers on

✅ Battery charging works

✅ MPU6050 detected

✅ All flex sensors respond

✅ Pressure sensor responds

✅ WiFi connects successfully

✅ Sensor data streams correctly

✅ Calibration passes

✅ Data packet format matches API specification

✅ Dashboard receives live data

---

# Hardware Summary

The SmartPhysio hardware consists of a wearable rehabilitation sleeve built around an ESP32 microcontroller, integrating flex sensors, an MPU6050 IMU, and a pressure sensor to capture upper-limb movement and grip force. The firmware preprocesses sensor readings before transmitting them over WiFi to the backend, enabling real-time visualization, exercise guidance, and rehabilitation analytics through the SmartPhysio web application. The design prioritizes reliability, portability, and scalability while leaving room for future enhancements such as additional IMUs, EMG sensing, haptic feedback, and custom PCB integration.