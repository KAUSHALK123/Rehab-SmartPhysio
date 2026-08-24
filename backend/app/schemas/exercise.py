from pydantic import BaseModel, ConfigDict

class ExerciseResponseShort(BaseModel):
    id: str
    exercise_name: str

    model_config = ConfigDict(from_attributes=True)

class ExerciseResponse(BaseModel):
    id: str
    exercise_name: str
    description: str
    body_part: str
    target_joint: str | None = None
    rehabilitation_goal: str | None = None
    minimum_angle: float | None = None
    maximum_angle: float | None = None
    hold_duration: int
    rest_duration: int
    required_sensors: str | None = None
    supported_conditions: list[str] | None = None
    
    target_angle: float
    target_pressure: float
    repetitions: int
    hold_seconds: int
    rest_seconds: int
    difficulty: str

    model_config = ConfigDict(from_attributes=True)

