-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "status" "CustomerStatus" NOT NULL DEFAULT 'LEAD',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" VARCHAR(4000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFollowUp" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_tenant_id_created_at_id_idx" ON "Customer"("tenant_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "Customer_tenant_id_status_idx" ON "Customer"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "Customer_tags_idx" ON "Customer" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenant_id_id_key" ON "Customer"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "CustomerFollowUp_tenant_id_customer_id_created_at_id_idx" ON "CustomerFollowUp"("tenant_id", "customer_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "Customer"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFollowUp" ADD CONSTRAINT "CustomerFollowUp_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
