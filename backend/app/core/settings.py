from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SMART_API_",
        extra="forbid",
        frozen=True,
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"] = "development"
    db_host: str = Field(default="127.0.0.1", min_length=1)
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = Field(
        default="smart_construction", pattern=r"^[a-z_][a-z0-9_]{0,62}$"
    )
    db_user: str = Field(default="smart_api", pattern=r"^[a-z_][a-z0-9_]{0,62}$")
    db_password_file: Path = (
        BACKEND_DIR.parent / ".secrets" / "backend" / "api-password"
    )
    db_connect_timeout: int = Field(default=3, ge=1, le=10)
    db_statement_timeout_ms: int = Field(default=3000, ge=100, le=30000)
    allowed_origins: list[str] = [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
    ]
    registrations_enabled: bool = False
    terms_version: str = Field(default="", max_length=80)
    privacy_version: str = Field(default="", max_length=80)
    s3_endpoint_url: str | None = None
    s3_bucket: str = Field(
        default="smart-cadastros-private", pattern=r"^[a-z0-9][a-z0-9-]{2,62}$"
    )
    s3_access_key_file: Path = BACKEND_DIR.parent / ".secrets/backend/s3-api-access-key"
    s3_secret_key_file: Path = BACKEND_DIR.parent / ".secrets/backend/s3-api-secret-key"

    def database_url(self) -> URL:
        try:
            password = SecretStr(
                self.db_password_file.read_text(encoding="utf-8").strip()
            )
        except OSError:
            raise RuntimeError("Credencial do banco ausente ou inacessivel.") from None
        if len(password.get_secret_value()) < 32:
            raise RuntimeError(
                "Credencial do banco precisa ter ao menos 32 caracteres."
            )
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )
