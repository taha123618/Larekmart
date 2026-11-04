from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.admin import router as admin_router
from app.api.health import router as health_router
from app.api.internal import router as internal_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.core.security import SecurityHeadersMiddleware
from app.kafka.consumer import start_kafka_consumer, stop_kafka_consumer
from app.kafka.producer import stop_kafka_producer

logger = get_logger("fraud-service.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Initializing fraud-service...")
    await start_kafka_consumer()
    yield
    logger.info("Shutting down fraud-service...")
    await stop_kafka_consumer()
    await stop_kafka_producer()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Larekmart Fraud Detection Service",
        description="Real-time risk scoring, velocity abuse detection, and fraud case management",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Defensive Security Headers & CORS
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Standard Monorepo Error Formatting
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception in fraud-service", url=str(request.url), error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Internal server error in fraud evaluation"},
        )

    # Register Routers
    app.include_router(health_router)
    app.include_router(internal_router)
    app.include_router(admin_router)

    return app


app = create_app()

