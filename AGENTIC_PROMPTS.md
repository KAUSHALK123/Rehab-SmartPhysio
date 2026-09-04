# SmartPhysio — Agentic Development Prompts

Use these prompts **one at a time, in order**. Each prompt is designed to be copy-pasted into the agent. Wait for each phase to be fully working before moving to the next.

---

## 📋 Phase 1 Prompt: Fix 3D GLB Model Rotation

```
Fix the 3D GLB arm model in SmartPhysio so that finger flexion, elbow bending, and wrist rotation 
are visually correct and driven by real-time sensor data.

CONTEXT:
- File: frontend/src/components/Arm3DVisualizer.jsx
- GLB: public/models/full_rig.glb
- The GLB has these confirmed node names (Mesh objects, NOT skeleton Bones):
  - Fingers: right_thumb, right_index, right_middle, right_ring, right_little
  - Elbow: right_forearm
  - Wrist: Circle
  - Shoulder: bicep_right
- Mock WebSocket data streams from backend/app/websocket/ws_device.py at 10Hz with a 
  sinusoidal animation (0 to 70 degrees for fingers, 180 to 90 for elbow)

WHAT TO DO:

1. DETERMINE THE CORRECT ROTATION AXIS FOR FINGERS:
   - Open the browser console on /dashboard
   - Look at the [GLB] debug dump to see each finger node's initial x/y/z rotation
   - The axis with a NON-ZERO value in the resting pose is likely the bend axis
   - If all are zero, try each axis: temporarily set rotation.x += 0.5 for right_index, 
     reload, check if it curls naturally. Then try .y and .z.
   - Once confirmed, update the fingerMap.forEach() loop to use the correct axis

2. FIX FINGER RESTING POSITION:
   - Default finger values should be 0 (straight hand)
   - When val=0, finger should be in its original GLB rest pose (no rotation offset)
   - When val=90, finger should be fully curled inward

3. VERIFY ELBOW BENDING:
   - elbowAngle=180 means arm straight (rest position)
   - elbowAngle=90 means forearm bent 90 degrees toward shoulder
   - The mock data oscillates the elbow - confirm it visually bends in the model

4. ADD CAMERA POSITIONS to CameraController:
   - 'elbow': Vector3(1.8, 0.2, 1.8) - zoomed on forearm/elbow
   - 'wrist': Vector3(0.6, -0.3, 1.2) - zoomed on wrist/hand area  
   - 'hand' and 'hand_side' already exist - verify they work

5. VERIFY WRIST ROTATION:
   - wristAngle changes should rotate the Circle node
   - Check the mock data has wrist_roll oscillation

6. REMOVE ALL DEBUG LOGGING after everything works (the [GLB] traverse dump, etc.)

VERIFICATION:
- Open /dashboard then the hand is in natural resting position (fingers straight)
- Mock stream starts then fingers visibly curl and uncurl every ~6 seconds
- Elbow visibly bends when mock elbow data changes  
- No "broken" or dislocated finger positions at any time
- All camera angles (straight, side, hand, hand_side, elbow, wrist) smoothly transition
```

---

## 📋 Phase 2 Prompt: Diagnostic Exercises + Modifiable Camera System

