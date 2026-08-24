import pytest
from fastapi import status
from app.config.config import settings
from app.models.patient import Patient

@pytest.fixture
def test_patient(db, test_user):
    patient = Patient(
        user_id=test_user.id,
        full_name="John Doe",
        age=45,
        gender="Male",
        height_cm=175.0,
        weight_kg=78.5,
        dominant_hand="Right",
        injured_arm="Left",
        injury_type="Stroke Rehabilitation"
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient

def test_create_patient_success(client, auth_headers):
    payload = {
        "full_name": "Jane Smith",
        "age": 30,
        "gender": "Female",
        "height_cm": 165.0,
        "weight_kg": 60.0,
        "dominant_hand": "Right",
        "injured_arm": "Right",
        "injury_type": "Wrist Fracture"
    }
    response = client.post(
        f"{settings.API_V1_STR}/patients",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "patient_id" in data
    assert data["message"] == "Patient Created"

def test_create_patient_unauthorized(client):
    payload = {
        "full_name": "Jane Smith",
        "age": 30,
        "gender": "Female",
        "height_cm": 165.0,
        "weight_kg": 60.0,
        "dominant_hand": "Right",
        "injured_arm": "Right",
        "injury_type": "Wrist Fracture"
    }
    response = client.post(
        f"{settings.API_V1_STR}/patients",
        json=payload
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_get_patients_list(client, auth_headers, test_patient):
    response = client.get(
        f"{settings.API_V1_STR}/patients",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "John Doe"

def test_get_patient_details_success(client, auth_headers, test_patient):
    response = client.get(
        f"{settings.API_V1_STR}/patients/{test_patient.id}",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["full_name"] == "John Doe"
    assert data["age"] == 45

def test_get_patient_details_not_found(client, auth_headers):
    response = client.get(
        f"{settings.API_V1_STR}/patients/nonexistent-id",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND

def test_update_patient_success(client, auth_headers, test_patient):
    payload = {
        "full_name": "John Updated",
        "age": 46
    }
    response = client.put(
        f"{settings.API_V1_STR}/patients/{test_patient.id}",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["full_name"] == "John Updated"
    assert data["age"] == 46

def test_delete_patient_success(client, auth_headers, test_patient):
    response = client.delete(
        f"{settings.API_V1_STR}/patients/{test_patient.id}",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"message": "Patient Deleted"}

def test_patient_recommendations_and_injury_centric_fields(client, auth_headers, db):
    from app.models.injury import BodyPart, Condition, RehabilitationGoal
    # Fetch seeded entries
    bp = db.query(BodyPart).first()
    cond = db.query(Condition).filter(Condition.body_part_id == bp.id).first()
    goal = db.query(RehabilitationGoal).first()
    
    payload = {
        "full_name": "Injury Centric Patient",
        "age": 35,
        "gender": "Other",
        "height_cm": 170.0,
        "weight_kg": 65.0,
        "dominant_hand": "Left",
        "injured_arm": "Both",
        "body_part_id": bp.id,
        "condition_id": cond.id,
        "rehabilitation_goal_id": goal.id
    }
    
    # Create patient
    response = client.post(
        f"{settings.API_V1_STR}/patients",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_201_CREATED
    patient_id = response.json()["patient_id"]
    
    # Get details
    get_resp = client.get(
        f"{settings.API_V1_STR}/patients/{patient_id}",
        headers=auth_headers
    )
    assert get_resp.status_code == status.HTTP_200_OK
    p_data = get_resp.json()
    assert p_data["body_part_name"] == bp.name
    assert p_data["condition_name"] == cond.name
    assert p_data["rehabilitation_goal_name"] == goal.goal_name
    assert p_data["injury_type"] == cond.name
    
    # Get recommendations
    rec_resp = client.get(
        f"{settings.API_V1_STR}/patients/{patient_id}/recommendations",
        headers=auth_headers
    )
    assert rec_resp.status_code == status.HTTP_200_OK
    recs = rec_resp.json()
    assert len(recs) > 0
    # Every recommended exercise must support this condition
    for r in recs:
        assert cond.name in r["supported_conditions"]

