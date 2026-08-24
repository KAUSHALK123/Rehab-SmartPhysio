from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.injury import BodyPart, Condition, RehabilitationGoal, ExerciseConditionMapping
from app.models.exercise import Exercise
from app.schemas.injury import BodyPartResponse, ConditionResponse, RehabilitationGoalResponse
from app.schemas.exercise import ExerciseResponse

router = APIRouter(
    tags=["injuries"]
)

@router.get("/body_parts", response_model=List[BodyPartResponse])
@router.get("/body-parts", response_model=List[BodyPartResponse])
def get_body_parts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(BodyPart).all()

@router.get("/conditions", response_model=List[ConditionResponse])
def get_conditions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Condition).all()

@router.get("/rehabilitation-goals", response_model=List[RehabilitationGoalResponse])
@router.get("/rehabilitation_goals", response_model=List[RehabilitationGoalResponse])
def get_rehabilitation_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(RehabilitationGoal).all()

@router.get("/conditions/{id}/exercises", response_model=List[ExerciseResponse])
def get_exercises_for_condition(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cond = db.query(Condition).filter(Condition.id == id).first()
    if not cond:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Condition not found"
        )
    
    # Query exercises mapped to this condition
    exercises = db.query(Exercise).join(
        ExerciseConditionMapping, Exercise.id == ExerciseConditionMapping.exercise_id
    ).filter(
        ExerciseConditionMapping.condition_id == id
    ).all()
    
    return exercises
