from app.models.user import User
from app.models.product import Product
from app.models.interaction import UserInteraction, UserProductPreference
from app.models.recommendation import (
    Recommendation,
    RecommendationItem,
    RecommendationModel,
    RecommendationJob,
)

__all__ = [
    "User",
    "Product",
    "UserInteraction",
    "UserProductPreference",
    "Recommendation",
    "RecommendationItem",
    "RecommendationModel",
    "RecommendationJob",
]
