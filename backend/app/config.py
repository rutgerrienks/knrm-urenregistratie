from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg://knrm:knrm@localhost:5432/knrm"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    # SSO (Microsoft Entra ID); leeg = SSO uitgeschakeld
    entra_tenant_id: str = ""
    entra_client_id: str = ""

    # App
    app_name: str = "KNRM Urenregistratie"
    cors_origins: str = "*"

    # Compensation
    hourly_rate_eur: float = 1.25
    min_minutes: int = 30

    # Seed admin (created on startup if no users exist)
    seed_admin_email: str = "beheer@knrm.nl"
    seed_admin_password: str = "KnrmPilot2026!"


@lru_cache
def get_settings() -> Settings:
    return Settings()
