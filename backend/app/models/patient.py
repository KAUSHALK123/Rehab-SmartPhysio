import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(50), nullable=False)
    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    dominant_hand = Column(String(50), nullable=False)
    affected_side = Column(String(50), nullable=False, default="Right")
    
    # New injury-centric columns
    rehabilitation_goal_id = Column(String(36), ForeignKey("rehabilitation_goals.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship back to User
    user = relationship("User", backref="patients")

    # New relationships
    rehabilitation_goal = relationship("RehabilitationGoal", backref="patients")
    
    # Many-to-many relationship with Condition
    conditions = relationship("Condition", secondary="patient_conditions", backref="patients")

    # Helper properties for serialization
    @property
    def rehabilitation_goal_name(self) -> str | None:
        return self.rehabilitation_goal.goal_name if self.rehabilitation_goal else None

