from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class KafkaEnvelope(BaseModel):
    model_config = ConfigDict(extra="allow")
    value: dict[str, Any]


class ProductCreatedEventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int | str
    name: str
    price: float | int | None = None
    description: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    category_slug: str | None = Field(default=None, alias="categorySlug")
    sizes: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)


class OrderProductItem(BaseModel):
    name: str | None = None
    quantity: int = 1
    price: float | int = 0
    product_id: int | None = Field(default=None, alias="productId")


class PaymentSuccessfulEventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    user_id: str | None = Field(default=None, alias="userId")
    email: str | None = None
    session_id: str | None = Field(default=None, alias="sessionId")
    reference_id: str | None = Field(default=None, alias="referenceId")
    amount: float | int | None = None
    products: list[dict[str, Any]] = Field(default_factory=list)


class OrderCreatedEventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    email: str | None = None
    amount: float | int | None = None
    status: str | None = None
