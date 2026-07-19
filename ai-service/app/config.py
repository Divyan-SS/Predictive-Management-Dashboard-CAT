import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./fallback.db"
    DJANGO_BACKEND_URL: str = os.getenv("DJANGO_BACKEND_URL", "http://localhost:8000")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
