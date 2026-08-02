from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.calibration import CalibrationSession
from app.schemas.calibration import CalibrationSubmit, CalibrationResponse, CalibrationResultResponse

router = APIRouter(
    prefix="/calibration",
    tags=["calibration"]
)

@router.post("/start")
def start_calibration(current_user: User = Depends(get_current_user)):
    # Standard endpoint to trigger calibration initiation
    return {"status": "Started"}

@router.post("/result", response_model=CalibrationResultResponse)
def submit_calibration_result(
    result_in: CalibrationSubmit, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Determine pass/fail based on sensor readings
    # In rule engine: if any status is False, overall fails.
    all_working = (
        result_in.mpu and 
        result_in.pressure and 
        result_in.thumb and 
        result_in.index and 
        result_in.middle and 
        result_in.ring and 
        result_in.little and 
        result_in.elbow
    )
    overall_result = "PASS" if all_working else "FAILED"
    
    # In case battery is too low, we mark it as warning
    if all_working and result_in.battery < 20:
        overall_result = "WARNING"

    # Save to db
    session = CalibrationSession(
        user_id=current_user.id,
        patient_id=result_in.patient_id,
        mpu_status=result_in.mpu,
        pressure_status=result_in.pressure,
        thumb_sensor=result_in.thumb,
        index_sensor=result_in.index,
        middle_sensor=result_in.middle,
        ring_sensor=result_in.ring,
        little_sensor=result_in.little,
        elbow_sensor=result_in.elbow,
        battery_percentage=result_in.battery,
        calibration_result=overall_result
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {"result": overall_result}

@router.get("/history", response_model=List[CalibrationResponse])
def get_calibration_history(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Return sorted historical tests for current user
    history = db.query(CalibrationSession).filter(
        CalibrationSession.user_id == current_user.id
    ).order_by(CalibrationSession.calibration_time.desc()).all()
    return history
