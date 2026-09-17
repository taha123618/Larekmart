from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from app.core.logging import get_logger

logger = get_logger("errors")


class RecommendationError(Exception):
    """Base exception for all recommendation service errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(RecommendationError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationError(RecommendationError):
    def __init__(self, message: str = "Invalid recommendation request parameters"):
        super().__init__(message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


class EventProcessingError(RecommendationError):
    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)


class EmbeddingError(RecommendationError):
    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_502_BAD_GATEWAY)


class ModelError(RecommendationError):
    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RecommendationError)
    async def recommendation_error_handler(request: Request, exc: RecommendationError):
        logger.warning(
            "recommendation_error",
            path=request.url.path,
            error=exc.message,
            status_code=exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": exc.message, "error": exc.__class__.__name__},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error(
            "unhandled_server_error",
            path=request.url.path,
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Internal server error occurred", "error": "InternalServerError"},
        )


register_exception_handlers = register_error_handlers