```
Add diagnostic exercises to SmartPhysio with a database-driven camera view and sensor mapping 
system that replaces the fragile exercise-name string matching.

CONTEXT:
- Exercise model: backend/app/models/exercise.py
- Exercise seed data: backend/app/main.py (seed_exercises function)
- Live exercise page: frontend/src/pages/LiveExercisePage.jsx
- 3D Visualizer: frontend/src/components/Arm3DVisualizer.jsx (camera angles already added)
- Current approach: LiveExercisePage matches exercise name strings like 
  nameLower.includes('elbow') to decide which sensor to gauge - this is fragile

WHAT TO DO:

1. ADD 3 NEW COLUMNS TO EXERCISE MODEL (backend/app/models/exercise.py):
   - camera_view: String(50), nullable=True, default='straight'
     Values: 'straight', 'side', 'hand', 'hand_side', 'elbow', 'wrist'
   - primary_sensor: String(50), nullable=True
     Values: 'flex_avg', 'elbow', 'wrist_pitch', 'wrist_roll', 'pressure', 'thumb', 'index', etc.
   - secondary_sensor: String(50), nullable=True
     Same value options as primary_sensor

2. UPDATE EXERCISE SEED DATA (backend/app/main.py):
   Add these fields to ALL existing exercises:
   - Ball Squeeze: camera_view='hand', primary_sensor='pressure', secondary_sensor='flex_avg'
   - Wrist Flexion: camera_view='wrist', primary_sensor='wrist_pitch', secondary_sensor='wrist_roll'
   - Wrist Extension: camera_view='wrist', primary_sensor='wrist_pitch', secondary_sensor='wrist_roll'
   - Wrist Rotation: camera_view='wrist', primary_sensor='wrist_roll', secondary_sensor='wrist_pitch'
   - Finger Closing: camera_view='hand', primary_sensor='flex_avg', secondary_sensor='wrist_pitch'
   - Finger Opening: camera_view='hand', primary_sensor='flex_avg', secondary_sensor='wrist_pitch'
   - Elbow Curl: camera_view='elbow', primary_sensor='elbow', secondary_sensor='wrist_roll'
   - Shoulder Raise: camera_view='side', primary_sensor='wrist_pitch', secondary_sensor='elbow'

   ADD 4 NEW diagnostic exercises:
   - "Elbow Flex Test": body_part='Elbow', target_joint='Elbow', camera_view='elbow',
     primary_sensor='elbow', secondary_sensor='wrist_roll', target_angle=90,
     repetitions=5, hold_duration=3, difficulty='Easy', description='Slowly bend and 
     straighten your elbow to test flex sensor range and calibrate the 3D model elbow joint.',
     required_sensors='Flex Sensor'
   
   - "Finger Flex Test": body_part='Hand/Fingers', target_joint='Fingers', camera_view='hand',
     primary_sensor='flex_avg', secondary_sensor='pressure', target_angle=70,
     repetitions=5, hold_duration=3, difficulty='Easy', description='Open and close your 
     hand slowly to test all 5 finger flex sensors and calibrate the 3D finger model.',
     required_sensors='Flex Sensors'
   
   - "Wrist Motion Test": body_part='Wrist', target_joint='Wrist', camera_view='wrist',
     primary_sensor='wrist_pitch', secondary_sensor='wrist_roll', target_angle=45,
     repetitions=5, hold_duration=2, difficulty='Easy', description='Tilt and rotate your 
     wrist to test MPU6050 pitch and roll readings and calibrate wrist 3D movement.',
     required_sensors='MPU'
   
   - "Full Arm Diagnostic": body_part='Full Arm', target_joint='All', camera_view='straight',
     primary_sensor='elbow', secondary_sensor='flex_avg', target_angle=90,
     repetitions=3, hold_duration=5, difficulty='Medium', description='Complete arm range 
     of motion test: bend elbow, flex fingers, rotate wrist. Tests all sensors simultaneously.',
     required_sensors='All'

3. UPDATE EXERCISE API SCHEMAS to include the 3 new fields in responses.

4. REWRITE LiveExercisePage.jsx SENSOR MATCHING:
   Replace ALL nameLower.includes() checks with a generic sensor resolver:
   
   const getSensorValue = (sensorKey, sensors) => {
     const map = {
       'flex_avg': () => (sensors.thumb + sensors.index + sensors.middle + sensors.ring + sensors.little) / 5,
       'elbow': () => 180 - sensors.elbow,
       'wrist_pitch': () => sensors.wrist_pitch,
       'wrist_roll': () => sensors.wrist_roll,
       'pressure': () => sensors.pressure,
       'thumb': () => sensors.thumb,
       'index': () => sensors.index,
       'middle': () => sensors.middle,
       'ring': () => sensors.ring,
       'little': () => sensors.little,
     };
     return (map[sensorKey] || (() => 0))();
   };
   
   Then the getExerciseFeedback() function uses:
   - exerciseDetails.primary_sensor for the main gauge via getSensorValue()
   - exerciseDetails.secondary_sensor for the form gauge via getSensorValue()
   - exerciseDetails.camera_view for auto-set on load
   
   Keep the gauge title/aim/feedback text configurable based on the sensor type.

5. AUTO-SET CAMERA FROM DB:
   Replace the current body_part matching logic with:
   setCameraAngle(exerciseRes.data.camera_view || 'straight');

6. DELETE smartphysio.db and restart backend to re-seed with new schema.

VERIFICATION:
- After DB reset, /exercises page shows 12 exercises (8 original + 4 new)
- Opening "Elbow Flex Test" causes camera to zoom to elbow, gauge shows elbow angle
- Opening "Finger Flex Test" causes camera to zoom to hand, gauge shows average finger flex
- Opening "Wrist Motion Test" causes camera to zoom to wrist, gauge shows pitch angle
- Opening "Full Arm Diagnostic" shows straight view, gauge shows elbow + finger avg
- Camera dropdown has all 6 options
- ALL original exercises still work correctly with their sensor mappings
- No nameLower.includes() string matching left in the codebase
```

---

## 📋 Phase 3 Prompt: Sensor Dataset Collection Pipeline for AI/ML

