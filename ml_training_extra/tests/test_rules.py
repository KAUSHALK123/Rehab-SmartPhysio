"""
Unit tests for the rule-based coaching logic.
Tests all 9 message rules:
1. Moving toward target: "Bend {n} deg more to the {DIR}"
2. Within tolerance (+/-5 deg): "Hold it! {t}s"
3. Overshoot beyond target: "Ease back {n} deg - too far"
4. Moving in wrong direction: "Wrong way - move {DIR}"
5. Moving too fast: "Slow down"
6. Shaky/jerky motion: "Keep the movement smooth"
7. Rest phase: "Relax and rest {n}s"
8. Set complete: "Great job! Set complete"
9. No movement for 5s: "Move your wrist {DIR} to {target} deg"
"""

import pytest

def evaluate_wrist_rules(
    current_angle,
    target_angle,
    target_dir="RIGHT",
    rep_state="moving",
    hold_countdown=2,
    rest_countdown=0,
    velocity=15.0,
    seconds_idle=0.0,
    is_jerky=False,
    tolerance=5.0,
    velocity_threshold=120.0,
    reps_completed=0,
    target_reps=5
):
    if reps_completed >= target_reps or rep_state == "complete":
        return "Great job! Set complete"

    if rep_state == "rest":
        if rest_countdown > 0:
            return f"Relax and rest {round(rest_countdown)}s"
        if seconds_idle >= 5.0:
            return f"Move your wrist {target_dir} to {round(abs(target_angle))} deg"
        return f"Move your wrist {target_dir} to start"

    if rep_state == "target_hold":
        return f"Hold it! {max(1, round(hold_countdown))}s"

    # Active 'moving' state
    if abs(velocity) > velocity_threshold:
        return "Slow down"

    if is_jerky:
        return "Keep the movement smooth"

    # Target comparison
    diff = abs(target_angle) - abs(current_angle)
    
    # Within tolerance
    if abs(diff) <= tolerance:
        return f"Hold it! {max(1, round(hold_countdown))}s"

    # Overshoot
    if diff < -tolerance:
        overshoot = round(abs(current_angle) - abs(target_angle))
        return f"Ease back {overshoot} deg - too far"

    # Wrong direction
    if target_dir == "RIGHT" and current_angle < -4.0:
        return f"Wrong way - move {target_dir}"
    if target_dir == "LEFT" and current_angle > 4.0:
        return f"Wrong way - move {target_dir}"

    # Moving toward target
    remaining = max(1, round(diff))
    return f"Bend {remaining} deg more to the {target_dir}"

def test_set_complete_rule():
    msg = evaluate_wrist_rules(0, 45, reps_completed=5, target_reps=5)
    assert "Great job! Set complete" in msg

def test_moving_toward_target_rule():
    msg = evaluate_wrist_rules(current_angle=20, target_angle=45, target_dir="RIGHT")
    assert msg == "Bend 25 deg more to the RIGHT"

def test_within_tolerance_rule():
    msg = evaluate_wrist_rules(current_angle=43, target_angle=45, hold_countdown=2)
    assert msg == "Hold it! 2s"

def test_overshoot_rule():
    msg = evaluate_wrist_rules(current_angle=55, target_angle=45, target_dir="RIGHT")
    assert msg == "Ease back 10 deg - too far"

def test_wrong_direction_rule():
    msg = evaluate_wrist_rules(current_angle=-15, target_angle=45, target_dir="RIGHT")
    assert msg == "Wrong way - move RIGHT"

def test_too_fast_rule():
    msg = evaluate_wrist_rules(current_angle=20, target_angle=45, velocity=150.0)
    assert msg == "Slow down"

def test_jerky_motion_rule():
    msg = evaluate_wrist_rules(current_angle=20, target_angle=45, is_jerky=True)
    assert msg == "Keep the movement smooth"

def test_rest_phase_rule():
    msg = evaluate_wrist_rules(current_angle=0, target_angle=45, rep_state="rest", rest_countdown=3.0)
    assert msg == "Relax and rest 3s"

def test_idle_timeout_rule():
    msg = evaluate_wrist_rules(current_angle=0, target_angle=45, target_dir="RIGHT", rep_state="rest", seconds_idle=5.5)
    assert msg == "Move your wrist RIGHT to 45 deg"
