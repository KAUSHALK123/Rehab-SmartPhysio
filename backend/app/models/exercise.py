import uuid
from sqlalchemy import Column, String, Integer, Float, Text
from app.database.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exercise_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    body_part = Column(String(50), nullable=False)
    target_angle = Column(Float, nullable=False, default=0.0)
    target_pressure = Column(Float, nullable=False, default=0.0)
    repetitions = Column(Integer, nullable=False, default=10)
    hold_seconds = Column(Integer, nullable=False, default=0)
    rest_seconds = Column(Integer, nullable=False, default=0)
    difficulty = Column(String(50), nullable=False)
