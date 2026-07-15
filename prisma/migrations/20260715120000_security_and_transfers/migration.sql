ALTER TABLE "Tenant" ADD COLUMN "apiKeyHash" TEXT;

UPDATE "Tenant"
SET "apiKeyHash" = md5(random()::text || clock_timestamp()::text || id::text)
WHERE "apiKeyHash" IS NULL;

ALTER TABLE "Tenant" ALTER COLUMN "apiKeyHash" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_apiKeyHash_key" ON "Tenant"("apiKeyHash");

CREATE TABLE "StockTransfer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "sourceWarehouseId" UUID NOT NULL,
    "targetWarehouseId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockTransfer_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "StockTransfer_different_warehouses" CHECK ("sourceWarehouseId" <> "targetWarehouseId")
);

CREATE INDEX "StockTransfer_tenantId_variantId_createdAt_idx"
  ON "StockTransfer"("tenantId", "variantId", "createdAt");

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_variantId_tenantId_fkey"
  FOREIGN KEY ("variantId", "tenantId") REFERENCES "ProductVariant"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_sourceWarehouseId_tenantId_fkey"
  FOREIGN KEY ("sourceWarehouseId", "tenantId") REFERENCES "Warehouse"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_targetWarehouseId_tenantId_fkey"
  FOREIGN KEY ("targetWarehouseId", "tenantId") REFERENCES "Warehouse"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
