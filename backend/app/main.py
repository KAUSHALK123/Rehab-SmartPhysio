from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import settings
from app.database.database import engine, Base, SessionLocal
from app.api import auth, calibration, device, patient, exercise, session, analytics
from app.websocket import ws_device

# Import models to ensure they are registered with declarative Base
# before calling create_all
from app.models import user
from app.models import calibration as calibration_model
from app.models import patient as patient_model
from app.models import exercise as exercise_model
from app.models import session as session_model

# Automatically create tables for SQLite/dev database
Base.metadata.create_all(bind=engine)

# Database seeding for exercises
def seed_exercises():
    from app.models.exercise import Exercise
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        if db.query(Exercise).count() == 0:
            default_exercises = [
                {
                    "exercise_name": "Ball Squeeze",
                    "description": "Squeeze a soft therapy ball to improve finger flexion, hand stamina, and overall grip strength.",
                    "body_part": "Grip & Fingers",
                    "target_angle": 0.0,
                    "target_pressure": 400.0,
                    "repetitions": 10,
                    "hold_seconds": 5,
                    "rest_seconds": 3,
                    "difficulty": "Easy"
                },
                {
                    "exercise_name": "Wrist Flexion",
                    "description": "Bend your wrist downward towards the inside of your forearm to stretch and strengthen wrist flexors.",
                    "body_part": "Wrist",
                    "target_angle": 60.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_seconds": 3,
                    "rest_seconds": 2,
                    "difficulty": "Easy"
                },
                {
                    "exercise_name": "Wrist Extension",
                    "description": "Bend your wrist upward towards the outside of your forearm to stretch and strengthen wrist extensors.",
                    "body_part": "Wrist",
                    "target_angle": 50.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_seconds": 3,
                    "rest_seconds": 2,
                    "difficulty": "Easy"
                },
                {
                    "exercise_name": "Wrist Rotation",
                    "description": "Rotate your wrist slowly in a circular motion to improve wrist joint mobility, range of motion, and flexibility.",
                    "body_part": "Wrist",
                    "target_angle": 90.0,
                    "target_pressure": 0.0,
                    "repetitions": 8,
                    "hold_seconds": 2,
                    "rest_seconds": 3,
                    "difficulty": "Medium"
                },
                {
                    "exercise_name": "Finger Closing",
                    "description": "Curl all fingers inward to make a tight fist to improve hand flexor endurance and finger joint range.",
                    "body_part": "Fingers",
                    "target_angle": 95.0,
                    "target_pressure": 0.0,
                    "repetitions": 12,
                    "hold_seconds": 4,
                    "rest_seconds": 2,
                    "difficulty": "Easy"
                },
                {
                    "exercise_name": "Finger Opening",
                    "description": "Fully extend and separate your fingers outward to improve extensor strength and reduce joint stiffness.",
                    "body_part": "Fingers",
                    "target_angle": 10.0,
                    "target_pressure": 0.0,
                    "repetitions": 12,
                    "hold_seconds": 3,
                    "rest_seconds": 2,
                    "difficulty": "Easy"
                },
                {
                    "exercise_name": "Elbow Curl",
                    "description": "Bend your elbow to bring your forearm up towards your shoulder, simulating a standard bicep curl to improve elbow range of motion.",
                    "body_part": "Elbow",
                    "target_angle": 130.0,
                    "target_pressure": 0.0,
                    "repetitions": 10,
                    "hold_seconds": 3,
                    "rest_seconds": 3,
                    "difficulty": "Medium"
                },
                {
                    "exercise_name": "Shoulder Raise",
                    "description": "Raise your arm up sideways to shoulder level to improve shoulder rotation, range of motion, and deltoid muscular strength.",
                    "body_part": "Shoulder",
                    "target_angle": 90.0,
                    "target_pressure": 0.0,
                    "repetitions": 8,
                    "hold_seconds": 4,
                    "rest_seconds": 4,
                    "difficulty": "Hard"
                }
            ]
            for ex_data in default_exercises:
                db.add(Exercise(**ex_data))
            db.commit()
            print("Successfully seeded default exercises database table.")
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

def seed_patients():
    from app.models.patient import Patient
    from app.models.user import User
    from sqlalchemy.orm import Session
    
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "testuser@gmail.com").first()
        if user and db.query(Patient).count() == 0:
            p1 = Patient(
                user_id=user.id,
                full_name="Sarah Jenkins",
                age=34,
                gender="Female",
                height_cm=168.0,
                weight_kg=62.0,
                dominant_hand="Right",
                injured_arm="Left",
                injury_type="Rotator Cuff Tear"
            )
            p2 = Patient(
                user_id=user.id,
                full_name="Marcus Vance",
                age=58,
                gender="Male",
                height_cm=182.0,
                weight_kg=88.0,
                dominant_hand="Right",
                injured_arm="Right",
                injury_type="Stroke Hemiparesis"
            )
            db.add(p1)
            db.add(p2)
            db.commit()
            print("Successfully seeded default patient profiles: Sarah Jenkins & Marcus Vance.")
    except Exception as e:
        print(f"Error seeding patients: {e}")
        db.rollback()
    finally:
        db.close()

seed_exercises()
seed_users()
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
