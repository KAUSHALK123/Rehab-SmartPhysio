import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base

class BodyPart(Base):
    __tablename__ = "body_parts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)


class Condition(Base):
    __tablename__ = "conditions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    body_part_id = Column(String(36), ForeignKey("body_parts.id", ondelete="CASCADE"), nullable=False)

    body_part = relationship("BodyPart", backref="conditions")


class RehabilitationGoal(Base):
    __tablename__ = "rehabilitation_goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_name = Column(String(255), nullable=False, unique=True)


class ExerciseConditionMapping(Base):
    __tablename__ = "exercise_condition_mapping"

    exercise_id = Column(String(36), ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True)
    condition_id = Column(String(36), ForeignKey("conditions.id", ondelete="CASCADE"), primary_key=True)


class PatientCondition(Base):
    __tablename__ = "patient_conditions"

    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), primary_key=True)
    condition_id = Column(String(36), ForeignKey("conditions.id", ondelete="CASCADE"), primary_key=True)
