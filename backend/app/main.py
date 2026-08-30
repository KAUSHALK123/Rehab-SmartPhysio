from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import settings
from app.database.database import engine, Base, SessionLocal
from app.api import auth, calibration, device, patient, exercise, session, analytics, injury
from app.websocket import ws_device

# Import models to ensure they are registered with declarative Base
# before calling create_all
from app.models import user
from app.models import calibration as calibration_model
from app.models import patient as patient_model
from app.models import exercise as exercise_model
from app.models import session as session_model
from app.models import injury as injury_model

# Automatically create tables for SQLite/dev database
Base.metadata.create_all(bind=engine)

# Database seeding for exercises
def seed_exercises():
    from app.models.exercise import Exercise
    from app.models.injury import Condition, ExerciseConditionMapping
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        if db.query(Exercise).count() == 0:
            default_exercises = [
                {
                    "exercise_name": "Ball Squeeze",
                    "description": "Squeeze a soft therapy ball to improve finger flexion, hand stamina, and overall grip strength.",
                    "body_part": "Hand/Fingers",
                    "target_joint": "Fingers",
                    "rehabilitation_goal": "Increase Strength",
                    "difficulty": "Easy",
                    "target_angle": 0.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 100.0,
                    "target_pressure": 400.0,
                    "repetitions": 10,
                    "hold_duration": 5,
                    "hold_seconds": 5,
                    "rest_duration": 3,
                    "rest_seconds": 3,
                    "required_sensors": "Pressure Sensor",
                    "camera_view": "hand",
                    "primary_sensor": "pressure",
                    "secondary_sensor": "flex_avg"
                },
                {
                    "exercise_name": "Wrist Flexion",
                    "description": "Bend your wrist downward towards the inside of your forearm to stretch and strengthen wrist flexors.",
                    "body_part": "Wrist",
                    "target_joint": "Wrist",
                    "rehabilitation_goal": "Improve Range of Motion",
                    "difficulty": "Easy",
                    "target_angle": 60.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 90.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_duration": 3,
                    "hold_seconds": 3,
                    "rest_duration": 2,
                    "rest_seconds": 2,
                    "required_sensors": "MPU",
                    "camera_view": "wrist",
                    "primary_sensor": "wrist_pitch",
                    "secondary_sensor": "wrist_roll"
                },
                {
                    "exercise_name": "Wrist Extension",
                    "description": "Bend your wrist upward towards the outside of your forearm to stretch and strengthen wrist extensors.",
                    "body_part": "Wrist",
                    "target_joint": "Wrist",
                    "rehabilitation_goal": "Improve Range of Motion",
                    "difficulty": "Easy",
                    "target_angle": 50.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 90.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_duration": 3,
                    "hold_seconds": 3,
                    "rest_duration": 2,
                    "rest_seconds": 2,
                    "required_sensors": "MPU",
                    "camera_view": "wrist",
                    "primary_sensor": "wrist_pitch",
                    "secondary_sensor": "wrist_roll"
                },
                {
                    "exercise_name": "Wrist Rotation",
                    "description": "Rotate your wrist slowly in a circular motion to improve wrist joint mobility, range of motion, and flexibility.",
                    "body_part": "Wrist",
                    "target_joint": "Wrist",
                    "rehabilitation_goal": "Improve Range of Motion",
                    "difficulty": "Medium",
                    "target_angle": 90.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 120.0,
                    "target_pressure": 0.0,
                    "repetitions": 8,
                    "hold_duration": 2,
                    "hold_seconds": 2,
                    "rest_duration": 3,
                    "rest_seconds": 3,
                    "required_sensors": "MPU",
                    "camera_view": "wrist",
                    "primary_sensor": "wrist_roll",
                    "secondary_sensor": "wrist_pitch"
                },
                {
                    "exercise_name": "Finger Closing",
                    "description": "Curl all fingers inward to make a tight fist to improve hand flexor endurance and finger joint range.",
                    "body_part": "Hand/Fingers",
                    "target_joint": "Fingers",
                    "rehabilitation_goal": "Reduce Stiffness",
                    "difficulty": "Easy",
                    "target_angle": 95.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 100.0,
                    "target_pressure": 0.0,
                    "repetitions": 12,
                    "hold_duration": 4,
                    "hold_seconds": 4,
                    "rest_duration": 2,
                    "rest_seconds": 2,
                    "required_sensors": "Flex Sensors",
                    "camera_view": "hand",
                    "primary_sensor": "flex_avg",
                    "secondary_sensor": "wrist_pitch"
                },
                {
                    "exercise_name": "Finger Opening",
                    "description": "Fully extend and separate your fingers outward to improve extensor strength and reduce joint stiffness.",
                    "body_part": "Hand/Fingers",
                    "target_joint": "Fingers",
                    "rehabilitation_goal": "Reduce Stiffness",
                    "difficulty": "Easy",
                    "target_angle": 10.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 100.0,
                    "target_pressure": 0.0,
                    "repetitions": 12,
                    "hold_duration": 3,
                    "hold_seconds": 3,
                    "rest_duration": 2,
                    "rest_seconds": 2,
                    "required_sensors": "Flex Sensors",
                    "camera_view": "hand",
                    "primary_sensor": "flex_avg",
                    "secondary_sensor": "wrist_pitch"
                },
                {
                    "exercise_name": "Elbow Curl",
                    "description": "Bend your elbow to bring your forearm up towards your shoulder, simulating a standard bicep curl to improve elbow range of motion.",
                    "body_part": "Elbow",
                    "target_joint": "Elbow",
                    "rehabilitation_goal": "Improve Range of Motion",
                    "difficulty": "Medium",
                    "target_angle": 130.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 180.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_duration": 3,
                    "hold_seconds": 3,
                    "rest_duration": 3,
                    "rest_seconds": 3,
                    "required_sensors": "MPU",
                    "camera_view": "elbow",
                    "primary_sensor": "elbow",
                    "secondary_sensor": "wrist_roll"
                },
                {
                    "exercise_name": "Shoulder Raise",
                    "description": "Raise your arm up sideways to shoulder level to improve shoulder rotation, range of motion, and deltoid muscular strength.",
                    "body_part": "Shoulder",
                    "target_joint": "Shoulder",
                    "rehabilitation_goal": "Improve Range of Motion",
                    "difficulty": "Hard",
                    "target_angle": 90.0,
                    "minimum_angle": 0.0,
                    "maximum_angle": 120.0,
                    "target_pressure": 0.0,
                    "repetitions": 8,
                    "hold_duration": 4,
                    "hold_seconds": 4,
                    "rest_duration": 4,
                    "rest_seconds": 4,
                    "required_sensors": "MPU",
                    "camera_view": "side",
                    "primary_sensor": "wrist_pitch",
                    "secondary_sensor": "elbow"
                },
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
            for ex_data in default_exercises:
                db.add(Exercise(**ex_data))
            db.commit()
            print("Successfully seeded default exercises database table.")

        if db.query(ExerciseConditionMapping).count() == 0:
            exercises = db.query(Exercise).all()
            for ex in exercises:
                bp_name = ex.body_part
                conds = db.query(Condition).join(Condition.body_part).filter(Condition.body_part.has(name=bp_name)).all()
                for c in conds:
                    mapping = ExerciseConditionMapping(exercise_id=ex.id, condition_id=c.id)
                    db.add(mapping)
            db.commit()
            print("Successfully seeded exercise to condition mappings.")
    except Exception as e:
        print(f"Error seeding exercises database: {e}")
        db.rollback()
    finally:
        db.close()

def seed_users():
    from app.models.user import User
    from app.services.auth_service import get_password_hash
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == "testuser@gmail.com").first()
        if not existing_user:
            hashed = get_password_hash("Password123")
            new_user = User(
                email="testuser@gmail.com",
                password_hash=hashed
            )
            db.add(new_user)
            db.commit()
            print("Successfully seeded default test user: testuser@gmail.com / Password123")
    except Exception as e:
        print(f"Error seeding user: {e}")
        db.rollback()
    finally:
        db.close()

