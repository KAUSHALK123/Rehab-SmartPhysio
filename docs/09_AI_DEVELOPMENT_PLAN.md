# SmartPhysio
# AI Development Plan

Version: 1.0

---

# Purpose

This document defines how AI coding agents should build SmartPhysio.

The objective is to ensure every implementation follows the PRD, Architecture, Database, and API specifications while preventing AI from making assumptions or skipping important steps.

This document acts as the master instruction manual for AI-assisted development.

---

# General Rules

Every AI agent working on this project must follow these rules.

## Rule 1

Never redesign the architecture.

Follow:

- SYSTEM_ARCHITECTURE.md
- DATABASE.md
- API_SPEC.md

---

## Rule 2

Never implement multiple major modules together.

Complete one module before starting another.

---

## Rule 3

Never change database tables without updating DATABASE.md.

---

## Rule 4

Never hardcode values that belong in configuration files or the database.

---

## Rule 5

Always create reusable components.

Avoid duplicated code.

---

## Rule 6

Always write production-quality code.

Avoid placeholder implementations unless explicitly requested.

---

# Development Workflow

Development must follow this exact sequence.

```
Project Setup
        ↓
Authentication
        ↓
Calibration
        ↓
Patient Setup
        ↓
Exercise Library
        ↓
Exercise Dashboard
        ↓
Analytics
        ↓
Testing
        ↓
Deployment
```

Do not skip phases.

---

# Phase 1 — Project Setup

Objective

Create only the project foundation.

Tasks

- Create React project
- Create FastAPI backend
- Configure Tailwind
- Configure Database
- Configure Folder Structure
- Configure Routing
- Configure Environment Variables

STOP.

Wait for confirmation before proceeding.

---

# Phase 2 — Authentication

Build only:

- Login
- Register
- JWT
- Protected Routes

Do NOT build dashboard.

STOP.

Wait for confirmation.

---

# Phase 3 — Device Calibration

Build only the calibration system.

Requirements

- ESP32 Connection
- Sensor Status
- Battery Indicator
- Motion Test
- Calibration Complete Screen

No exercise page.

No analytics.

STOP.

---

# Phase 4 — Patient Setup

Build

- Patient Registration
- Patient Profile
- Edit Patient
- Delete Patient

STOP.

---

# Phase 5 — Exercise Library

Build only

- Exercise Cards
- Exercise Details
- Start Exercise Button

Do not build the live dashboard.

STOP.

---

# Phase 6 — Live Exercise Dashboard

This is the largest module.

Build

- React Three Fiber
- Live Arm Movement
- MQTT/WebSocket Integration
- Live Sensor Values
- Rule-Based Guidance
- Rep Counter
- Exercise Timer

STOP.

---

# Phase 7 — Analytics

Build

- Session Summary
- Dashboard
- Charts
- Progress Tracking

STOP.

---

# Phase 8 — Testing

Test

Frontend

Backend

Firmware

API

Database

ESP32

MQTT

Integration

STOP.

---

# Phase 9 — Deployment

Deploy

Frontend

Backend

Database

Environment Variables

Production Build

---

# Coding Standards

Frontend

- Functional Components
- Hooks
- Context API
- Reusable Components

Backend

- Service Layer
- API Layer
- Validation Layer

Firmware

- Modular Files
- Non-blocking Code
- Configurable Pins

---

# AI Constraints

The AI must never:

❌ Rewrite completed modules.

❌ Rename APIs without updating documentation.

❌ Change database schema independently.

❌ Remove features from the PRD.

❌ Introduce new frameworks without approval.

❌ Create unnecessary complexity.

---

# Before Every Coding Session

The AI should first review:

1. PROJECT_FOUNDATION.md
2. FEATURES_AND_PRD.md
3. SYSTEM_ARCHITECTURE.md
4. DATABASE.md
5. API_SPEC.md
6. IMPLEMENTATION_GUIDE.md

Only then should implementation begin.

---

# Completion Checklist

Each module is complete only when:

- Code compiles successfully.
- No TypeScript/JavaScript/Python errors.
- Backend APIs respond correctly.
- Database migrations work.
- UI matches the intended functionality.
- Module has been manually tested.
- No console errors remain.

---

# Step-by-Step Development Rule

Unless explicitly instructed otherwise, the AI must:

1. Explain what will be built.
2. Create the folder structure.
3. Implement backend.
4. Implement frontend.
5. Connect frontend to backend.
6. Test the module.
7. Fix bugs.
8. Wait for user approval before moving to the next module.

Never implement multiple phases in one response.

---

# Definition of Project Completion

SmartPhysio Version 1.0 is considered complete when:

- Authentication is functional.
- ESP32 connects successfully.
- Calibration validates all sensors.
- Patient profiles are stored.
- Exercise library is operational.
- Live 3D arm mirrors sensor movement.
- Rule-based posture guidance works.
- Exercise sessions are recorded.
- Analytics dashboard displays progress.
- Application functions on desktop and mobile.
- Documentation matches the implementation.
