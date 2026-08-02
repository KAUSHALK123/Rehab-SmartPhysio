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
