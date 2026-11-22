# GLB 3D Hand Wrist Rotation Calibration & Angle Locks

This document records the confirmed 3D bone rotation constraints and axis mappings for the SmartPhysio GLB arm/wrist rig (`Circle` bone in `/models/full_rig.glb`).

---

## 1. Locked Calibrated Angle Limits

The joint limits are enforced inside `applyCalibratedWristRotation` in `frontend/src/services/wristSensorMapper.js`. Even if incoming sensor data exceeds these ranges, the 3D hand will strictly clamp within natural anatomical limits:

```json
{
  "X": [-36, 43],
  "Y": [-23, 33],
  "Z": [-25, 35]
}
```

### Breakdown by GLB Bone Axis

| GLB Axis | Motion Description | Physical Joint Articulation | Locked Range (Degrees) | Notes |
|:---:|:---|:---|:---:|:---|
| **GLB X** | **Flexion / Extension** | Hand Bends **Up ↕ Down** | **`-36°` to `+43°`** | Negative = extension (up), Positive = flexion (down). Prevents mesh folding past 43°. |
| **GLB Y** | **Pronation / Supination** | Forearm **Twists Left ↔ Right** | **`-23°` to `+33°`** | Prevents glove texture stretching and skin inversion during twist. |
| **GLB Z** | **Radial / Ulnar Deviation** | Hand Waves **Side-to-Side** | **`-25°` to `+35°`** | Constrains left-to-right waving within natural wrist bounds. |

---

## 2. Confirmed Axis Mapping (Applied to All Wrist Exercises)

In `LiveExercisePage.jsx`, the incoming MPU telemetry applies the validated mapping across all wrist exercises:

```javascript
setSensorWristAngles({
  x: wristComputed.angles.z,
  y: wristComputed.angles.y,
  z: wristComputed.angles.x
});
```

* **GLB Bone Rotation:** Handled via `applyCalibratedWristRotation(circleWrist, base, sensorWristAngles, 0.25)` which clamps each axis against `GLB_WRIST_LIMITS`.
* **Joint Safety:** Angles are locked at `X: [-36, 43], Y: [-23, 33], Z: [-25, 35]` without exception.
