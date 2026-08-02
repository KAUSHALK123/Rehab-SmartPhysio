import pytest
from fastapi import status
from app.config.config import settings

def test_start_calibration(client, auth_headers):
    response = client.post(
        f"{settings.API_V1_STR}/calibration/start",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "Started"}

def test_submit_calibration_pass(client, auth_headers, test_user, db):
    # Register a patient first
    from app.models.patient import Patient
    
    patient = Patient(
        user_id=test_user.id,
        full_name="Calib Patient",
        age=30,
        gender="Other",
        height_cm=170.0,
        weight_kg=70.0,
        dominant_hand="Left",
        injured_arm="Right",
        injury_type="Elbow surgery"
    )
    db.add(patient)
    db.commit()
    patient_id = patient.id


    payload = {
        "patient_id": patient_id,
        "mpu": True,
        "pressure": True,
        "thumb": True,
        "index": True,
        "middle": True,
        "ring": True,
        "little": True,
        "elbow": True,
        "battery": 90
    }
    response = client.post(
        f"{settings.API_V1_STR}/calibration/result",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["result"] == "PASS"

def test_submit_calibration_fail(client, auth_headers):
    payload = {
        "patient_id": "some-patient-id",
        "mpu": False,  # MPU fails
        "pressure": True,
        "thumb": True,
        "index": True,
        "middle": True,
        "ring": True,
        "little": True,
        "elbow": True,
        "battery": 90
    }
    response = client.post(
        f"{settings.API_V1_STR}/calibration/result",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["result"] == "FAILED"

def test_submit_calibration_warning(client, auth_headers):
    payload = {
        "patient_id": "some-patient-id",
        "mpu": True,
        "pressure": True,
        "thumb": True,
        "index": True,
        "middle": True,
        "ring": True,
        "little": True,
        "elbow": True,
        "battery": 15  # Low battery warning
    }
    response = client.post(
        f"{settings.API_V1_STR}/calibration/result",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["result"] == "WARNING"

def test_get_calibration_history(client, auth_headers):
    response = client.get(
        f"{settings.API_V1_STR}/calibration/history",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
