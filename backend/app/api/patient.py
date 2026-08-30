from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.injury import PatientCondition, Condition
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.schemas.exercise import ExerciseResponse

router = APIRouter(
    prefix="/patients",
    tags=["patients"]
)

@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_patient = Patient(
        user_id=current_user.id,
        full_name=patient_in.full_name,
        age=patient_in.age,
        gender=patient_in.gender,
        height_cm=patient_in.height_cm,
        weight_kg=patient_in.weight_kg,
        dominant_hand=patient_in.dominant_hand,
        affected_side=patient_in.affected_side,
        rehabilitation_goal_id=patient_in.rehabilitation_goal_id
    )
    db.add(new_patient)
    db.flush()
    
    # Map multiple conditions
    for cond_id in patient_in.condition_ids:
        pc = PatientCondition(patient_id=new_patient.id, condition_id=cond_id)
        db.add(pc)
        
    db.commit()
    db.refresh(new_patient)
    
    return {
        "patient_id": new_patient.id,
        "message": "Patient Created"
    }

@router.get("", response_model=List[PatientResponse])
def get_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patients = db.query(Patient).filter(Patient.user_id == current_user.id).all()
    return patients

@router.get("/{id}", response_model=PatientResponse)
def get_patient_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this patient profile"
        )
    return patient

@router.put("/{id}", response_model=PatientResponse)
def update_patient(
    id: str,
    patient_in: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this patient profile"
        )
        
    # Update fields provided in request
    update_data = patient_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
        
    # Sync patient_conditions if condition_ids updated
    if "condition_ids" in update_data:
        cond_ids = update_data["condition_ids"]
        # Delete old mapping
        db.query(PatientCondition).filter(PatientCondition.patient_id == patient.id).delete()
        if cond_ids:
            for c_id in cond_ids:
                pc = PatientCondition(patient_id=patient.id, condition_id=c_id)
                db.add(pc)
            
    db.commit()
    db.refresh(patient)
    return patient

@router.delete("/{id}")
def delete_patient(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this patient profile"
        )
        
    db.delete(patient)
    db.commit()
    return {"message": "Patient Deleted"}

@router.get("/{id}/recommendations", response_model=List[ExerciseResponse])
def get_patient_recommendations(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    if patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this patient's recommendations"
        )
        
    if not patient.conditions:
        return []
        
    from app.models.injury import ExerciseConditionMapping
    from app.models.exercise import Exercise
    from app.models.calibration import CalibrationSession
    
    cond_ids = [c.id for c in patient.conditions]
    
    exercises = db.query(Exercise).join(
        ExerciseConditionMapping, Exercise.id == ExerciseConditionMapping.exercise_id
    ).filter(
        ExerciseConditionMapping.condition_id.in_(cond_ids)
    ).all()
    
    # Query the latest calibration session for this patient to check range of motion (ROM) bounds
    latest_cal = db.query(CalibrationSession).filter(
        CalibrationSession.patient_id == patient.id
    ).order_by(CalibrationSession.calibration_time.desc()).first()
    
    is_stiff = False
    if latest_cal:
        finger_ranges = []
        if latest_cal.thumb_min is not None and latest_cal.thumb_max is not None:
            finger_ranges.append(abs(latest_cal.thumb_max - latest_cal.thumb_min))
        if latest_cal.index_min is not None and latest_cal.index_max is not None:
            finger_ranges.append(abs(latest_cal.index_max - latest_cal.index_min))
        if latest_cal.middle_min is not None and latest_cal.middle_max is not None:
            finger_ranges.append(abs(latest_cal.middle_max - latest_cal.middle_min))
        if latest_cal.ring_min is not None and latest_cal.ring_max is not None:
            finger_ranges.append(abs(latest_cal.ring_max - latest_cal.ring_min))
        if latest_cal.little_min is not None and latest_cal.little_max is not None:
            finger_ranges.append(abs(latest_cal.little_max - latest_cal.little_min))
            
        # Stiff diagnosis: If any finger range of motion is less than 800 ADC units (highly rigid hand joint)
        if finger_ranges and any(r < 800 for r in finger_ranges):
            is_stiff = True
            
    recommended_exercises = []
    for ex in exercises:
        # Expunge from session so in-memory changes are never committed back to DB
        db.expunge(ex)
        
        if is_stiff:
            ex.difficulty = "Easy"
            ex.repetitions = max(5, ex.repetitions // 2)
            if ex.target_angle > 45.0:
                ex.target_angle = 45.0
            if ex.target_pressure > 300.0:
                ex.target_pressure = 300.0
            ex.description = f"[Stiffness Relief Plan] Adjusted for your limited mobility: {ex.description}"
            
        recommended_exercises.append(ex)
        
    return recommended_exercises
