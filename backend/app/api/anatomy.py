from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database.database import get_db
from app.models.injury import BodyPart, Condition, RehabilitationGoal

router = APIRouter(prefix="/anatomy", tags=["Anatomy"])

# Response Schemas
class BodyPartResponse(BaseModel):
    id: str
    name: str
    class Config:
        from_attributes = True

class ConditionResponse(BaseModel):
    id: str
    name: str
    body_part_id: str
    class Config:
        from_attributes = True

class GoalResponse(BaseModel):
    id: str
    goal_name: str
    class Config:
        from_attributes = True


@router.get("/body-parts", response_model=List[BodyPartResponse])
def get_body_parts(db: Session = Depends(get_db)):
    return db.query(BodyPart).all()

@router.get("/conditions", response_model=List[ConditionResponse])
def get_conditions(body_part_id: str = None, db: Session = Depends(get_db)):
    query = db.query(Condition)
    if body_part_id:
        query = query.filter(Condition.body_part_id == body_part_id)
    return query.all()

@router.get("/goals", response_model=List[GoalResponse])
def get_goals(db: Session = Depends(get_db)):
    return db.query(RehabilitationGoal).all()
