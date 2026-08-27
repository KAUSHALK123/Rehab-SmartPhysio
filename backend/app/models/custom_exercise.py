import uuid
from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base

class CustomExercise(Base):
    __tablename__ = "custom_exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    exercise_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    condition_id = Column(String(36), ForeignKey("conditions.id", ondelete="SET NULL"), nullable=True)
    target_joint = Column(String(100), nullable=True)
    
    minimum_angle = Column(Float, nullable=True, default=0.0)
    maximum_angle = Column(Float, nullable=True, default=90.0)
    target_angle = Column(Float, nullable=False, default=90.0)
    target_pressure = Column(Float, nullable=False, default=0.0)
    
    repetitions = Column(Integer, nullable=False, default=10)
    hold_seconds = Column(Integer, nullable=False, default=0)
    
    required_sensors = Column(String(255), nullable=True)
    
    # Is it soft deleted?
    is_deleted = Column(Integer, default=0, nullable=False)

    patient = relationship("Patient", backref="custom_exercises")
    condition = relationship("Condition")
