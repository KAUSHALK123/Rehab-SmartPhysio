from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name of the patient")
    age: int = Field(..., gt=0, description="Age must be greater than zero")
    gender: str = Field(..., min_length=1, max_length=50, description="Gender of the patient")
    height_cm: float = Field(..., gt=0, description="Height in cm must be greater than zero")
    weight_kg: float = Field(..., gt=0, description="Weight in kg must be greater than zero")
    dominant_hand: str = Field(..., min_length=1, max_length=50, description="Dominant hand (e.g. Left/Right)")
    injured_arm: str = Field(..., min_length=1, max_length=50, description="Injured arm (e.g. Left/Right)")
    injury_type: str | None = Field(None, max_length=255, description="Type of injury")
    body_part_id: str | None = Field(None, description="Affected body part ID")
    condition_id: str | None = Field(None, description="Diagnosed injury/condition ID")
    rehabilitation_goal_id: str | None = Field(None, description="Rehabilitation goal ID")

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    age: int | None = Field(None, gt=0)
    gender: str | None = Field(None, min_length=1, max_length=50)
    height_cm: float | None = Field(None, gt=0)
    weight_kg: float | None = Field(None, gt=0)
    dominant_hand: str | None = Field(None, min_length=1, max_length=50)
    injured_arm: str | None = Field(None, min_length=1, max_length=50)
    injury_type: str | None = Field(None, max_length=255)
    body_part_id: str | None = Field(None)
    condition_id: str | None = Field(None)
    rehabilitation_goal_id: str | None = Field(None)

class PatientResponse(PatientBase):
    id: str
    user_id: str
    body_part_name: str | None = None
    condition_name: str | None = None
    rehabilitation_goal_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PatientListResponse(BaseModel):
    id: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)

