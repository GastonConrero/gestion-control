from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/gestion_control"
    SECRET_KEY: str = "cambiar-en-produccion-clave-muy-segura"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 horas

    class Config:
        env_file = ".env"

settings = Settings()
