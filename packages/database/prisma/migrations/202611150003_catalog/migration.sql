-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('PRODUCT', 'SERVICE', 'DIGITAL', 'BUNDLE');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "catalog_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_slug" TEXT;

-- CreateTable
CREATE TABLE "CatalogCategory" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(6000) NOT NULL DEFAULT '',
    "itemType" "CatalogItemType" NOT NULL DEFAULT 'PRODUCT',
    "sku" VARCHAR(64),
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "basePrice" DECIMAL(18,4) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVariant" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sku" VARCHAR(64),
    "price" DECIMAL(18,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CatalogVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogMedia" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" VARCHAR(160) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'MYR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCategory_tenant_id_id_key" ON "CatalogCategory"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCategory_tenant_id_name_key" ON "CatalogCategory"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "CatalogItem_tenant_id_status_createdAt_id_idx" ON "CatalogItem"("tenant_id", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_tenant_id_id_key" ON "CatalogItem"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_tenant_id_sku_key" ON "CatalogItem"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVariant_tenant_id_id_key" ON "CatalogVariant"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVariant_tenant_id_item_id_name_key" ON "CatalogVariant"("tenant_id", "item_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVariant_tenant_id_sku_key" ON "CatalogVariant"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "CatalogMedia_tenant_id_item_id_idx" ON "CatalogMedia"("tenant_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogMedia_tenant_id_id_key" ON "CatalogMedia"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_tenant_id_id_key" ON "PriceList"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_tenant_id_name_key" ON "PriceList"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_catalog_slug_key" ON "Tenant"("catalog_slug");

-- AddForeignKey
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenant_id_categoryId_fkey" FOREIGN KEY ("tenant_id", "categoryId") REFERENCES "CatalogCategory"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogVariant" ADD CONSTRAINT "CatalogVariant_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "CatalogItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogMedia" ADD CONSTRAINT "CatalogMedia_tenant_id_item_id_fkey" FOREIGN KEY ("tenant_id", "item_id") REFERENCES "CatalogItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_nonnegative_price" CHECK ("basePrice" >= 0);
ALTER TABLE "CatalogVariant" ADD CONSTRAINT "CatalogVariant_nonnegative_price" CHECK (price >= 0);
