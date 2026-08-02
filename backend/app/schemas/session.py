from pydantic import BaseModel, ConfigDict
from datetime import datetime

class SessionStart(BaseModel):
    patient_id: str
    exercise_id: str

class SessionEnd(BaseModel):
    duration_seconds: int
    repetitions_completed: int
    repetitions_failed: int
    average_angle: float
    max_angle: float
    average_pressure: float
    exercise_accuracy: float

class SessionResponse(BaseModel):
    id: str
    patient_id: str
    exercise_id: str
    start_time: datetime
    end_time: datetime | None = None
    duration_seconds: int | None = 0
    repetitions_completed: int | None = 0
    repetitions_failed: int | None = 0
    average_angle: float | None = 0.0
    max_angle: float | None = 0.0
    average_pressure: float | None = 0.0
    exercise_accuracy: float | None = 0.0
    exercise_name: str | None = None
    patient_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
