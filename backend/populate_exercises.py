import sqlite3
import os
import uuid

def populate_exercises(db_path):
    print(f"Populating exercises in database: {db_path}")
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist. Skipping.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Update existing exercises
    existing_updates = {
        "Ball Squeeze": ("hand", "pressure", "flex_avg"),
        "Wrist Flexion": ("wrist", "wrist_pitch", "wrist_roll"),
        "Wrist Extension": ("wrist", "wrist_pitch", "wrist_roll"),
        "Wrist Rotation": ("wrist", "wrist_roll", "wrist_pitch"),
        "Finger Closing": ("hand", "flex_avg", "wrist_pitch"),
        "Finger Opening": ("hand", "flex_avg", "wrist_pitch"),
        "Elbow Curl": ("elbow", "elbow", "wrist_roll"),
        "Shoulder Raise": ("side", "wrist_pitch", "elbow")
    }
    
    for name, (cam, prim, sec) in existing_updates.items():
        cursor.execute(
            "UPDATE exercises SET camera_view = ?, primary_sensor = ?, secondary_sensor = ? WHERE exercise_name = ?",
            (cam, prim, sec, name)
        )
        print(f"Updated {name} with camera_view={cam}, primary_sensor={prim}, secondary_sensor={sec}")
        
    # 2. Add 'Full Arm' body part if it doesn't exist
    cursor.execute("SELECT id FROM body_parts WHERE name = 'Full Arm'")
    full_arm_row = cursor.fetchone()
    if not full_arm_row:
        full_arm_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO body_parts (id, name) VALUES (?, ?)", (full_arm_id, "Full Arm"))
        print("Inserted 'Full Arm' body part.")
    else:
        full_arm_id = full_arm_row[0]
        
    # 3. Add 'General Arm Diagnostic / Assessment' condition if it doesn't exist
    cursor.execute("SELECT id FROM conditions WHERE name = 'General Arm Diagnostic / Assessment'")
    cond_row = cursor.fetchone()
    if not cond_row:
        cond_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO conditions (id, name, body_part_id) VALUES (?, ?, ?)", (cond_id, "General Arm Diagnostic / Assessment", full_arm_id))
        print("Inserted 'General Arm Diagnostic / Assessment' condition.")
    else:
        cond_id = cond_row[0]
        
    # 4. Insert 4 new diagnostic exercises
    new_exercises = [
        {
            "exercise_name": "Elbow Flex Test",
            "description": "Slowly bend and straighten your elbow to test flex sensor range and calibrate the 3D model elbow joint.",
            "body_part": "Elbow",
            "target_joint": "Elbow",
            "rehabilitation_goal": "Improve Range of Motion",
            "difficulty": "Easy",
            "target_angle": 90.0,
            "minimum_angle": 0.0,
            "maximum_angle": 135.0,
            "target_pressure": 0.0,
            "repetitions": 5,
            "hold_duration": 3,
            "hold_seconds": 3,
            "rest_duration": 3,
            "rest_seconds": 3,
            "required_sensors": "Flex Sensor",
            "camera_view": "elbow",
            "primary_sensor": "elbow",
            "secondary_sensor": "wrist_roll"
        },
        {
            "exercise_name": "Finger Flex Test",
            "description": "Open and close your hand slowly to test all 5 finger flex sensors and calibrate the 3D finger model.",
            "body_part": "Hand/Fingers",
            "target_joint": "Fingers",
            "rehabilitation_goal": "Reduce Stiffness",
            "difficulty": "Easy",
            "target_angle": 70.0,
            "minimum_angle": 0.0,
            "maximum_angle": 90.0,
            "target_pressure": 0.0,
            "repetitions": 5,
            "hold_duration": 3,
            "hold_seconds": 3,
            "rest_duration": 3,
            "rest_seconds": 3,
            "required_sensors": "Flex Sensors",
            "camera_view": "hand",
            "primary_sensor": "flex_avg",
            "secondary_sensor": "pressure"
        },
        {
            "exercise_name": "Wrist Motion Test",
            "description": "Tilt and rotate your wrist to test MPU6050 pitch and roll readings and calibrate wrist 3D movement.",
            "body_part": "Wrist",
            "target_joint": "Wrist",
            "rehabilitation_goal": "Improve Range of Motion",
            "difficulty": "Easy",
            "target_angle": 45.0,
            "minimum_angle": -45.0,
            "maximum_angle": 45.0,
            "target_pressure": 0.0,
            "repetitions": 5,
            "hold_duration": 2,
            "hold_seconds": 2,
            "rest_duration": 2,
            "rest_seconds": 2,
            "required_sensors": "MPU",
            "camera_view": "wrist",
            "primary_sensor": "wrist_pitch",
            "secondary_sensor": "wrist_roll"
        },
        {
            "exercise_name": "Full Arm Diagnostic",
            "description": "Complete arm range of motion test: bend elbow, flex fingers, rotate wrist. Tests all sensors simultaneously.",
            "body_part": "Full Arm",
            "target_joint": "All",
            "rehabilitation_goal": "Improve Range of Motion",
            "difficulty": "Medium",
            "target_angle": 90.0,
            "minimum_angle": 0.0,
            "maximum_angle": 180.0,
            "target_pressure": 0.0,
            "repetitions": 3,
            "hold_duration": 5,
            "hold_seconds": 5,
            "rest_duration": 5,
            "rest_seconds": 5,
            "required_sensors": "All",
            "camera_view": "straight",
            "primary_sensor": "elbow",
            "secondary_sensor": "flex_avg"
        }
    ]
    
    for ex in new_exercises:
        cursor.execute("SELECT id FROM exercises WHERE exercise_name = ?", (ex["exercise_name"],))
        ex_row = cursor.fetchone()
        if not ex_row:
            ex_id = str(uuid.uuid4())
            cursor.execute(
                """INSERT INTO exercises (
                    id, exercise_name, description, body_part, target_joint, rehabilitation_goal,
                    difficulty, target_angle, minimum_angle, maximum_angle, target_pressure,
                    repetitions, hold_duration, hold_seconds, rest_duration, rest_seconds,
                    required_sensors, camera_view, primary_sensor, secondary_sensor, is_system
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                (
                    ex_id, ex["exercise_name"], ex["description"], ex["body_part"], ex["target_joint"],
                    ex["rehabilitation_goal"], ex["difficulty"], ex["target_angle"], ex["minimum_angle"],
                    ex["maximum_angle"], ex["target_pressure"], ex["repetitions"], ex["hold_duration"],
                    ex["hold_seconds"], ex["rest_duration"], ex["rest_seconds"], ex["required_sensors"],
                    ex["camera_view"], ex["primary_sensor"], ex["secondary_sensor"]
                )
            )
            print(f"Inserted new exercise: {ex['exercise_name']}")
            
            # Map condition
            bp_name = ex["body_part"]
            cursor.execute("SELECT id FROM body_parts WHERE name = ?", (bp_name,))
            bp_row = cursor.fetchone()
            if bp_row:
                bp_id = bp_row[0]
                cursor.execute("SELECT id FROM conditions WHERE body_part_id = ?", (bp_id,))
                conds = cursor.fetchall()
                for c_row in conds:
                    c_id = c_row[0]
                    cursor.execute(
                        "INSERT INTO exercise_condition_mapping (exercise_id, condition_id) VALUES (?, ?)",
                        (ex_id, c_id)
                    )
                    print(f"Mapped {ex['exercise_name']} to condition ID: {c_id}")
        else:
            # Update fields for the existing test exercises if they are already present
            cursor.execute(
                """UPDATE exercises SET 
                    description = ?, body_part = ?, target_joint = ?, rehabilitation_goal = ?,
                    difficulty = ?, target_angle = ?, minimum_angle = ?, maximum_angle = ?, target_pressure = ?,
                    repetitions = ?, hold_duration = ?, hold_seconds = ?, rest_duration = ?, rest_seconds = ?,
                    required_sensors = ?, camera_view = ?, primary_sensor = ?, secondary_sensor = ?
                    WHERE exercise_name = ?""",
                (
                    ex["description"], ex["body_part"], ex["target_joint"], ex["rehabilitation_goal"],
                    ex["difficulty"], ex["target_angle"], ex["minimum_angle"], ex["maximum_angle"],
                    ex["target_pressure"], ex["repetitions"], ex["hold_duration"], ex["hold_seconds"],
                    ex["rest_duration"], ex["rest_seconds"], ex["required_sensors"], ex["camera_view"],
                    ex["primary_sensor"], ex["secondary_sensor"], ex["exercise_name"]
                )
            )
            print(f"Updated diagnostic exercise: {ex['exercise_name']}")
            
    conn.commit()
    conn.close()
    print("Database populated successfully.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    populate_exercises(os.path.join(base_dir, "smartphysio.db"))
    populate_exercises(os.path.join(base_dir, "test_smartphysio.db"))