```
Build a sensor telemetry recording pipeline that captures all raw sensor data during exercises 
and exports it as CSV files for ML model training.

CONTEXT:
- WebSocket handler: backend/app/websocket/ws_device.py
- Session API: backend/app/api/session.py  
- Exercise session model: backend/app/models/ (check existing session model)
- Patient model has injury_type field we can use as ML label
- Sensor data arrives at 10Hz during exercises (10 values per packet)

WHAT TO DO:

1. CREATE NEW MODEL: backend/app/models/sensor_recording.py
   class SensorRecording(Base):
       __tablename__ = "sensor_recordings"
       id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
       session_id = Column(String(36), ForeignKey("exercise_sessions.session_id"))
       patient_id = Column(String(36))
       exercise_name = Column(String(255))
       injury_type = Column(String(255), nullable=True)
       timestamp_ms = Column(Integer)  # ms since session start
       
       thumb = Column(Float, default=0.0)
       index_finger = Column(Float, default=0.0)
       middle = Column(Float, default=0.0)
       ring = Column(Float, default=0.0)
       little = Column(Float, default=0.0)
       elbow = Column(Float, default=0.0)
       pressure = Column(Float, default=0.0)
       wrist_pitch = Column(Float, default=0.0)
       wrist_roll = Column(Float, default=0.0)

2. RECORD TELEMETRY DURING EXERCISE SESSIONS:
   - In ws_device.py, when an active exercise session exists, buffer incoming sensor_data packets
   - Batch insert every 10 packets (1 second of data) for DB performance
   - Include patient_id, exercise_name, injury_type from the session context
   - timestamp_ms = (current time - session start time) in milliseconds

3. CREATE DATASET EXPORT API: backend/app/api/dataset.py
   - GET /api/v1/datasets/sessions - list all recorded sessions with counts
   - GET /api/v1/datasets/export/{session_id} - download CSV for one session  
   - GET /api/v1/datasets/export-all - download combined CSV of all sessions
   - GET /api/v1/datasets/stats - returns total_recordings, total_sessions, total_duration_mins, 
     injury_distribution dict

4. AUTO-EXPORT CSV ON SESSION END:
   - When endSession() is called in session.py, query all SensorRecording rows for that session
   - Write to datasets/session_{id}_{exercise_name}_{YYYY-MM-DD}.csv
   - Create datasets/ directory if it doesn't exist
   - CSV columns: timestamp_ms,patient_id,exercise_name,injury_type,thumb,index,middle,
     ring,little,elbow,pressure,wrist_pitch,wrist_roll

5. ADD FRONTEND DATASET SECTION (optional):
   - In DashboardPage.jsx, add a "Dataset Manager" card showing:
     - Total recordings count
     - Number of sessions recorded  
     - "Export All" button that downloads the combined CSV
     - Small table of recent sessions with individual download links

VERIFICATION:
- Start any exercise with mock data running and sensor_recordings table fills at 10Hz
- End session and CSV file appears in datasets/ folder with correct data
- GET /datasets/stats returns accurate counts
- CSV is valid and can be opened in Python with pd.read_csv()
- Multiple sessions accumulate correctly without data loss
- The combined export contains all sessions with patient and injury labels
```

---

## Usage Instructions

1. **Copy Phase 1 prompt** then paste into agent then wait for completion then verify everything works
2. **Copy Phase 2 prompt** then paste into agent then wait for completion then verify everything works  
3. **Copy Phase 3 prompt** then paste into agent then wait for completion then verify everything works

> Phase 2 requires deleting smartphysio.db to re-seed the database with new columns. 
> Make sure to re-register your patient after the DB reset.


---

## Phase 4 Prompt: Random Forest ML Integration & Live Inference

```text
The user has generated a custom dataset using the /data-collection page and is ready to fully integrate the Random Forest ML model into the live application.

CONTEXT:
- The dataset is saved as 'dataset.csv' in the backend root directory.
- The training script is 'backend/train_rf_classifier.py'.
- The ML service is 'backend/app/services/ml_service.py'.
- The WebSocket handler broadcasting live data is 'backend/app/websocket/ws_device.py'.
- The live UI displaying the form score is 'frontend/src/pages/LiveExercisePage.jsx'.

WHAT TO DO:

STEP 1: TRAIN THE MODEL
1. Run `python train_rf_classifier.py dataset.csv` in the backend directory.
2. Verify that it outputs a high accuracy score and saves `classifier.joblib` to `backend/app/resources/classifier.joblib`.

STEP 2: WIRE UP THE BACKEND INFERENCE
1. In `backend/app/websocket/ws_device.py`:
   - Import `from app.services.ml_service import ml_service`.
   - Before broadcasting the sensor telemetry to all clients, check if there is an active exercise session.
   - If there is an active session (meaning the user is doing an exercise), call `ml_score = ml_service.evaluate_exercise(active_exercise_name, sensor_data)`.
   - Inject this `ml_score` into the JSON payload that gets sent to the frontend (e.g., `sensor_data["ml_accuracy_score"] = ml_score`).

STEP 3: WIRE UP THE FRONTEND UI
1. In `frontend/src/pages/LiveExercisePage.jsx`:
   - Locate the logic where `formScore` is calculated. Currently, it uses hardcoded math (e.g., `const currentFormScore = calculateFormScore()`).
   - Replace this math logic. Instead, read the new `ml_accuracy_score` directly from the incoming WebSocket packet (`latestData.ml_accuracy_score`).
   - Use this ML-driven score to fill the Form Quality gauge.

STEP 4: VERIFICATION
- Start a mock exercise session.
- Verify in the terminal that `ml_service` is predicting probabilities.
- Verify that the Form Quality gauge on the `LiveExercisePage` dynamically moves based on the ML predictions rather than the old math rules.
```
