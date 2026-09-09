# SmartPhysio GLB Calibration Documentation

> **Note**: This document provides technical reference and documentation for 3D GLB model joint calibration in the SmartPhysio application.
> The active runtime source of truth for all calibration parameters is the browser configuration stored in `localStorage` under the key `smartphysio_glb_calibration`.

---

## 1. Wrist Model Calibration (`Circle`)

- **Model GLB**: `/models/full_rig.glb`
- **Target Joint Bone**: `Circle`
- **Parent Joint Bone**: `right_forearm`
- **Rotation Order**: `XYZ` (Euler)
- **Base / Rest Pose Rotation**: `x: -0.009 rad`, `y: 0.002 rad`, `z: 0.008 rad`
- **Movements**:
  - `hiMovement` (Greeting Wave): Radial / Ulnar deviation (`Z` axis rotation)
  - `upDown` (Up/Down Waving): Flexion / Extension (`X` axis rotation)
  - `twist` (Pronation/Supination): Forearm Twist (`Y` axis rotation)

---

## 2. Finger Model Calibration (`right_thumb`, `right_index`, `right_middle`, `right_ring`, `right_little`)

- **Model GLB**: `/models/full_rig.glb`
- **Parent Joint Bone**: `Circle`
- **Rotation Order**: `XYZ` (Euler)
- **Bending Axes**:
  - `right_thumb`: **LOCAL X AXIS ONLY**
  - `right_index`, `right_middle`, `right_ring`, `right_little`: **LOCAL Z AXIS ONLY**
- **Approved Min / Max Bending Ranges**:
  - `thumb`: `x: [-60°, 10°]`, `y: 0°`, `z: 0°`
  - `index`: `z: [-85°, 10°]`, `x: 0°`, `y: 0°`
  - `middle`: `z: [-85°, 10°]`, `x: 0°`, `y: 0°`
  - `ring`: `z: [-80°, 10°]`, `x: 0°`, `y: 0°`
  - `little`: `z: [-75°, 10°]`, `x: 0°`, `y: 0°`

---

## 3. Elbow Model Calibration (`WristArm`)

- **Model GLB**: `/models/elbow.glb`
- **Target Joint Bone**: `WristArm`
- **Parent Joint Bone**: `Object_98`
- **Hierarchy Tree**:
  ```
  ROOT
  └── Object_98 (Upper arm / base mesh container)
      └── WristArm (Forearm & hand rotating assembly)
  ```
- **Rotation Order**: `XYZ` (Euler)
- **Base / Rest Rotation**:
  - `WristArm`: `x: 0.000 rad (0.0°)`, `y: 0.000 rad (0.0°)`, `z: 0.000 rad (0.0°)`
  - `Object_98`: `Quaternion(0, 0.7071068, 0, 0.7071068)` -> `Euler(0, 90°, 0)`
- **Actual LOCAL Bending Axis**: **LOCAL X AXIS ONLY**
- **Rotation Direction**: **Negative X Rotation (`-X`)**
  - `0°`: Full Arm Extension (straight pose)
  - `-90°`: 90° Flexion (right angle bend)
  - `-110°`: Full Flexion (forearm flexed towards bicep/upper arm)
- **Approved Candidate Min / Max Range**:
  - `x`: `{ min: -110, max: 0 }`
  - `y`: `{ min: -15, max: 15 }` (Locked to 0° rest pose during bending)
  - `z`: `{ min: -15, max: 15 }` (Locked to 0° rest pose during bending)
- **Transformation Formula**:
  - `forearmNode.rotation.x = base.x + degToRad(testAngles.x)`
  - `forearmNode.rotation.y = base.y`
  - `forearmNode.rotation.z = base.z`
- **Persistence Storage**:
  Stored in `localStorage` under `smartphysio_glb_calibration` -> `elbow.elbowFlexion`:
  ```json
  {
    "version": 1,
    "elbow": {
      "elbowFlexion": {
        "targetBone": "WristArm",
        "rotationOrder": "XYZ",
        "x": { "min": -110, "max": 0 },
        "y": { "min": -15, "max": 15 },
        "z": { "min": -15, "max": 15 },
        "approved": true,
        "approvedAt": "2026-09-09T12:00:00.000Z"
      }
    }
  }
  ```
