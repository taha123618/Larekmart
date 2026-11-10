import os
from functools import lru_cache
from typing import Literal
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "fraud-service"
    APP_ENV: Literal["development", "test", "production"] = "development"
    PORT: int = 8024
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = False

    # PostgreSQL async connection URI
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:password123@localhost:5432/fraud_db",
        description="Async PostgreSQL connection URI",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Redis connection URL
    REDIS_URL: str = Field(
        default="redis://localhost:6379/4",
        description="Redis connection URL for velocity tracking and rule caching",
    )
    VELOCITY_WINDOW_SECONDS: int = 300  # 5 minutes sliding window

    # Kafka Integration
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9094,localhost:9095,localhost:9096"
    KAFKA_CONSUMER_GROUP: str = "fraud-service-group"
    KAFKA_ENABLED: bool = True
    KAFKA_CLIENT_ID: str = "fraud-service"

    # Security & Zero-Trust
    INTERNAL_SERVICE_SECRET: str = "dev-shared-internal-secret-larekmart"
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_JWT_KEY: str = ""
    CLERK_JWT_HMAC_KEY: str = ""
    FRAUD_DEV_AUTH_BYPASS: bool = False

    # Risk Scoring Thresholds
    REVIEW_THRESHOLD: int = 40
    BLOCK_THRESHOLD: int = 75
    EXTERNAL_RISK_PROVIDER_ENABLED: bool = True

    # Observability & OpenTelemetry
    OTEL_SERVICE_NAME: str = "fraud-service"
    OTEL_TRACING_ENABLED: bool = True

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:8090",
    ]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.APP_ENV == "production":
            secret = (self.INTERNAL_SERVICE_SECRET or "").strip()
            lower = secret.lower()
            if (
                len(secret) < 16
                or lower == "dev-shared-internal-secret-larekmart"
                or "placeholder" in lower
                or "change-me" in lower
                or "example" in lower
                or "replace-me" in lower
            ):
                raise ValueError(
                    f"Production security violation: INTERNAL_SERVICE_SECRET for {self.APP_NAME} "
                    f"must be at least 16 characters and not match placeholder values"
                )
            if self.FRAUD_DEV_AUTH_BYPASS:
                raise ValueError(
                    f"Production security violation: FRAUD_DEV_AUTH_BYPASS must be false in production"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

