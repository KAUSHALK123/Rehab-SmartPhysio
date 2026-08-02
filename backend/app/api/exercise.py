from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseResponse

router = APIRouter(
    prefix="/exercises",
    tags=["exercises"]
)

@router.get("", response_model=List[ExerciseResponse])
def get_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercises = db.query(Exercise).all()
    return exercises

@router.get("/{id}", response_model=ExerciseResponse)
def get_exercise_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercise = db.query(Exercise).filter(Exercise.id == id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found"
        )
    return exercise
