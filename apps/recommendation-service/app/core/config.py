from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application settings
    APP_NAME: str = "recommendation-service"
    APP_ENV: Literal["development", "test", "production"] = "development"
    PORT: int = 8008
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = False

    # PostgreSQL Database URL with asyncpg
    DATABASE_URL: str = Field(
        default="postgresql://postgres:admin123@localhost:5432/larekmart_recommendation_db",
        description="Async PostgreSQL connection URI",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Redis Cache URL
    REDIS_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Redis connection URL for recommendation cache and rate limiting",
    )
    RECOMMENDATION_CACHE_TTL: int = 300  # 5 minutes
    POPULAR_CACHE_TTL: int = 600  # 10 minutes
    TRENDING_CACHE_TTL: int = 300  # 5 minutes

    # Kafka Integration
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9094,localhost:9095,localhost:9096"
    KAFKA_CONSUMER_GROUP: str = "recommendation-service-group"
    KAFKA_ENABLED: bool = True
    KAFKA_CLIENT_ID: str = "recommendation-service"

    # Celery settings
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/3"

    # OpenTelemetry / Prometheus
    OTEL_SERVICE_NAME: str = "recommendation-service"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    METRICS_ENABLED: bool = True

    # Recommendation Platform Parameters
    DEFAULT_RECOMMENDATION_LIMIT: int = 20
    MAX_RECOMMENDATION_LIMIT: int = 100
    CANDIDATE_POOL_SIZE: int = 100
    EMBEDDING_DIMENSION: int = 128

    # Interaction Weights (configurable)
    WEIGHT_VIEW: float = 1.0
    WEIGHT_SEARCH: float = 1.0
    WEIGHT_WISHLIST: float = 4.0
    WEIGHT_ADD_TO_CART: float = 6.0
    WEIGHT_REMOVE_FROM_CART: float = -2.0
    WEIGHT_ORDER_COMPLETED: float = 10.0
    WEIGHT_REVIEW_CREATED: float = 8.0

    # Hybrid Ranking Weights
    WEIGHT_COLLABORATIVE: float = 0.35
    WEIGHT_CONTENT: float = 0.25
    WEIGHT_EMBEDDING: float = 0.20
    WEIGHT_POPULARITY: float = 0.10
    WEIGHT_FRESHNESS: float = 0.10

    # Trending Decay Window in Hours
    TRENDING_WINDOW_HOURS: int = 48
    TRENDING_HALF_LIFE_HOURS: float = 12.0

    # Security
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
    ]

    @property
    def app_name(self) -> str:
        return self.APP_NAME

    @property
    def app_env(self) -> str:
        return self.APP_ENV

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def redis_url(self) -> str:
        return self.REDIS_URL

    @property
    def kafka_bootstrap_servers(self) -> str:
        return self.KAFKA_BOOTSTRAP_SERVERS

    @property
    def kafka_consumer_group(self) -> str:
        return self.KAFKA_CONSUMER_GROUP

    @property
    def celery_broker_url(self) -> str:
        return self.CELERY_BROKER_URL

    @property
    def celery_result_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND

    @property
    def cors_origins(self) -> list[str]:
        return self.ALLOWED_ORIGINS

    @property
    def interaction_weights(self) -> dict[str, float]:
        return {
            "VIEW": self.WEIGHT_VIEW,
            "SEARCH": self.WEIGHT_SEARCH,
            "WISHLIST": self.WEIGHT_WISHLIST,
            "ADD_TO_CART": self.WEIGHT_ADD_TO_CART,
            "REMOVE_FROM_CART": self.WEIGHT_REMOVE_FROM_CART,
            "ORDER_COMPLETED": self.WEIGHT_ORDER_COMPLETED,
            "REVIEW_CREATED": self.WEIGHT_REVIEW_CREATED,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()

