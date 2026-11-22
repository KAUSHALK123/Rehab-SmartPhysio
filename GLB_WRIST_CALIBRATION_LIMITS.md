# GLB 3D Hand Wrist Rotation Calibration & Angle Locks

This document records the locked 3D bone rotation constraints for the SmartPhysio GLB arm/wrist rig (`Circle` bone in `/models/full_rig.glb`).

---

## Calibrated Locked Values

```json
{
  "X": [-36, 43],
  "Y": [-23, 33],
  "Z": [-25, 35]
}
```

### Breakdown by Axis & Anatomical Motion

| GLB Axis | Motion Description | MPU Source Sensor | Calibrated Range (Degrees) | Notes |
|:---:|:---|:---:|:---:|:---|
| **GLB X** | **Flexion / Extension** (Hand Bend Up/Down) | `wrist_pitch` | **`-36°` to `+43°`** | Negative = extension (up), Positive = flexion (down). Prevents mesh folding past 43°. |
| **GLB Y** | **Pronation / Supination** (Forearm Twist / Roll) | `wrist_roll` | **`-23°` to `+33°`** | Locks twist to prevent sleeve texture stretching and skin inversion. |
| **GLB Z** | **Radial / Ulnar Deviation** (Hand Wave Left/Right) | `wrist_yaw` | **`-25°` to `+35°`** | Hand side-to-side tilt. Locks within natural wrist joint articulation. |

---

## Enforcement in Codebase

1. **Global Bone Rotation Clamping (`wristSensorMapper.js`):**
   - Implemented in `applyCalibratedWristRotation`:
   ```javascript
   export const GLB_WRIST_LIMITS = {
     x: { min: -36, max: 43 },
     y: { min: -23, max: 33 },
     z: { min: -25, max: 35 }
   };
   ```
   - Every 3D visualizer (`Arm3DVisualizer`, `Trial3DVisualizer`, `WristMotionDemoCard`) calls this function.
   - Even if raw MPU values spike or rotate beyond these thresholds, the GLB 3D wrist clamps safely to these exact min/max bounds.

2. **Wrist Limit Tuner Panel (`WristLimitTunerPanel.jsx`):**
   - Default limits initialized to `ORIGINAL_LIMITS`:
   ```javascript
   export const ORIGINAL_LIMITS = {
     X: [-36, 43],
     Y: [-23, 33],
     Z: [-25, 35]
   };
   ```
   - In `MPU Live` mode, values are clamped against these boundaries.
   - Re-zero (`Z`) offsets IMU yaw/pitch drift while preserving the clamped boundary.
   - "Copy Limits JSON" outputs the JSON formatted string for verification.


---

## MPU Physical Axis Mapping & Swapping

Due to the physical mounting orientation of the MPU6050 chip on the glove fabric/PCB:
- **MPU X axis (`mpu.getAngleX()` / incoming `wrist_pitch`)**: Corresponds to forearm twist (Roll / Pronation & Supination -> GLB Y).
- **MPU Y axis (`mpu.getAngleY()` / incoming `wrist_roll`)**: Corresponds to hand bend (Pitch / Flexion & Extension -> GLB X).

In `LiveExercisePage.jsx`, incoming telemetry is mapped so:
```javascript
const rawPitch = data.wrist_roll ?? data.roll ?? 0.0;
const rawRoll = data.wrist_pitch ?? data.pitch ?? 0.0;
```
This ensures hand pitch movements physically move the GLB hand up and down, while forearm twist movements rotate the GLB forearm.
