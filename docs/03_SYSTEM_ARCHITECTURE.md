# SmartPhysio
# System Architecture

Version: 1.0 (MVP)

---

# 1. Architecture Overview

SmartPhysio follows a **Modular Monolith Architecture** for Version 1.0.

This architecture keeps development simple while maintaining clear separation of responsibilities between modules. As the project grows, modules can later be extracted into independent microservices without significant redesign.

---

# Why Modular Monolith?

For a final-year engineering project:

✅ Easier to develop

✅ Easier to debug

✅ Easier to deploy

✅ Lower infrastructure cost

✅ Faster development

Future versions can migrate selected modules into microservices if required.

---

# 2. High-Level Architecture

```
                          +----------------------+
                          |      Patient         |
                          +----------+-----------+
                                     |
                                     |
                             Browser (Laptop/Mobile)
                                     |
                                     |
                          React + Tailwind Frontend
                                     |
                     REST API / WebSocket / MQTT
                                     |
                +--------------------+--------------------+
                |                                         |
        FastAPI Backend                          MQTT Broker
                |                                         |
                |                                         |
      Business Logic Layer                         ESP32 Device
                |                                         |
                |                                  Sensor Collection
                |
        PostgreSQL Database
```

---

# 3. System Layers

## Layer 1 — Hardware Layer

Responsible for collecting movement data.

Components

- ESP32
- MPU6050
- Pressure Sensor
- Thumb Flex
- Index Flex
- Middle Flex
- Ring Flex
- Little Finger Flex
- Elbow Flex Sensor
- Battery

Responsibilities

- Read sensor values
- Process raw sensor data
- Send data continuously
- Monitor battery
- Detect sensor failures

---

## Layer 2 — Communication Layer

Responsible for transmitting data.

Preferred Protocol

MQTT

Alternative

WebSocket

Responsibilities

- Device connection
- Reconnection
- Data streaming
- Device heartbeat
- Low latency communication

---

## Layer 3 — Backend Layer

Technology

FastAPI

Responsibilities

Authentication

Patient Management

Calibration Logic

Exercise Engine

Sensor Processing

Session Management

Analytics

Database Operations

API Management

---

## Layer 4 — Database Layer

Technology

PostgreSQL

Stores

Patient Profiles

Exercise Library

Calibration Records

Exercise Sessions

Sensor Logs

Analytics

---

## Layer 5 — Frontend Layer

Technology

React

Responsibilities

Authentication

Dashboard

Exercise Selection

Live Exercise Screen

Analytics Dashboard

Calibration Interface

History

Settings

---

# 4. Core Modules

## Module 1

Authentication

Purpose

Manage login and secure access.

---

## Module 2

Patient Management

Purpose

Store patient details.

---

## Module 3

Device Manager

Purpose

Manage ESP32 connection.

Responsibilities

- Connect
- Disconnect
- Battery
- Device Status

---

## Module 4

Calibration Engine

Purpose

Validate every sensor.

Responsibilities

Sensor health

Movement verification

Calibration result

---

## Module 5

Exercise Engine

Purpose

Runs rehabilitation exercises.

Responsibilities

Exercise timer

Repetition counter

Angle validation

Pressure validation

Hold timer

Exercise completion

---

## Module 6

Movement Analysis Engine

Purpose

Analyzes sensor values.

Calculates

Joint angle

Movement speed

Grip pressure

Finger bend

Exercise accuracy

Incorrect posture

---

## Module 7

Guidance Engine

Purpose

Provide live feedback.

Examples

Raise arm higher.

Straighten elbow.

Grip harder.

Excellent posture.

Version 1

Rule-Based

Version 2

AI Powered

---

## Module 8

Analytics Engine

Purpose

Generate rehabilitation statistics.

Calculates

Daily Progress

Weekly Progress

Accuracy

Range of Motion

Pressure Trend

Recovery Trend

---

# 5. Sensor Flow

```
Flex Sensors
        |
Pressure Sensor
        |
MPU6050
        |
ESP32
        |
MQTT/WebSocket
        |
FastAPI
        |
Movement Engine
        |
Exercise Engine
        |
Frontend Dashboard
```

---

# 6. Exercise Workflow

```
Login

↓

Select Patient

↓

Connect Device

↓

Calibrate Device

↓

Sensor Validation

↓

Choose Exercise

↓

Receive Live Sensor Data

↓

Movement Analysis

↓

Rule Validation

↓

Live Guidance

↓

Exercise Complete

↓

Store Session

↓

Analytics Dashboard
```

---

# 7. Folder Structure

```
smartphysio/

├── frontend/
│
│   ├── src/
│   │
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── context/
│   ├── services/
│   ├── assets/
│   ├── utils/
│   ├── types/
│   └── App.jsx
│
├── backend/
│
│   ├── app/
│   │
│   ├── api/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── calibration/
│   ├── exercises/
│   ├── analytics/
│   ├── websocket/
│   ├── database/
│   ├── config/
│   └── main.py
│
├── firmware/
│
│   ├── esp32/
│   ├── sensors/
│   └── calibration/
│
├── docs/
│
├── database/
│
├── scripts/
│
└── README.md
```

---

# 8. Technology Decisions

| Component | Technology |
|------------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Backend | FastAPI |
| Database | PostgreSQL |
| Charts | Recharts |
| 3D Visualization | React Three Fiber |
| IoT | ESP32 |
| Communication | MQTT |
| Authentication | JWT |
| Deployment | Vercel + Render |

---

# 9. Scalability

Current Version

Single Patient

↓

Future

Multiple Patients

↓

Future

Doctor Dashboard

↓

Hospital Dashboard

↓

Cloud Synchronization

↓

AI Recommendation Engine

↓

Full Body Rehabilitation

The architecture supports adding these modules without redesigning the core application.

---

# 10. Future AI Architecture

Current

Rule-Based Guidance

↓

Future

Exercise Classification

↓

Personalized Exercise Difficulty

↓

Movement Quality Prediction

↓

Recovery Prediction

↓

AI Physiotherapy Assistant

---

# 11. Design Principles

The SmartPhysio architecture follows these principles:

- Modular design
- Low coupling
- High cohesion
- Real-time communication
- Scalable module separation
- Simple deployment
- Extensible codebase
- Maintainable project structure
- AI-ready architecture

---

# Architecture Summary

SmartPhysio Version 1.0 uses a modular monolith architecture consisting of a React frontend, FastAPI backend, PostgreSQL database, ESP32 firmware, and real-time MQTT communication. The system is organized into independent modules for authentication, patient management, device calibration, exercise processing, movement analysis, guidance, and analytics. This architecture is optimized for rapid development, maintainability, and future scalability while remaining practical for a final-year engineering project.