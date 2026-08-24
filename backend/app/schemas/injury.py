from pydantic import BaseModel, ConfigDict

class BodyPartResponse(BaseModel):
    id: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ConditionResponse(BaseModel):
    id: str
    name: str
    body_part_id: str

    model_config = ConfigDict(from_attributes=True)


class RehabilitationGoalResponse(BaseModel):
    id: str
    goal_name: str

    model_config = ConfigDict(from_attributes=True)
