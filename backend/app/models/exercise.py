import uuid
from sqlalchemy import Column, String, Integer, Float, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exercise_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    body_part = Column(String(50), nullable=False)
    
    # New injury-centric columns
    target_joint = Column(String(100), nullable=True)
    rehabilitation_goal = Column(String(255), nullable=True)
    minimum_angle = Column(Float, nullable=True, default=0.0)
    maximum_angle = Column(Float, nullable=True, default=180.0)
    hold_duration = Column(Integer, nullable=False, default=0)
    rest_duration = Column(Integer, nullable=False, default=0)
    required_sensors = Column(String(255), nullable=True)

    # Core target values
    target_angle = Column(Float, nullable=False, default=0.0)
    target_pressure = Column(Float, nullable=False, default=0.0)
    repetitions = Column(Integer, nullable=False, default=10)
    
    # Compatibility columns
    hold_seconds = Column(Integer, nullable=False, default=0)
    rest_seconds = Column(Integer, nullable=False, default=0)
    
    difficulty = Column(String(50), nullable=False)

    # Many-to-many relationship with Condition
    conditions = relationship("Condition", secondary="exercise_condition_mapping", backref="exercises")

    @property
    def supported_conditions(self) -> list[str]:
        return [c.name for c in self.conditions]

