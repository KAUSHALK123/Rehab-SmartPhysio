# SmartPhysio
# Database Design

Version: 1.0 (MVP)

---

# 1. Database Overview

SmartPhysio uses a relational database to store patient information, exercise definitions, rehabilitation sessions, calibration history, and analytics.

The database is designed using **Third Normal Form (3NF)** to minimize redundancy while remaining simple for the MVP.

Recommended Database:
- PostgreSQL (Production)
- SQLite (Development)

---

# 2. Entity Relationship Diagram (ERD)

```
                    +----------------+
                    |     Users      |
                    +--------+-------+
                             |
                             | 1
                             |
                             | N
                    +--------v--------+
                    |    Patients     |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
          |                  |                  |
      +---v----+       +-----v------+     +-----v------+
      |Session |       |Calibration |     | Progress   |
      +---+----+       +------------+     +------------+
          |
          |
          | N
          |
          | 1
+---------v----------+
| Exercise Sessions  |
+---------+----------+
          |
          |
          | N
          |
          | 1
     +----v-----+
     |Exercises |
     +----------+
```

---

# 3. Tables

---

# Users

Stores authentication details.

| Column | Type |
|----------|------|
| id | UUID |
| email | VARCHAR |
| password_hash | TEXT |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

Purpose

- Login
- Authentication

---

# Patients

Stores patient information.

| Column | Type |
|----------|------|
| id | UUID |
| user_id | UUID FK |
| full_name | VARCHAR |
| age | INTEGER |
| gender | VARCHAR |
| height_cm | FLOAT |
| weight_kg | FLOAT |
| dominant_hand | VARCHAR |
| injured_arm | VARCHAR |
| injury_type | VARCHAR |
| created_at | TIMESTAMP |

Future

- doctor_name
- hospital
- surgery_date
- medical_notes

---

# Exercises

Master table containing exercise definitions.

| Column | Type |
|----------|------|
| id | UUID |
| exercise_name | VARCHAR |
| description | TEXT |
| body_part | VARCHAR |
| target_angle | FLOAT |
| target_pressure | FLOAT |
| repetitions | INTEGER |
| hold_seconds | INTEGER |
| rest_seconds | INTEGER |
| difficulty | VARCHAR |

Example

Ball Squeeze

Wrist Rotation

Finger Closing

Shoulder Raise

---

# Calibration Sessions

Stores every calibration performed.

| Column | Type |
|----------|------|
| id | UUID |
| patient_id | UUID FK |
| calibration_time | TIMESTAMP |
| mpu_status | BOOLEAN |
| pressure_status | BOOLEAN |
| thumb_sensor | BOOLEAN |
| index_sensor | BOOLEAN |
| middle_sensor | BOOLEAN |
| ring_sensor | BOOLEAN |
| little_sensor | BOOLEAN |
| elbow_sensor | BOOLEAN |
| battery_percentage | INTEGER |
| calibration_result | VARCHAR |

Possible Results

PASS

WARNING

FAILED

---

# Exercise Sessions

One record represents one rehabilitation session.

| Column | Type |
|----------|------|
| id | UUID |
| patient_id | UUID FK |
| exercise_id | UUID FK |
| start_time | TIMESTAMP |
| end_time | TIMESTAMP |
| duration_seconds | INTEGER |
| repetitions_completed | INTEGER |
| repetitions_failed | INTEGER |
| average_angle | FLOAT |
| max_angle | FLOAT |
| average_pressure | FLOAT |
| exercise_accuracy | FLOAT |

---

# Progress Analytics

Stores summarized rehabilitation progress.

| Column | Type |
|----------|------|
| id | UUID |
| patient_id | UUID FK |
| session_id | UUID FK |
| range_of_motion | FLOAT |
| grip_strength | FLOAT |
| improvement_score | FLOAT |
| posture_score | FLOAT |
| created_at | TIMESTAMP |

---

# Sensor Logs (Optional)

Can be enabled for debugging.

| Column | Type |
|----------|------|
| id | UUID |
| session_id | UUID FK |
| timestamp | TIMESTAMP |
| shoulder_angle | FLOAT |
| elbow_angle | FLOAT |
| wrist_angle | FLOAT |
| thumb_flex | FLOAT |
| index_flex | FLOAT |
| middle_flex | FLOAT |
| ring_flex | FLOAT |
| little_flex | FLOAT |
| grip_pressure | FLOAT |

For MVP

Sensor logs may be stored only in memory during a session instead of permanently to reduce storage requirements.

---

# 4. Relationships

```
Users
   |
   | 1
   |
   | N
Patients
   |
   | 1
   |
   | N
Exercise Sessions
   |
   | N
   |
Exercises

Patients
   |
   | 1
   |
   | N
Calibration Sessions

Patients
   |
   | 1
   |
   | N
Progress Analytics
```

---

# 5. Indexes

Create indexes on:

- users.email
- patients.user_id
- exercises.exercise_name
- exercise_sessions.patient_id
- exercise_sessions.exercise_id
- progress.patient_id
- calibration.patient_id

Purpose

Fast lookup

Fast analytics

Efficient filtering

---

# 6. Constraints

Email

Unique

Patient Name

Required

Age

Greater than zero

Height

Positive number

Weight

Positive number

Exercise Accuracy

0–100%

Battery

0–100%

Pressure

Cannot be negative

Angles

Within exercise limits

---

# 7. Soft Deletes

MVP

Not required.

Future

Add:

deleted_at

for recovery.

---

# 8. Audit Fields

Every table should include:

created_at

updated_at

Future

created_by

updated_by

---

# 9. Sample Database Flow

Register User

↓

Create Patient

↓

Login

↓

Calibrate Device

↓

Select Exercise

↓

Start Session

↓

Receive Sensor Data

↓

Calculate Metrics

↓

Save Session

↓

Generate Analytics

↓

Display Dashboard

---

# 10. Future Database Expansion

The schema supports future additions such as:

- Multiple therapists
- Doctor accounts
- Hospitals
- Multiple wearable devices
- AI recommendations
- Recovery prediction
- Exercise templates
- Appointment scheduling
- Notifications
- Cloud synchronization

---

# Database Summary

The SmartPhysio database is designed as a normalized relational schema supporting authentication, patient management, exercise definitions, calibration history, rehabilitation sessions, and progress analytics. The design prioritizes simplicity for the MVP while remaining extensible for future AI-powered rehabilitation, clinician portals, and multi-patient healthcare deployments.