def seed_injuries():
    from app.models.injury import BodyPart, Condition, RehabilitationGoal
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        body_parts_data = ["Wrist", "Elbow", "Shoulder", "Hand/Fingers", "Full Arm"]
        body_parts_dict = {}
        for bp_name in body_parts_data:
            bp = db.query(BodyPart).filter(BodyPart.name == bp_name).first()
            if not bp:
                bp = BodyPart(name=bp_name)
                db.add(bp)
                db.flush()
            body_parts_dict[bp_name] = bp.id
            
        conditions_data = {
            "Wrist": [
                "Wrist Sprain",
                "Wrist Fracture Recovery",
                "Wrist Tendonitis",
                "Carpal Tunnel Syndrome"
            ],
            "Elbow": [
                "Tennis Elbow",
                "Golfer's Elbow",
                "Elbow Sprain",
                "Elbow Stiffness / Post-Fracture Recovery"
            ],
            "Shoulder": [
                "Rotator Cuff Rehabilitation",
                "Frozen Shoulder",
                "Shoulder Stiffness",
                "Shoulder Impingement Rehabilitation"
            ],
            "Hand/Fingers": [
                "Finger Sprain",
                "Finger Stiffness",
                "Reduced Grip Strength",
                "Hand Rehabilitation"
            ],
            "Full Arm": [
                "General Arm Diagnostic / Assessment"
            ]
        }
        
        for bp_name, conds in conditions_data.items():
            bp_id = body_parts_dict[bp_name]
            for cond_name in conds:
                cond = db.query(Condition).filter(Condition.name == cond_name).first()
                if not cond:
                    cond = Condition(name=cond_name, body_part_id=bp_id)
                    db.add(cond)
                    
        goals_data = [
            "Improve Range of Motion",
            "Increase Strength",
            "Reduce Stiffness",
            "Enhance Joint Stability",
            "Pain Management / Recovery"
        ]
        for goal_name in goals_data:
            goal = db.query(RehabilitationGoal).filter(RehabilitationGoal.goal_name == goal_name).first()
            if not goal:
                goal = RehabilitationGoal(goal_name=goal_name)
                db.add(goal)
                
        db.commit()
        print("Successfully seeded predefined injury categories and rehabilitation goals.")
    except Exception as e:
        print(f"Error seeding injuries: {e}")
        db.rollback()
    finally:
        db.close()

