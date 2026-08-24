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
    cond_name = None
    if patient_in.condition_id:
        cond = db.query(Condition).filter(Condition.id == patient_in.condition_id).first()
        if cond:
            cond_name = cond.name

    new_patient = Patient(
        user_id=current_user.id,
        full_name=patient_in.full_name,
        age=patient_in.age,
        gender=patient_in.gender,
        height_cm=patient_in.height_cm,
        weight_kg=patient_in.weight_kg,
        dominant_hand=patient_in.dominant_hand,
        injured_arm=patient_in.injured_arm,
        injury_type=cond_name or patient_in.injury_type or "Unknown",
        body_part_id=patient_in.body_part_id,
        condition_id=patient_in.condition_id,
        rehabilitation_goal_id=patient_in.rehabilitation_goal_id
    )
    db.add(new_patient)
    db.flush()
    
    if patient_in.condition_id:
        pc = PatientCondition(patient_id=new_patient.id, condition_id=patient_in.condition_id)
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
        
    # Sync injury_type and patient_conditions if condition_id updated
    if "condition_id" in update_data:
        cond_id = update_data["condition_id"]
        # Delete old mapping
        db.query(PatientCondition).filter(PatientCondition.patient_id == patient.id).delete()
        if cond_id:
            cond = db.query(Condition).filter(Condition.id == cond_id).first()
            if cond:
                patient.injury_type = cond.name
                pc = PatientCondition(patient_id=patient.id, condition_id=cond_id)
                db.add(pc)
            else:
                patient.injury_type = None
        else:
            patient.injury_type = None
            
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
        
    if not patient.condition_id:
        return []
        
    from app.models.injury import ExerciseConditionMapping
    from app.models.exercise import Exercise
    exercises = db.query(Exercise).join(
        ExerciseConditionMapping, Exercise.id == ExerciseConditionMapping.exercise_id
    ).filter(
        ExerciseConditionMapping.condition_id == patient.condition_id
    ).all()
    
    return exercises
