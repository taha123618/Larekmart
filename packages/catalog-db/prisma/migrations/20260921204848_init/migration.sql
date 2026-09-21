-- CreateEnum
CREATE TYPE "public"."AvailabilityStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "public"."CollectionStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."CatalogBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogCategory" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "brandId" TEXT,
    "primaryCategoryId" TEXT,
    "thumbnailUrl" TEXT NOT NULL,
    "images" JSONB NOT NULL DEFAULT '{}',
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "discountPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "availabilityStatus" "public"."AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "sku" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" "public"."CollectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogCollectionProduct" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCollectionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogCategoryProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCategoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogBrand_slug_key" ON "public"."CatalogBrand"("slug");

-- CreateIndex
CREATE INDEX "CatalogBrand_isActive_idx" ON "public"."CatalogBrand"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCategory_slug_key" ON "public"."CatalogCategory"("slug");

-- CreateIndex
CREATE INDEX "CatalogCategory_parentId_position_idx" ON "public"."CatalogCategory"("parentId", "position");

-- CreateIndex
CREATE INDEX "CatalogCategory_isActive_idx" ON "public"."CatalogCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_productId_key" ON "public"."CatalogProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_slug_key" ON "public"."CatalogProduct"("slug");

-- CreateIndex
CREATE INDEX "CatalogProduct_primaryCategoryId_isActive_idx" ON "public"."CatalogProduct"("primaryCategoryId", "isActive");

-- CreateIndex
CREATE INDEX "CatalogProduct_brandId_isActive_idx" ON "public"."CatalogProduct"("brandId", "isActive");

-- CreateIndex
CREATE INDEX "CatalogProduct_isFeatured_isActive_idx" ON "public"."CatalogProduct"("isFeatured", "isActive");

-- CreateIndex
CREATE INDEX "CatalogProduct_isNew_isActive_idx" ON "public"."CatalogProduct"("isNew", "isActive");

-- CreateIndex
CREATE INDEX "CatalogProduct_price_idx" ON "public"."CatalogProduct"("price");

-- CreateIndex
CREATE INDEX "CatalogProduct_rating_idx" ON "public"."CatalogProduct"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProductVariant_productId_variantId_key" ON "public"."CatalogProductVariant"("productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollection_slug_key" ON "public"."CatalogCollection"("slug");

-- CreateIndex
CREATE INDEX "CatalogCollection_status_sortOrder_idx" ON "public"."CatalogCollection"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "CatalogCollectionProduct_collectionId_position_idx" ON "public"."CatalogCollectionProduct"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionProduct_collectionId_productId_key" ON "public"."CatalogCollectionProduct"("collectionId", "productId");

-- CreateIndex
CREATE INDEX "CatalogCategoryProduct_categoryId_position_idx" ON "public"."CatalogCategoryProduct"("categoryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCategoryProduct_categoryId_productId_key" ON "public"."CatalogCategoryProduct"("categoryId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "public"."ProcessedEvent"("eventId");

-- AddForeignKey
ALTER TABLE "public"."CatalogCategory" ADD CONSTRAINT "CatalogCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."CatalogCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogProduct" ADD CONSTRAINT "CatalogProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."CatalogBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogProduct" ADD CONSTRAINT "CatalogProduct_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "public"."CatalogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogProductVariant" ADD CONSTRAINT "CatalogProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CatalogProduct"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogCollectionProduct" ADD CONSTRAINT "CatalogCollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogCollectionProduct" ADD CONSTRAINT "CatalogCollectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CatalogProduct"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogCategoryProduct" ADD CONSTRAINT "CatalogCategoryProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."CatalogCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogCategoryProduct" ADD CONSTRAINT "CatalogCategoryProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CatalogProduct"("productId") ON DELETE CASCADE ON UPDATE CASCADE;
