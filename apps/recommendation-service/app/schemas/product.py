import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    brand: str | None = None
    category_slug: str | None = Field(default=None, alias="categorySlug")
    price: float | None = Field(default=None, ge=0)
    is_active: bool = Field(default=True, alias="isActive")
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProductCreate(ProductBase):
    id: int = Field(gt=0)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    description: str | None = None
    brand: str | None = None
    category_slug: str | None = Field(default=None, alias="categorySlug")
    price: float | None = Field(default=None, ge=0)
    is_active: bool | None = Field(default=None, alias="isActive")
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int
    created_at: datetime.datetime = Field(alias="createdAt")
    updated_at: datetime.datetime = Field(alias="updatedAt")


class ProductEmbeddingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: int = Field(alias="productId")
    name: str
    category_slug: str | None = Field(default=None, alias="categorySlug")
    dimensions: int
    embedding: list[float]
    metadata: dict[str, Any] | None = None
    updated_at: datetime.datetime | None = Field(default=None, alias="updatedAt")
