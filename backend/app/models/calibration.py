import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey
from datetime import datetime
from app.database.database import Base

class CalibrationSession(Base):
    __tablename__ = "calibration_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    patient_id = Column(String(36), nullable=True) # Nullable until patient profiles are set up
    calibration_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    
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
