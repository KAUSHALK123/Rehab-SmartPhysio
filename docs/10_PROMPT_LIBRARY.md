# SmartPhysio
# AI Prompt Library

Version: 1.0

---

# Purpose

This document contains standardized prompts for AI coding agents (ChatGPT, Claude Code, Cursor, Windsurf, Codex, etc.) to build SmartPhysio incrementally.

Before starting any module, the AI must first read:

- PROJECT_FOUNDATION.md
- FEATURES_AND_PRD.md
- SYSTEM_ARCHITECTURE.md
- DATABASE.md
- API_SPEC.md
- IMPLEMENTATION_GUIDE.md
- AI_DEVELOPMENT_PLAN.md

The AI must not redesign the project or make assumptions.

Always follow the documentation.

---

# Master Development Prompt

You are a Senior Software Engineer, IoT Engineer, Full Stack Developer, UI Engineer, and Software Architect.

You are developing SmartPhysio, an IoT-assisted physiotherapy rehabilitation platform.

Before writing any code:

- Read all project documentation.
- Follow the existing architecture.
- Do not redesign anything.
- Do not skip implementation phases.
- Never hardcode values that belong in configuration or the database.
- Build production-quality, modular, and reusable code.
- Keep code clean and maintainable.

When implementing a module:

1. Explain what will be built.
2. Explain dependencies.
3. Build backend first.
4. Build frontend.
5. Connect frontend to backend.
6. Test the module.
7. Fix issues.
8. Wait for confirmation before moving to the next module.

Do not implement unrelated features.

---

# Prompt 1 — Project Setup

Objective

Setup the SmartPhysio project foundation.

Tasks

- Create folder structure.
- Initialize React + Vite.
- Initialize FastAPI.
- Configure Tailwind CSS.
- Configure routing.
- Configure PostgreSQL/SQLite.
- Configure environment variables.
- Create reusable folder structure.

Do not implement any business logic.

Stop after setup.

---

# Prompt 2 — Authentication

Objective

Implement authentication only.

Features

- Registration
- Login
- JWT Authentication
- Protected Routes
- Logout

Requirements

- Backend API
- Database tables
- Frontend pages
- Form validation
- Error handling

Do not build dashboard pages.

Stop after authentication.

---

# Prompt 3 — Device Calibration

Objective

Implement only the calibration module.

Requirements

Frontend

- Calibration Page
- Device Status
- Sensor Status Cards
- Battery Indicator
- Calibration Progress
- Success Screen

Backend

- Device APIs
- Calibration APIs

ESP32

- Sensor detection
- Send sensor health

No exercise implementation.

Stop after calibration.

---

# Prompt 4 — Patient Module

Build only:

- Add Patient
- Edit Patient
- Delete Patient
- View Patient
- Patient Profile

Follow the database schema.

No analytics.

---

# Prompt 5 — Exercise Library

Implement

- Exercise cards
- Exercise details
- Exercise selection
- Start Exercise button

No live tracking.

---

# Prompt 6 — Live Exercise Dashboard

This is the largest module.

Requirements

Frontend

- React Three Fiber
- Live Arm Model
- Live Sensor Values
- Guidance Panel
- Timer
- Rep Counter
- Charts

Backend

- Live Sensor Processing
- Rule Engine

ESP32

- Live Streaming

Do not implement analytics.

---

# Prompt 7 — Analytics

Implement

- Session Summary
- Daily Progress
- Weekly Progress
- Charts
- History
- Recovery Dashboard

Follow DATABASE.md.

---

# Prompt 8 — ESP32 Firmware

Implement firmware for:

- WiFi
- MQTT/WebSocket
- MPU6050
- Flex Sensors
- Pressure Sensor
- Battery

Create modular code.

Avoid delay().

Use non-blocking programming.

---

# Prompt 9 — MQTT Integration

Implement communication between:

ESP32

↓

MQTT Broker

↓

FastAPI

↓

React

Requirements

- Auto reconnect
- Heartbeat
- Device status
- Low latency

---

# Prompt 10 — Database

Implement the database exactly as described in DATABASE.md.

Requirements

- SQLAlchemy Models
- Alembic Migrations
- Relationships
- Constraints
- Seed Exercise Data

---

# Prompt 11 — API

Implement all REST APIs defined in API_SPEC.md.

Requirements

- Validation
- Authentication
- Error handling
- Documentation
- Swagger

---

# Prompt 12 — UI Polish

Improve UI only.

Do NOT modify functionality.

Improve

- Layout
- Colors
- Animations
- Responsiveness
- Accessibility
- Component consistency

---

# Prompt 13 — Bug Fixing

Review the project.

Tasks

- Find bugs.
- Find unused code.
- Remove duplicate logic.
- Improve performance.
- Improve readability.
- Maintain architecture.

Do not redesign.

---

# Prompt 14 — Testing

Generate

- Unit Tests
- Integration Tests
- API Tests
- Frontend Tests
- Manual Test Checklist

---

# Prompt 15 — Deployment

Prepare production deployment.

Requirements

Frontend

- Vercel

Backend

- Render

Database

- PostgreSQL

Environment Variables

- Production ready

---

# Prompt 16 — Code Review

Review the complete project.

Check

- Folder structure
- Naming conventions
- Architecture
- Performance
- Security
- Scalability
- Documentation
- Dead code
- API consistency
- Database consistency

Generate a detailed review report.

---

# Prompt 17 — Refactoring

Refactor the project.

Rules

- No functionality changes.
- Reduce code duplication.
- Improve readability.
- Increase maintainability.
- Improve folder organization.

---

# Prompt 18 — Documentation Update

Whenever implementation changes:

Update

- PRD
- API_SPEC
- DATABASE
- IMPLEMENTATION_GUIDE

Keep documentation synchronized.

---

# Golden Rules

Every AI agent working on SmartPhysio must:

✔ Follow the documentation.

✔ Build one module at a time.

✔ Keep modules independent.

✔ Use reusable components.

✔ Write production-quality code.

✔ Explain implementation decisions.

✔ Test before completing a module.

✔ Wait for confirmation before moving forward.

Never rewrite completed modules unless requested.