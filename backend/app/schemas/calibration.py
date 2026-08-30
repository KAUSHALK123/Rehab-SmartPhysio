from pydantic import BaseModel, ConfigDict
from datetime import datetime

class CalibrationSubmit(BaseModel):
    mpu: bool
    pressure: bool
    thumb: bool
    index: bool
    middle: bool
    ring: bool
    little: bool
    elbow: bool
    battery: int
    patient_id: str | None = None

    # Raw bounds
    thumb_min: int | None = None
    thumb_max: int | None = None
    index_min: int | None = None
    index_max: int | None = None
    middle_min: int | None = None
    middle_max: int | None = None
    ring_min: int | None = None
    ring_max: int | None = None
    little_min: int | None = None
    little_max: int | None = None
    elbow_min: int | None = None
    elbow_max: int | None = None
    pressure_min: int | None = None
    pressure_max: int | None = None

class CalibrationResponse(BaseModel):
    id: str
    user_id: str
    patient_id: str | None = None
    calibration_time: datetime
    mpu_status: bool
    pressure_status: bool
    thumb_sensor: bool
    index_sensor: bool
    middle_sensor: bool
    ring_sensor: bool
    little_sensor: bool
    elbow_sensor: bool
    battery_percentage: int
    calibration_result: str

    # Raw bounds
    thumb_min: int | None = None
    thumb_max: int | None = None
    index_min: int | None = None
    index_max: int | None = None
    middle_min: int | None = None
    middle_max: int | None = None
    ring_min: int | None = None
    ring_max: int | None = None
    little_min: int | None = None
    little_max: int | None = None
    elbow_min: int | None = None
    elbow_max: int | None = None
    pressure_min: int | None = None
    pressure_max: int | None = None

    model_config = ConfigDict(from_attributes=True)

class CalibrationResultResponse(BaseModel):
    result: str
