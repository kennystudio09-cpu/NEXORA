-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "storefront_key" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerNote" VARCHAR(1000) NOT NULL DEFAULT '',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "sourceChannel" VARCHAR(32),
ADD COLUMN     "storeNameSnapshot" VARCHAR(160),
ADD COLUMN     "storeSlugSnapshot" VARCHAR(60);

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "operation" VARCHAR(40) NOT NULL DEFAULT 'MERCHANT_ORDER_CREATE';

-- CreateTable
CREATE TABLE "StorefrontProfile" (
    "tenant_id" TEXT NOT NULL,
    "displayName" VARCHAR(160) NOT NULL DEFAULT '',
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "address" VARCHAR(500) NOT NULL DEFAULT '',
    "businessHours" VARCHAR(1000) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "logoData" BYTEA,
    "logoMime" TEXT,
    "logoWidth" INTEGER,
    "logoHeight" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontProfile_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "CustomerAccountLink" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAccountLink_pkey" PRIMARY KEY ("tenant_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountLink_tenant_id_contact_id_key" ON "CustomerAccountLink"("tenant_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_storefront_key_key" ON "Tenant"("storefront_key");

-- AddForeignKey
ALTER TABLE "StorefrontProfile" ADD CONSTRAINT "StorefrontProfile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountLink" ADD CONSTRAINT "CustomerAccountLink_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountLink" ADD CONSTRAINT "CustomerAccountLink_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccountLink" ADD CONSTRAINT "CustomerAccountLink_tenant_id_contact_id_fkey" FOREIGN KEY ("tenant_id", "contact_id") REFERENCES "Customer"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
