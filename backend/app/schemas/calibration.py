from pydantic import BaseModel
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

    class Config:
        from_attributes = True

class CalibrationResultResponse(BaseModel):
    result: str
