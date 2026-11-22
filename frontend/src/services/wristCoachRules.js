/**
 * Wrist AI Coaching Rule-Based Engine & Debounce
 * 
 * Rules:
 * - Moving toward target: "Bend {n} deg more to the {RIGHT|LEFT}"
 * - Within tolerance (+/-5 deg): "Hold it! {t}s"
 * - Overshoot beyond target + tolerance: "Ease back {n} deg - too far"
 * - Moving in wrong direction: "Wrong way - move {DIR}"
 * - Moving too fast: "Slow down"
 * - Shaky/jerky motion: "Keep the movement smooth"
 * - Rest phase: "Relax and rest {n}s"
 * - Set complete: "Great job! Set complete"
 * - No movement for 5s: "Move your wrist {DIR} to {target} deg"
 */

export const COACH_ENABLED_EXERCISES = [
  "Wrist Motion Test",
  "Wrist Rotation",
  "Wrist Flexion",
  "Wrist Extension"
];

export const isCoachEnabledForExercise = (exerciseName) => {
  if (!exerciseName) return false;
  const nameLower = exerciseName.toLowerCase();
  return COACH_ENABLED_EXERCISES.some(ex => nameLower.includes(ex.toLowerCase())) ||
         nameLower.includes("motion test") ||
         nameLower.includes("wrist");
};

/**
 * Evaluates real-time kinematics and returns the primary guidance message.
 */
export function evaluateWristCoachRules({
  currentAngle = 0,
  targetAngle = 45,
  targetDir = "RIGHT",
  repState = "moving",
  holdCountdown = 2,
  restCountdown = 0,
  velocity = 0,
  secondsIdle = 0,
  isJerky = false,
  tolerance = 5,
  velocityThreshold = 120,
  repsCompleted = 0,
  targetReps = 5
}) {
  // 1. Set complete
  if (repsCompleted >= targetReps || repState === "complete") {
    return "Great job! Set complete";
  }

  // 2. Rest phase
  if (repState === "rest") {
    if (restCountdown > 0) {
      return `Relax and rest ${Math.round(restCountdown)}s`;
    }
    if (secondsIdle >= 5) {
      return `Move your wrist ${targetDir} to ${Math.round(Math.abs(targetAngle))} deg`;
    }
    return `Move your wrist ${targetDir} to start`;
  }

  // 3. Target hold phase
  if (repState === "target_hold") {
    return `Hold it! ${Math.max(1, Math.round(holdCountdown))}s`;
  }

  // 4. Kinematics anomalies (speed & jerk)
  if (Math.abs(velocity) > velocityThreshold) {
    return "Slow down";
  }

  if (isJerky) {
    return "Keep the movement smooth";
  }

  // 5. Angular position evaluation
  const curMag = Math.abs(currentAngle);
  const tgtMag = Math.abs(targetAngle);
  const diff = tgtMag - curMag;

  // Within tolerance (+/- 5 deg)
  if (Math.abs(diff) <= tolerance) {
    return `Hold it! ${Math.max(1, Math.round(holdCountdown))}s`;
  }

  // Overshoot
  if (diff < -tolerance) {
    const overshoot = Math.round(curMag - tgtMag);
    return `Ease back ${overshoot} deg - too far`;
  }

  // Wrong direction
  if (targetDir === "RIGHT" && currentAngle < -4) {
    return `Wrong way - move ${targetDir}`;
  }
  if (targetDir === "LEFT" && currentAngle > 4) {
    return `Wrong way - move ${targetDir}`;
  }

  // Moving toward target
  const remaining = Math.max(1, Math.round(diff));
  return `Bend ${remaining} deg more to the ${targetDir}`;
}

function FalseOrBool(val) {
  return Boolean(val);
}

/**
 * Helper class to enforce 700ms debounce on message transitions.
 */
export class WristCoachDebouncer {
  constructor(debounceMs = 700) {
    this.debounceMs = debounceMs;
    this.currentMessage = "";
    this.lastChangeTime = 0;
  }

  update(candidateMessage) {
    const now = Date.now();
    if (!this.currentMessage) {
      this.currentMessage = candidateMessage;
      this.lastChangeTime = now;
      return candidateMessage;
    }

    if (candidateMessage === this.currentMessage) {
      return this.currentMessage;
    }

    // High priority messages update immediately: "Great job! Set complete", "Slow down", "Hold it!"
    const isUrgent = candidateMessage.includes("Set complete") || 
                     candidateMessage.includes("Slow down") || 
                     candidateMessage.startsWith("Hold it!");

    if (isUrgent || (now - this.lastChangeTime >= this.debounceMs)) {
      this.currentMessage = candidateMessage;
      this.lastChangeTime = now;
    }

    return this.currentMessage;
  }
}
