from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(validation_alias="DATABASE_URL")
    backend_cors_origins_csv: str = Field(validation_alias="BACKEND_CORS_ORIGINS")
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    session_cookie_name: str = "cyops_session"
    session_cookie_secure: bool = False
    frontend_url: str = Field(validation_alias="FRONTEND_URL")
    api_base_url: str = Field(validation_alias="API_BASE_URL")

    x_client_id: str | None = None
    x_client_secret: str | None = None
    x_redirect_uri: str = Field(validation_alias="X_REDIRECT_URI")
    discord_client_id: str | None = None
    discord_client_secret: str | None = None
    discord_redirect_uri: str = Field(validation_alias="DISCORD_REDIRECT_URI")
    discord_bot_token: str | None = Field(default=None, validation_alias="DISCORD_BOT_TOKEN")
    discord_guild_id: str | None = Field(default=None, validation_alias="DISCORD_GUILD_ID")
    discord_required_role_id: str | None = Field(default=None, validation_alias="DISCORD_REQUIRED_ROLE_ID")
    discord_required_role_name: str = Field(default="Cysor", validation_alias="DISCORD_REQUIRED_ROLE_NAME")
    admin_x_usernames_csv: str = Field(default="", validation_alias="ADMIN_X_USERNAMES")
    enable_dev_auth_mocks: bool = Field(default=False, validation_alias="ENABLE_DEV_AUTH_MOCKS")
    vote_rate_limit_per_minute: int = Field(default=60, validation_alias="VOTE_RATE_LIMIT_PER_MINUTE")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def backend_cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins_csv.split(",") if item.strip()]

    @property
    def admin_x_usernames(self) -> list[str]:
        return [item.strip() for item in self.admin_x_usernames_csv.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

