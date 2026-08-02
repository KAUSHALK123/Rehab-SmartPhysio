import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.database import Base

class ExerciseSession(Base):
    __tablename__ = "exercise_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    exercise_id = Column(String(36), ForeignKey("exercises.id"), nullable=False)
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True, default=0)
    repetitions_completed = Column(Integer, nullable=True, default=0)
    repetitions_failed = Column(Integer, nullable=True, default=0)
    average_angle = Column(Float, nullable=True, default=0.0)
    max_angle = Column(Float, nullable=True, default=0.0)
    average_pressure = Column(Float, nullable=True, default=0.0)
    exercise_accuracy = Column(Float, nullable=True, default=0.0)

    # Relationships
    patient = relationship("Patient", backref="sessions")
    exercise = relationship("Exercise", backref="sessions")
