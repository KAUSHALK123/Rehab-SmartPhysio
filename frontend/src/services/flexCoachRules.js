/**
 * Flex / Finger AI Coaching Rule-Based Engine & Debounce
 * 
 * Rules for finger flex / fist closing exercises:
 * - Hand open / starting: "Make a fist with at least 3-4 fingers"
 * - Inactive for 5s: "Close your fingers into a fist to start"
 * - Closing fingers: "Close {n} more finger(s) into a fist ({k}/5 closed)"
 * - Within target (>=3 fingers closed): "Hold the fist! {t}s"
 * - Premature opening: "Opened too early - open fully to reset"
 * - Returning to rest: "Open your hand fully to finish rep"
 * - Set complete: "Great job! Set complete"
 */

export const FLEX_ENABLED_EXERCISES = [
  "Finger Closing",
  "Ball Squeeze",
  "Finger Flexion",
  "Hand Grip",
  "Finger Trial"
];

export const isFlexCoachEnabled = (exerciseName) => {
  if (!exerciseName) return false;
  const nameLower = exerciseName.toLowerCase();
  return FLEX_ENABLED_EXERCISES.some(ex => nameLower.includes(ex.toLowerCase())) ||
         nameLower.includes("finger") ||
         nameLower.includes("hand") ||
         nameLower.includes("grip") ||
         nameLower.includes("squeeze");
};

/**
 * Evaluates real-time finger flex telemetry and returns AI coaching guidance text.
 */
export function evaluateFlexCoachRules({
  sensors = {},
  repState = "rest",
  holdCountdown = 2,
  repsCompleted = 0,
  targetReps = 12,
  secondsIdle = 0,
  closedThreshold = 40
}) {
  // 1. Set complete
  if (repsCompleted >= targetReps || repState === "complete") {
    return "Great job! Set complete";
  }

  // Extract individual finger bend percentages (0 - 100%)
  const fingerBends = [
    { name: "Thumb", val: Number(sensors?.thumb ?? 0) },
    { name: "Index", val: Number(sensors?.index ?? 0) },
    { name: "Middle", val: Number(sensors?.middle ?? 0) },
    { name: "Ring", val: Number(sensors?.ring ?? 0) },
    { name: "Little", val: Number(sensors?.little ?? 0) }
  ];

  const closedFingers = fingerBends.filter(f => f.val >= closedThreshold);
  const closedCount = closedFingers.length;
  const avgBend = Math.round(fingerBends.reduce((sum, f) => sum + f.val, 0) / 5);

  // 2. Target Hold Phase
  if (repState === "target_hold") {
    return `Hold the fist! ${Math.max(1, Math.round(holdCountdown))}s`;
  }

  // 3. Returning Phase
  if (repState === "returning") {
    if (closedCount <= 1 && avgBend <= 32) {
      return "Hand open! Relax to begin next rep";
    }
    return "Open your hand fully to finish rep";
  }

  // 4. Moving / Active Closing Phase
  if (repState === "moving") {
    if (closedCount >= 3 || avgBend >= 48) {
      return `Hold the fist! ${Math.max(1, Math.round(holdCountdown))}s`;
    }
    const needed = Math.max(1, 3 - closedCount);
    return `Close ${needed} more finger${needed > 1 ? 's' : ''} into a fist (${closedCount}/5 closed)`;
  }

  // 5. Rest / Starting Phase
  if (repState === "rest") {
    if (closedCount >= 3 || avgBend >= 48) {
      return `Hold the fist! ${Math.max(1, Math.round(holdCountdown))}s`;
    }
    if (closedCount >= 1) {
      const needed = Math.max(1, 3 - closedCount);
      return `Close ${needed} more finger${needed > 1 ? 's' : ''} into a fist (${closedCount}/5 closed)`;
    }
    if (secondsIdle >= 5) {
      return "Close your fingers into a fist to start";
    }
    return "Make a fist with at least 3-4 fingers";
  }

  return "Close your fingers into a fist to begin";
}

/**
 * 700ms debounce helper class for smooth visual text transitions.
 */
export class FlexCoachDebouncer {
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

    // High priority messages update immediately: "Great job! Set complete", "Hold the fist!"
    const isUrgent = candidateMessage.includes("Set complete") || 
                     candidateMessage.startsWith("Hold the fist!") ||
                     candidateMessage.includes("Open your hand");

    if (isUrgent || (now - this.lastChangeTime >= this.debounceMs)) {
      this.currentMessage = candidateMessage;
      this.lastChangeTime = now;
    }

    return this.currentMessage;
  }
}
