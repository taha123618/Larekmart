from app.db.models.user import User
from app.db.models.product import Product
from app.db.models.user_interaction import UserInteraction
from app.db.models.user_product_preference import UserProductPreference
from app.db.models.recommendation import Recommendation, RecommendationItem
from app.db.models.processed_event import ProcessedEvent
from app.db.models.product_embedding import ProductEmbedding
from app.db.models.user_embedding import UserEmbedding
from app.db.models.recommendation_model import RecommendationModel
from app.db.models.recommendation_job import RecommendationJob
from app.db.models.analytics_event import RecommendationAnalyticsEvent

__all__ = [
    "User",
    "Product",
    "UserInteraction",
    "UserProductPreference",
    "Recommendation",
    "RecommendationItem",
    "ProcessedEvent",
    "ProductEmbedding",
    "UserEmbedding",
    "RecommendationModel",
    "RecommendationJob",
    "RecommendationAnalyticsEvent",
]
