from pydantic import BaseModel

class ExerciseResponseShort(BaseModel):
    id: str
    exercise_name: str

    class Config:
        from_attributes = True

class ExerciseResponse(BaseModel):
    id: str
    exercise_name: str
    description: str
    body_part: str
    target_angle: float
    target_pressure: float
    repetitions: int
    hold_seconds: int
    rest_seconds: int
    difficulty: str

    class Config:
        from_attributes = True
