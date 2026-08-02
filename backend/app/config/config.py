import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "SmartPhysio API"
    API_V1_STR: str = "/api/v1"
    
    # JWT Authentication settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkeyfor-smartphysiorehab-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smartphysio.db")
    
    # MQTT Config
    MQTT_BROKER: str = os.getenv("MQTT_BROKER", "broker.hivemq.com")
    MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
    
    class Config:
        case_sensitive = True

settings = Settings()
