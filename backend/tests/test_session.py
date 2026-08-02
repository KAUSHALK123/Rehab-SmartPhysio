import pytest
from fastapi import status
from app.config.config import settings
from app.models.patient import Patient
from app.models.exercise import Exercise

@pytest.fixture
def test_data(db, test_user):
    patient = Patient(
        user_id=test_user.id,
        full_name="Session Patient",
        age=32,
        gender="Male",
        height_cm=180.0,
        weight_kg=85.0,
        dominant_hand="Right",
        injured_arm="Left",
        injury_type="Frozen Shoulder"
    )
    db.add(patient)
    
    # Check if we need to manually add an exercise
    exercise = db.query(Exercise).first()
    if not exercise:
        exercise = Exercise(
            exercise_name="Test Exercise",
            description="Description",
            body_part="Elbow",
            target_angle=90.0,
            target_pressure=0.0,
            repetitions=10,
            hold_seconds=3,
            rest_seconds=2,
            difficulty="Easy"
        )
        db.add(exercise)
    
    db.commit()
    db.refresh(patient)
    db.refresh(exercise)
    return {"patient": patient, "exercise": exercise}

def test_session_flow_success(client, auth_headers, test_data):
    patient_id = test_data["patient"].id
    exercise_id = test_data["exercise"].id

    # 1. Start Session
    start_payload = {
        "patient_id": patient_id,
        "exercise_id": exercise_id
    }
    response = client.post(
        f"{settings.API_V1_STR}/session/start",
        json=start_payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    session_id = response.json()["session_id"]
    assert session_id is not None

    # 2. End Session
    end_payload = {
        "session_id": session_id,
        "patient_id": patient_id,
        "duration_seconds": 60,
        "repetitions_completed": 8,
        "repetitions_failed": 2,
        "average_angle": 88.5,
        "max_angle": 92.0,
        "average_pressure": 0.0,
        "exercise_accuracy": 80.0
    }
    response = client.post(
        f"{settings.API_V1_STR}/session/end",
        json=end_payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"message": "Session Saved Successfully"}

    # 3. Get History
    response = client.get(
        f"{settings.API_V1_STR}/session/history",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    history = response.json()
    assert len(history) >= 1
    assert history[0]["id"] == session_id
    assert history[0]["exercise_name"] == test_data["exercise"].exercise_name

    # 4. Get Details
    response = client.get(
        f"{settings.API_V1_STR}/session/{session_id}",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    details = response.json()
    assert details["duration_seconds"] == 60
    assert details["exercise_accuracy"] == 80.0