def seed_patients():
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.injury import BodyPart, Condition, RehabilitationGoal, PatientCondition
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "testuser@gmail.com").first()
        if user and db.query(Patient).count() == 0:
            bp_shoulder = db.query(BodyPart).filter(BodyPart.name == "Shoulder").first()
            cond_rotator = db.query(Condition).filter(Condition.name == "Rotator Cuff Rehabilitation").first()
            goal_rom = db.query(RehabilitationGoal).filter(RehabilitationGoal.goal_name == "Improve Range of Motion").first()
            
            bp_wrist = db.query(BodyPart).filter(BodyPart.name == "Wrist").first()
            cond_sprain = db.query(Condition).filter(Condition.name == "Wrist Sprain").first()
            goal_strength = db.query(RehabilitationGoal).filter(RehabilitationGoal.goal_name == "Increase Strength").first()

            p1 = Patient(
                user_id=user.id,
                full_name="Sarah Jenkins",
                age=34,
                gender="Female",
                height_cm=168.0,
                weight_kg=62.0,
                dominant_hand="Right",
                affected_side="Left",
                rehabilitation_goal_id=goal_rom.id if goal_rom else None
            )
            p2 = Patient(
                user_id=user.id,
                full_name="Marcus Vance",
                age=58,
                gender="Male",
                height_cm=182.0,
                weight_kg=88.0,
                dominant_hand="Right",
                affected_side="Right",
                rehabilitation_goal_id=goal_strength.id if goal_strength else None
            )
            db.add(p1)
            db.add(p2)
            db.flush()

            if cond_rotator:
                db.add(PatientCondition(patient_id=p1.id, condition_id=cond_rotator.id))
            if cond_sprain:
                db.add(PatientCondition(patient_id=p2.id, condition_id=cond_sprain.id))

            db.commit()
            print("Successfully seeded default patient profiles.")
    except Exception as e:
        print(f"Error seeding patients: {e}")
        db.rollback()
    finally:
        db.close()

seed_users()
seed_injuries()
seed_exercises()
seed_patients()

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware to allow connection from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(calibration.router, prefix=settings.API_V1_STR)
app.include_router(device.router, prefix=settings.API_V1_STR)
app.include_router(ws_device.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(exercise.router, prefix=settings.API_V1_STR)
app.include_router(session.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(injury.router, prefix=settings.API_V1_STR)

from app.api import anatomy
app.include_router(anatomy.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartPhysio API", "version": "1.0.0"}

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "database": "connected"
    }
