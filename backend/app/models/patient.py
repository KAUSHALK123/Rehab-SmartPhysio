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
    injured_arm = Column(String(50), nullable=False)
    injury_type = Column(String(255), nullable=True) # Retained for compatibility but made nullable
    
    # New injury-centric columns
    body_part_id = Column(String(36), ForeignKey("body_parts.id", ondelete="SET NULL"), nullable=True)
    condition_id = Column(String(36), ForeignKey("conditions.id", ondelete="SET NULL"), nullable=True)
    rehabilitation_goal_id = Column(String(36), ForeignKey("rehabilitation_goals.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship back to User
    user = relationship("User", backref="patients")

    # New relationships
    body_part = relationship("BodyPart", backref="patients")
    condition = relationship("Condition", backref="patients")
    rehabilitation_goal = relationship("RehabilitationGoal", backref="patients")

    # Helper properties for serialization
    @property
    def body_part_name(self) -> str | None:
        return self.body_part.name if self.body_part else None

    @property
    def condition_name(self) -> str | None:
        return self.condition.name if self.condition else None

    @property
    def rehabilitation_goal_name(self) -> str | None:
        return self.rehabilitation_goal.goal_name if self.rehabilitation_goal else None

