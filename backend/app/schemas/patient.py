from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List

class ConditionMinimal(BaseModel):
    id: str
    name: str
    class Config:
        from_attributes = True

class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name of the patient")
    age: int = Field(..., gt=0, description="Age must be greater than zero")
    gender: str = Field(..., min_length=1, max_length=50, description="Gender of the patient")
    height_cm: float = Field(..., gt=0, description="Height in cm must be greater than zero")
    weight_kg: float = Field(..., gt=0, description="Weight in kg must be greater than zero")
    dominant_hand: str = Field(..., min_length=1, max_length=50, description="Dominant hand (e.g. Left/Right)")
    affected_side: str = Field(..., min_length=1, max_length=50, description="Affected side (e.g. Left/Right/Bilateral)")
    rehabilitation_goal_id: str | None = Field(None, description="Rehabilitation goal ID")

class PatientCreate(PatientBase):
    condition_ids: List[str] = Field(default_factory=list, description="List of Condition IDs")

class PatientUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    age: int | None = Field(None, gt=0)
    gender: str | None = Field(None, min_length=1, max_length=50)
    height_cm: float | None = Field(None, gt=0)
    weight_kg: float | None = Field(None, gt=0)
    dominant_hand: str | None = Field(None, min_length=1, max_length=50)
    affected_side: str | None = Field(None, min_length=1, max_length=50)
    rehabilitation_goal_id: str | None = Field(None)
    condition_ids: List[str] | None = Field(None, description="List of Condition IDs")

class PatientResponse(PatientBase):
    id: str
    user_id: str
    rehabilitation_goal_name: str | None = None
    conditions: List[ConditionMinimal] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PatientListResponse(BaseModel):
    id: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)

