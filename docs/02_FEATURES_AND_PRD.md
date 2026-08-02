# SmartPhysio
## Product Requirements Document (PRD) & Feature Specification

Version: 1.0 (MVP)

---

# 1. Product Overview

SmartPhysio is an intelligent physiotherapy rehabilitation platform that combines wearable IoT hardware and a web application to provide real-time exercise monitoring, posture correction, and rehabilitation analytics.

The wearable rehabilitation sleeve captures arm movements using multiple sensors connected to an ESP32 microcontroller. Sensor data is transmitted to the SmartPhysio web application, where patients receive live guidance while performing physiotherapy exercises.

The primary objective is to improve rehabilitation quality by ensuring exercises are performed correctly even without continuous physiotherapist supervision.

---

# 2. MVP Objectives

The MVP aims to:

- Enable home-based physiotherapy.
- Monitor arm movement in real time.
- Detect incorrect exercise posture.
- Provide live corrective feedback.
- Track rehabilitation progress.
- Store patient exercise history.
- Display rehabilitation analytics.

---

# 3. Functional Modules

The SmartPhysio MVP consists of eight major modules.

---

# Module 1 — Authentication

## Purpose

Allow patients to securely access their rehabilitation dashboard.

### Features

- Email Registration
- Email Login
- Password Encryption
- Logout

### Future Scope

- Google Login
- OTP Authentication
- Forgot Password
- Multi-factor Authentication

---

# Module 2 — Patient Profile

## Purpose

Store patient information required for rehabilitation.

### Patient Information

- Full Name
- Age
- Gender
- Height
- Weight
- Injured Arm
- Injury Type
- Date Created

Future fields

- Doctor
- Hospital
- Medical Notes
- Surgery Date

---

# Module 3 — Device Calibration

## Purpose

Ensure all wearable sensors function correctly before beginning any exercise session.

### Calibration Steps

## Step 1

Device Connection

Verify:

- ESP32 Connected
- Battery Status
- Data Transmission

---

## Step 2

Sensor Validation

Check every sensor individually.

- MPU6050
- Pressure Sensor
- Thumb Flex
- Index Flex
- Middle Flex
- Ring Flex
- Little Finger Flex
- Elbow Flex Sensor

Display

🟢 Working

🔴 Error

---

## Step 3

Motion Test

Patient performs simple actions.

- Raise Arm
- Bend Wrist
- Open Hand
- Close Hand

Each movement is verified.

Only after successful calibration can exercises begin.

---

# Module 4 — Exercise Library

The system initially supports:

1. Ball Squeeze
2. Wrist Flexion
3. Wrist Extension
4. Wrist Rotation
5. Finger Closing
6. Finger Opening
7. Elbow Curl
8. Shoulder Raise

Each exercise contains:

- Name
- Description
- Target Angle
- Required Sensors
- Number of Repetitions
- Hold Duration
- Rest Duration
- Difficulty Level

Future versions will allow therapists to create custom exercises.

---

# Module 5 — Live Exercise Dashboard

This is the primary screen of SmartPhysio.

## Left Panel

### Live 3D Arm

Displays real-time movement using sensor data.

Movements include:

- Shoulder
- Elbow
- Wrist
- Fingers

The arm should mirror the patient's movements with minimal delay.

---

## Right Panel

### Current Exercise

Shows:

Exercise Name

Current Rep

Remaining Reps

Target Angle

Current Angle

Grip Pressure

Hold Timer

Exercise Timer

---

### Smart Guidance

Displays live corrective suggestions.

Examples:

✔ Raise your arm higher.

✔ Straighten your wrist.

✔ Close your fingers completely.

✔ Apply more pressure.

✔ Hold for 3 seconds.

✔ Excellent posture.

The MVP uses rule-based evaluation.

Future versions may use AI.

---

# Module 6 — Session Summary

After every exercise session display:

- Total Exercises
- Successful Repetitions
- Incorrect Repetitions
- Average Angle
- Maximum Angle
- Average Pressure
- Session Duration
- Overall Exercise Accuracy

The patient can immediately review their performance.

---

# Module 7 — Analytics Dashboard

Displays rehabilitation progress over time.

Charts include:

## Daily Progress

Exercise completion

---

## Angle vs Time

Shows movement consistency.

---

## Pressure vs Time

Measures grip strength improvement.

---

## Range of Motion

Tracks rehabilitation flexibility.

---

## Weekly Progress

Compare previous sessions.

---

## Exercise Accuracy

Percentage of correctly performed repetitions.

---

## Improvement Trend

Displays recovery progression.

---

# Module 8 — History

Patients can view:

Previous Sessions

Previous Exercises

Past Analytics

Recovery Progress

Historical Performance

---

# 4. Sensor Mapping

| Sensor | Purpose |
|---------|----------|
| MPU6050 | Arm Orientation & Rotation |
| Pressure Sensor | Grip Strength |
| Thumb Flex | Thumb Movement |
| Index Flex | Finger Bending |
| Middle Flex | Finger Bending |
| Ring Flex | Finger Bending |
| Little Finger Flex | Finger Bending |
| Elbow Flex | Elbow Angle |

---

# 5. Exercise Workflow

Login

↓

Select Patient

↓

Connect Device

↓

Calibrate Sensors

↓

Select Exercise

↓

Start Session

↓

Receive Live Sensor Data

↓

Analyze Motion

↓

Provide Guidance

↓

Store Session

↓

Show Analytics

---

# 6. Non-Functional Requirements

## Performance

- Sensor latency below 150 ms
- Dashboard updates in real time
- Smooth 3D arm animation
- Fast page loading

---

## Reliability

- Detect disconnected sensors
- Recover after Wi-Fi interruption
- Prevent corrupted session data

---

## Usability

- Large buttons
- Simple navigation
- Minimal learning curve
- Elderly-friendly interface

---

## Security

- Password hashing
- Secure authentication
- Input validation
- Protected patient records

---

# 7. Future Enhancements

The architecture should support future expansion without major redesign.

Planned features include:

- AI posture evaluation
- Machine Learning movement classification
- Therapist dashboard
- Hospital management portal
- Camera-based pose estimation
- Personalized exercise plans
- Notification reminders
- PDF report generation
- Cloud synchronization
- Mobile application
- Full-body rehabilitation
- Recovery prediction
- Voice-guided physiotherapy
- Wearable smartwatch integration

---

# 8. Out of Scope (MVP)

The following features are intentionally excluded from Version 1.0:

- AI-generated rehabilitation plans
- Doctor portal
- Therapist portal
- Camera-based tracking
- Full-body rehabilitation
- Mobile application
- Push notifications
- PDF export
- Online patient sharing
- Hospital integrations

---

# PRD Summary

SmartPhysio Version 1.0 focuses on delivering a complete upper-limb rehabilitation platform powered by wearable IoT hardware and a modern web application.

The MVP emphasizes real-time movement tracking, exercise guidance, posture correction, rehabilitation analytics, and patient progress monitoring using deterministic rule-based algorithms. The system architecture is intentionally designed to support future AI enhancements, therapist dashboards, and advanced rehabilitation features without requiring significant architectural changes.