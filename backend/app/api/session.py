from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.session import ExerciseSession
from app.schemas.session import SessionStart, SessionEnd, SessionResponse
from pydantic import BaseModel

router = APIRouter(
    prefix="/session",
    tags=["session"]
)

# Helper schema to incorporate session_id inside post body
class SessionEndRequest(SessionEnd):
    session_id: str

@router.post("/start")
def start_session(
    session_in: SessionStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify patient ownership
    patient = db.query(Patient).filter(Patient.id == session_in.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to start session for this patient"
        )
        
    new_session = ExerciseSession(
        patient_id=session_in.patient_id,
        exercise_id=session_in.exercise_id,
        start_time=datetime.utcnow()
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return {"session_id": new_session.id}

@router.post("/end")
def end_session(
    session_in: SessionEndRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(ExerciseSession).filter(ExerciseSession.id == session_in.session_id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session record not found"
        )
        
    # Verify patient ownership
    patient = db.query(Patient).filter(Patient.id == session_record.patient_id).first()
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to save session data for this patient"
        )
        
    # Save statistics
    session_record.end_time = datetime.utcnow()
    session_record.duration_seconds = session_in.duration_seconds
    session_record.repetitions_completed = session_in.repetitions_completed
    session_record.repetitions_failed = session_in.repetitions_failed
    session_record.average_angle = session_in.average_angle
    session_record.max_angle = session_in.max_angle
    session_record.average_pressure = session_in.average_pressure
    session_record.exercise_accuracy = session_in.exercise_accuracy
    
    db.commit()
    return {"message": "Session Saved Successfully"}

@router.get("/history", response_model=List[SessionResponse])
def get_session_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve all sessions linked to patients of the logged in user
    sessions = db.query(ExerciseSession).join(Patient).filter(
        Patient.user_id == current_user.id
    ).order_by(ExerciseSession.start_time.desc()).all()
    
    res = []
    for s in sessions:
        res.append({
            "id": s.id,
            "patient_id": s.patient_id,
            "exercise_id": s.exercise_id,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "duration_seconds": s.duration_seconds,
            "repetitions_completed": s.repetitions_completed,
            "repetitions_failed": s.repetitions_failed,
            "average_angle": s.average_angle,
            "max_angle": s.max_angle,
            "average_pressure": s.average_pressure,
            "exercise_accuracy": s.exercise_accuracy,
            "exercise_name": s.exercise.exercise_name if s.exercise else "Exercise",
            "patient_name": s.patient.full_name if s.patient else "Patient"
        })
    return res

@router.get("/{id}", response_model=SessionResponse)
def get_session_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(ExerciseSession).filter(ExerciseSession.id == id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    # Verify patient ownership
    patient = db.query(Patient).filter(Patient.id == session_record.patient_id).first()
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this session details"
        )
        
    return {
        "id": session_record.id,
        "patient_id": session_record.patient_id,
        "exercise_id": session_record.exercise_id,
        "start_time": session_record.start_time,
        "end_time": session_record.end_time,
        "duration_seconds": session_record.duration_seconds,
        "repetitions_completed": session_record.repetitions_completed,
        "repetitions_failed": session_record.repetitions_failed,
        "average_angle": session_record.average_angle,
        "max_angle": session_record.max_angle,
        "average_pressure": session_record.average_pressure,
        "exercise_accuracy": session_record.exercise_accuracy,
        "exercise_name": session_record.exercise.exercise_name if session_record.exercise else "Exercise",
        "patient_name": session_record.patient.full_name if session_record.patient else "Patient"
    }
