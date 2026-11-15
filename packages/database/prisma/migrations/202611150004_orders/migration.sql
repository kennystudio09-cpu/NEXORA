-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MERCHANT', 'CUSTOMER', 'AI', 'APPOINTMENT');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "orderNumber" VARCHAR(40) NOT NULL,
    "contactId" TEXT,
    "contactNameSnapshot" VARCHAR(120),
    "customerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'MERCHANT',
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(24,4) NOT NULL,
    "discountTotal" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(24,4) NOT NULL,
    "notes" VARCHAR(4000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "catalogVariantId" TEXT,
    "itemNameSnapshot" VARCHAR(160) NOT NULL,
    "variantNameSnapshot" VARCHAR(100),
    "skuSnapshot" VARCHAR(64),
    "unitPriceSnapshot" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(24,4) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "order_id" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_tenant_id_status_createdAt_id_idx" ON "Order"("tenant_id", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_customerUserId_source_createdAt_id_idx" ON "Order"("customerUserId", "source", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_tenant_id_contactId_idx" ON "Order"("tenant_id", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenant_id_id_key" ON "Order"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenant_id_orderNumber_key" ON "Order"("tenant_id", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_tenant_id_order_id_position_key" ON "OrderItem"("tenant_id", "order_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatusHistory_tenant_id_order_id_version_key" ON "OrderStatusHistory"("tenant_id", "order_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEvent_tenant_id_order_id_version_key" ON "OrderEvent"("tenant_id", "order_id", "version");

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenant_id_order_id_idx" ON "IdempotencyKey"("tenant_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_tenant_id_actorId_key_key" ON "IdempotencyKey"("tenant_id", "actorId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVariant_tenant_id_item_id_id_key" ON "CatalogVariant"("tenant_id", "item_id", "id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenant_id_contactId_fkey" FOREIGN KEY ("tenant_id", "contactId") REFERENCES "Customer"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenant_id_catalogItemId_fkey" FOREIGN KEY ("tenant_id", "catalogItemId") REFERENCES "CatalogItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenant_id_catalogItemId_catalogVariantId_fkey" FOREIGN KEY ("tenant_id", "catalogItemId", "catalogVariantId") REFERENCES "CatalogVariant"("tenant_id", "item_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" ADD CONSTRAINT "Order_valid_amounts" CHECK (subtotal >= 0 AND "discountTotal" = 0 AND "taxTotal" = 0 AND "grandTotal" = subtotal AND version > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_valid_amounts" CHECK (quantity BETWEEN 1 AND 10000 AND "unitPriceSnapshot" >= 0 AND "lineTotal" = "unitPriceSnapshot" * quantity AND position >= 0);
