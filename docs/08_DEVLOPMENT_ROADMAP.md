# SmartPhysio
# Development Roadmap

Version: 1.0 (MVP)

---

# Purpose

This roadmap defines the recommended implementation sequence for SmartPhysio.

Instead of building every module simultaneously, development follows an incremental approach where each completed phase becomes the foundation for the next.

The goal is to always have a working application after every milestone.

---

# Overall Development Flow

```
Project Setup
        │
        ▼
Device Calibration
        │
        ▼
Patient Setup
        │
        ▼
Exercise Library
        │
        ▼
Live Exercise Dashboard
        │
        ▼
Analytics Dashboard
        │
        ▼
Testing & Deployment
```

---

# Phase 1 — Project Setup

Objective

Prepare the complete development environment.

Tasks

- Create React project
- Setup FastAPI backend
- Configure database
- Setup folder structure
- Configure Git repository
- Configure Tailwind CSS
- Create reusable UI components

Deliverable

Project runs successfully on localhost.

---

# Phase 2 — Device Calibration (Highest Priority)

Objective

Ensure the wearable sleeve is functioning correctly before allowing any exercise.

This is the first feature users interact with after login.

---

## Calibration Dashboard

Display

- ESP32 Connection Status
- Battery Level
- Device Name
- Firmware Version

---

## Sensor Status

Every sensor should have its own status indicator.

Example

🟢 Thumb Flex

🟢 Index Flex

🟢 Middle Flex

🟢 Ring Flex

🟢 Little Finger

🟢 Elbow Flex

🟢 MPU6050

🟢 Pressure Sensor

Status

- Green → Working
- Yellow → Calibrating
- Red → Not Detected

---

## Sensor Animation

Calibration page should contain a simple animated arm illustration.

Purpose

Only to indicate sensor locations.

No complex 3D rendering is required.

Examples

- Sensor blinking
- Green pulse animation
- Sensor connection animation
- Calibration progress indicator

React Three Fiber is **NOT** required here.

Simple SVG or lightweight animation is sufficient.

---

## Motion Verification

Ask the patient to perform simple movements.

Example

✔ Raise Arm

✔ Bend Wrist

✔ Open Hand

✔ Close Hand

✔ Rotate Wrist

System validates whether corresponding sensors respond correctly.

---

## Calibration Complete

If all sensors respond successfully:

Large Success Card

```
✅ Calibration Successful

All sensors are working correctly.

You are ready to begin today's rehabilitation session.
```

Enable

```
Continue →
```

Only after successful calibration.

---

Deliverable

A fully working calibration module with live sensor validation.

---

# Phase 3 — Patient Setup

Objective

Collect patient information.

Information

- Name
- Age
- Gender
- Height
- Weight
- Dominant Hand
- Injured Arm
- Injury Type

Future

Doctor

Hospital

Medical Notes

Deliverable

Patient profile stored successfully.

---

# Phase 4 — Exercise Library

Objective

Display available rehabilitation exercises.

Each exercise card contains

- Image
- Name
- Difficulty
- Target Area
- Start Button

Deliverable

Patient can select an exercise.

---

# Phase 5 — Live Exercise Dashboard

This is the main feature of SmartPhysio.

Introduce **React Three Fiber** in this phase.

Purpose

Display a real-time 3D arm synchronized with live sensor data.

---

## Dashboard Layout

Left Panel

- Live 3D Arm

Right Panel

- Exercise Information
- Rep Counter
- Angle
- Pressure
- Guidance
- Timer

Bottom

- Live Charts

---

## Guidance

Version 1

Rule-Based

Examples

Raise your arm higher.

Straighten your elbow.

Grip harder.

Excellent posture.

---

Deliverable

Patient performs an exercise while receiving live visual feedback.

---

# Phase 6 — Analytics Dashboard

Display

- Session Summary
- Daily Progress
- Weekly Progress
- Exercise Accuracy
- Grip Strength
- Range of Motion
- Recovery Trend

Deliverable

Historical rehabilitation progress.

---

# Phase 7 — Testing

Test

Frontend

Backend

Firmware

Calibration

Exercise Tracking

Analytics

Integration

---

# Phase 8 — Deployment

Deploy

Frontend → Vercel

Backend → Render

Database → PostgreSQL

---

# React Three Fiber Integration

Introduce React Three Fiber only during the Exercise Dashboard.

Reason

The calibration page only needs lightweight visual feedback.

Using a complete 3D engine during calibration would unnecessarily increase complexity and loading time.

---

# Milestones

✅ Milestone 1

Project Setup Complete

---

✅ Milestone 2

Calibration Module Working

---

✅ Milestone 3

Patient Profile Working

---

✅ Milestone 4

Exercise Library Working

---

✅ Milestone 5

Live 3D Exercise Dashboard Working

---

✅ Milestone 6

Analytics Dashboard Working

---

✅ Milestone 7

Testing Complete

---

✅ Milestone 8

Deployment Complete

---

# Final Definition of Done

The MVP is complete when:

- User can log in.
- ESP32 connects successfully.
- All sensors pass calibration.
- Calibration displays sensor health visually.
- Patient profile can be created.
- Exercise library is available.
- Live Exercise Dashboard displays a synchronized 3D arm.
- Rule-based posture guidance works.
- Session analytics are stored.
- Progress dashboard displays recovery trends.
- Application works on desktop and mobile devices.