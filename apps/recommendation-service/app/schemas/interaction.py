import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

InteractionEventType = Literal[
    "VIEW",
    "SEARCH",
    "WISHLIST",
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "ORDER_COMPLETED",
    "REVIEW_CREATED",
]


class InteractionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId", min_length=1, max_length=100)
    product_id: int = Field(alias="productId", gt=0)
    event_type: InteractionEventType = Field(alias="eventType")
    event_id: str | None = Field(default=None, alias="eventId", max_length=100)
    session_id: str | None = Field(default=None, alias="sessionId", max_length=100)
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime.datetime | None = Field(default=None, alias="occurredAt")


class InteractionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int | None = None
    user_id: str = Field(alias="userId")
    product_id: int = Field(alias="productId")
    event_type: str = Field(alias="eventType")
    weight: float
    session_id: str | None = Field(default=None, alias="sessionId")
    occurred_at: datetime.datetime = Field(alias="occurredAt")
