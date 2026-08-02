from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.session import ExerciseSession

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"]
)

def calculate_patient_analytics(patient: Patient, db: Session):
    # Fetch all completed sessions for the patient (oldest first for trend charting)
    sessions = db.query(ExerciseSession).filter(
        ExerciseSession.patient_id == patient.id,
        ExerciseSession.end_time != None
    ).order_by(ExerciseSession.start_time.asc()).all()

    total_sessions = len(sessions)
    avg_accuracy = 0.0
    avg_pressure = 0.0
    avg_angle = 0.0
    max_angle = 0.0
    total_duration = 0
    completed_reps = 0
    failed_reps = 0

    if total_sessions > 0:
        avg_accuracy = sum(s.exercise_accuracy for s in sessions) / total_sessions
        avg_pressure = sum(s.average_pressure for s in sessions) / total_sessions
        avg_angle = sum(s.average_angle for s in sessions) / total_sessions
        max_angle = max(s.max_angle for s in sessions)
        total_duration = sum(s.duration_seconds for s in sessions)
        completed_reps = sum(s.repetitions_completed for s in sessions)
        failed_reps = sum(s.repetitions_failed for s in sessions)

    history_data = []
    for s in sessions:
        history_data.append({
            "id": s.id,
            "exercise_name": s.exercise.exercise_name if s.exercise else "Exercise",
            "date": s.start_time.isoformat(),
            "duration_seconds": s.duration_seconds,
            "repetitions_completed": s.repetitions_completed,
            "repetitions_failed": s.repetitions_failed,
            "average_angle": s.average_angle,
            "max_angle": s.max_angle,
            "average_pressure": s.average_pressure,
            "exercise_accuracy": s.exercise_accuracy
        })

    return {
        "patient_id": patient.id,
        "patient_name": patient.full_name,
        "total_sessions": total_sessions,
        "average_accuracy": round(avg_accuracy, 1),
        "max_range_of_motion": round(max_angle, 1),
        "average_grip_strength": round(avg_pressure, 1),
        "total_duration_seconds": total_duration,
        "total_repetitions_completed": completed_reps,
        "total_repetitions_failed": failed_reps,
        "history": history_data
      }

@router.get("/dashboard")
def get_dashboard_analytics(
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found"
            )
        if patient.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access details for this patient"
            )
    else:
        # Check first patient managed by this user
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return {
                "patient_id": None,
                "patient_name": None,
                "total_sessions": 0,
                "average_accuracy": 0.0,
                "max_range_of_motion": 0.0,
                "average_grip_strength": 0.0,
                "total_duration_seconds": 0,
                "total_repetitions_completed": 0,
                "total_repetitions_failed": 0,
                "history": []
            }
            
    return calculate_patient_analytics(patient, db)

@router.get("/patient/{id}")
def get_patient_analytics(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access details for this patient"
        )
        
    return calculate_patient_analytics(patient, db)
