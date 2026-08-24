# SmartPhysio
# API Specification

Version: 1.0 (MVP)

---

# 1. API Overview

The SmartPhysio backend exposes REST APIs for authentication, patient management, exercise management, rehabilitation sessions, analytics, and device communication.

Base URL

/api/v1

Example

http://localhost:8000/api/v1

---

# 2. Authentication

Authentication uses JWT tokens.

Workflow

Register

↓

Login

↓

Receive JWT Token

↓

Include Token in Request Header

Authorization: Bearer <token>

---

# 3. Authentication APIs

## Register User

POST

/auth/register

Request

```json
{
  "email":"john@gmail.com",
  "password":"Password@123"
}
```

Response

```json
{
  "message":"Registration successful"
}
```

---

## Login

POST

/auth/login

Request

```json
{
  "email":"john@gmail.com",
  "password":"Password@123"
}
```

Response

```json
{
  "access_token":"JWT_TOKEN",
  "token_type":"Bearer"
}
```

---

## Logout

POST

/auth/logout

Response

```json
{
    "message":"Logged Out"
}
```

---

# 4. Patient APIs

## Create Patient

POST

/patients

Request

```json
{
  "full_name":"John",
  "age":45,
  "gender":"Male",
  "height_cm":175,
  "weight_kg":74,
  "dominant_hand":"Right",
  "injured_arm":"Left",
  "injury_type":"Fracture"
}
```

Response

```json
{
  "patient_id":"UUID",
  "message":"Patient Created"
}
```

---

## Get Patients

GET

/patients

Response

```json
[
 {
   "id":"UUID",
   "full_name":"John"
 }
]
```

---

## Get Patient Details

GET

/patients/{id}

---

## Update Patient

PUT

/patients/{id}

---

## Delete Patient

DELETE

/patients/{id}

---

# 5. Injury-Centric & Metadata APIs

## Get Body Parts

GET

/body-parts

Response

```json
[
  {
    "id": "UUID",
    "name": "Wrist"
  }
]
```

---

## Get Diagnosed Conditions

GET

/conditions

Response

```json
[
  {
    "id": "UUID",
    "body_part_id": "UUID",
    "name": "Wrist Sprain",
    "safety_disclaimer": "Assistive monitoring tool only. Consult clinician."
  }
]
```

---

## Get Rehabilitation Goals

GET

/rehabilitation-goals

Response

```json
[
  {
    "id": "UUID",
    "goal_name": "Increase Flexion Range of Motion"
  }
]
```

---

## Get Patient Recommendations

GET

/patients/{id}/recommendations

Response

```json
[
  {
    "id": "UUID",
    "exercise_name": "Wrist Rotation",
    "description": "Slowly rotate wrist joint...",
    "body_part": "Wrist",
    "target_joint": "Wrist Joint",
    "target_angle": 90.0,
    "target_pressure": 0.0,
    "required_sensors": "MPU6050 Gyroscope",
    "repetitions": 10,
    "hold_seconds": 3,
    "rest_seconds": 2,
    "difficulty": "Easy"
  }
]
```

---

# 6. Exercise APIs

## Get Exercise Library

GET

/exercises

Response

```json
[
 {
   "id":"UUID",
   "exercise_name":"Ball Squeeze"
 }
]
```

---

## Get Exercise Details

GET

/exercises/{id}

Returns

Description

Target Angle

Target Pressure

Repetitions

Hold Time

Rest Time

Required Sensors

Target Joint

---

# 7. Calibration APIs

## Start Calibration

POST

/calibration/start

Response

```json
{
 "status":"Started"
}
```

---

## Submit Calibration Result

POST

/calibration/result

Request

```json
{
 "mpu":true,
 "pressure":true,
 "thumb":true,
 "index":true,
 "middle":true,
 "ring":true,
 "little":true,
 "elbow":true,
 "battery":94
}
```

Response

```json
{
 "result":"PASS"
}
```

---

## Calibration History

GET

/calibration/history

---

# 7. Exercise Session APIs

## Start Exercise

POST

/session/start

Request

```json
{
 "patient_id":"UUID",
 "exercise_id":"UUID"
}
```

Response

```json
{
 "session_id":"UUID"
}
```

---

## End Exercise

POST

/session/end

Request

```json
{
 "session_id":"UUID"
}
```

---

## Get Session

GET

/session/{id}

---

## Session History

GET

/sessions

---

# 8. Analytics APIs

## Dashboard Analytics

GET

/analytics/dashboard

Returns

Exercise Accuracy

Average Angle

Grip Strength

Completion Rate

Improvement Trend

---

## Patient Analytics

GET

/analytics/patient/{id}

---

## Progress History

GET

/analytics/history

---

# 9. Device APIs

## Device Status

GET

/device/status

Returns

```json
{
 "connected":true,
 "battery":91,
 "firmware":"1.0.0"
}
```

---

## Connect Device

POST

/device/connect

---

## Disconnect Device

POST

/device/disconnect

---

# 10. Real-Time Communication

For live rehabilitation the REST API is **not** used.

Real-time data is streamed using **MQTT** (preferred) or **WebSocket**.

### ESP32 publishes sensor data

Topic

```
smartphysio/device/sensors
```

Payload

```json
{
  "timestamp":"2026-07-19T12:00:00Z",

  "shoulder_angle":35,

  "elbow_angle":92,

  "wrist_angle":14,

  "thumb":78,

  "index":80,

  "middle":81,

  "ring":77,

  "little":79,

  "pressure":540
}
```

---

### Backend publishes feedback

Topic

```
smartphysio/device/feedback
```

Payload

```json
{
 "message":"Raise your arm higher"
}
```

---

### Calibration Topic

```
smartphysio/device/calibration
```

---

### Device Status Topic

```
smartphysio/device/status
```

---

# 11. HTTP Status Codes

| Code | Meaning |
|-------|----------|
|200|Success|
|201|Created|
|400|Bad Request|
|401|Unauthorized|
|403|Forbidden|
|404|Not Found|
|409|Conflict|
|422|Validation Error|
|500|Internal Server Error|

---

# 12. Error Response Format

```json
{
  "success":false,
  "message":"Invalid patient id",
  "error_code":"PATIENT_NOT_FOUND"
}
```

---

# 13. Validation Rules

Registration

- Valid Email
- Password ≥ 8 characters

Patient

- Age > 0
- Height > 0
- Weight > 0

Exercise

- Valid Exercise ID

Session

- Device Connected
- Calibration Passed

Calibration

- Every required sensor must respond

---

# 14. API Security

- JWT Authentication
- Password Hashing
- Request Validation
- Input Sanitization
- HTTPS (Production)
- Protected Routes
- Token Expiration

---

# 15. API Versioning

Current

```
/api/v1/
```

Future

```
/api/v2/
```

Older versions remain supported until deprecated.

---

# 16. Future APIs

The architecture supports adding APIs for:

- Therapist Dashboard
- Doctor Portal
- Hospital Management
- Appointment Scheduling
- Notification Service
- AI Recommendations
- Exercise Prescription
- PDF Report Generation
- Mobile Application
- Cloud Synchronization

---

# API Summary

The SmartPhysio API follows a REST-first architecture with JWT authentication for secure access. Standard CRUD endpoints manage users, patients, exercises, sessions, calibration, and analytics, while real-time rehabilitation data is streamed via MQTT/WebSocket. This separation keeps the system responsive, scalable, and ready for future expansion into therapist dashboards, AI-powered guidance, and cloud-connected rehabilitation services.