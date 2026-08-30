import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey
from datetime import datetime, timezone
from app.database.database import Base

class CalibrationSession(Base):
    __tablename__ = "calibration_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    patient_id = Column(String(36), nullable=True) # Nullable until patient profiles are set up
    calibration_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    mpu_status = Column(Boolean, default=True, nullable=False)
    pressure_status = Column(Boolean, default=True, nullable=False)
    thumb_sensor = Column(Boolean, default=True, nullable=False)
    index_sensor = Column(Boolean, default=True, nullable=False)
    middle_sensor = Column(Boolean, default=True, nullable=False)
    ring_sensor = Column(Boolean, default=True, nullable=False)
    little_sensor = Column(Boolean, default=True, nullable=False)
    elbow_sensor = Column(Boolean, default=True, nullable=False)
    
    battery_percentage = Column(Integer, default=100, nullable=False)
    calibration_result = Column(String(50), default="PASS", nullable=False)

    # Raw calibration min/max bounds
    thumb_min = Column(Integer, nullable=True)
    thumb_max = Column(Integer, nullable=True)
    index_min = Column(Integer, nullable=True)
    index_max = Column(Integer, nullable=True)
    middle_min = Column(Integer, nullable=True)
    middle_max = Column(Integer, nullable=True)
    ring_min = Column(Integer, nullable=True)
    ring_max = Column(Integer, nullable=True)
    little_min = Column(Integer, nullable=True)
    little_max = Column(Integer, nullable=True)
    elbow_min = Column(Integer, nullable=True)
    elbow_max = Column(Integer, nullable=True)
    pressure_min = Column(Integer, nullable=True)
    pressure_max = Column(Integer, nullable=True)
