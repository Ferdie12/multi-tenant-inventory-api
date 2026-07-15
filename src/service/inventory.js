import { prisma } from "../application/database.js";
import { HttpError } from "../error/response-error.js";

const MAX_STOCK_QUANTITY = 2147483647;

export function createWarehouse(tenantId, data) {
  return prisma.warehouse.create({ data: { ...data, tenantId } });
}

async function requireOwnedVariant(database, tenantId, variantId) {
  const variant = await database.productVariant.findFirst({
    where: { id: variantId, tenantId },
    select: { id: true }
  });
  if (!variant) throw new HttpError(404, "Variant not found");
}

async function requireOwnedWarehouse(database, tenantId, warehouseId) {
  const warehouse = await database.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    select: { id: true }
  });
  if (!warehouse) throw new HttpError(404, "Warehouse not found");
}

function allowedCurrentQuantity(delta) {
  return delta < 0
    ? { gte: Math.abs(delta) }
    : { lte: MAX_STOCK_QUANTITY - delta };
}

function rejectedAdjustment(delta) {
  const message = delta < 0 ? "Insufficient stock" : "Stock limit exceeded";
  return new HttpError(409, message);
}

function transferQuantityCondition(source, quantity) {
  return source
    ? { gte: quantity }
    : { lte: MAX_STOCK_QUANTITY - quantity };
}

function transferQuantityChange(source, quantity) {
  return source
    ? { decrement: quantity }
    : { increment: quantity };
}

export async function adjustInventory(tenantId, input) {
  return prisma.$transaction(async (tx) => {
    await requireOwnedVariant(tx, tenantId, input.variantId);
    await requireOwnedWarehouse(tx, tenantId, input.warehouseId);

    const key = {
      tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId
    };
    await tx.stockLevel.upsert({
      where: { tenantId_variantId_warehouseId: key },
      create: { ...key, quantity: 0 },
      update: {}
    });

    const updated = await tx.stockLevel.updateMany({
      where: {
        ...key,
        quantity: allowedCurrentQuantity(input.delta)
      },
      data: { quantity: { increment: input.delta } }
    });
    if (updated.count !== 1) {
      throw rejectedAdjustment(input.delta);
    }

    const stockLevel = await tx.stockLevel.findUnique({
      where: { tenantId_variantId_warehouseId: key }
    });
    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        ...key,
        delta: input.delta,
        balanceAfter: stockLevel.quantity,
        reason: input.reason ?? null
      }
    });

    return { ...adjustment, stockLevel };
  });
}

export async function transferInventory(tenantId, input) {
  if (input.sourceWarehouseId === input.targetWarehouseId) {
    throw new HttpError(400, "Source and target warehouses must differ");
  }

  return prisma.$transaction(async (tx) => {
    await requireOwnedVariant(tx, tenantId, input.variantId);
    await requireOwnedWarehouse(tx, tenantId, input.sourceWarehouseId);
    await requireOwnedWarehouse(tx, tenantId, input.targetWarehouseId);

    const sourceKey = {
      tenantId,
      variantId: input.variantId,
      warehouseId: input.sourceWarehouseId
    };
    const targetKey = { ...sourceKey, warehouseId: input.targetWarehouseId };
    const locations = [
      { key: sourceKey, source: true },
      { key: targetKey, source: false }
    ].sort((left, right) => left.key.warehouseId.localeCompare(right.key.warehouseId));

    for (const location of locations) {
      await tx.stockLevel.upsert({
        where: { tenantId_variantId_warehouseId: location.key },
        create: { ...location.key, quantity: 0 },
        update: {}
      });
    }

    for (const location of locations) {
      const updated = await tx.stockLevel.updateMany({
        where: {
          ...location.key,
          quantity: transferQuantityCondition(location.source, input.quantity)
        },
        data: {
          quantity: transferQuantityChange(location.source, input.quantity)
        }
      });
      if (updated.count !== 1) {
        const message = location.source ? "Insufficient stock" : "Stock limit exceeded";
        throw new HttpError(409, message);
      }
    }

    const sourceStock = await tx.stockLevel.findUnique({
      where: { tenantId_variantId_warehouseId: sourceKey }
    });
    const targetStock = await tx.stockLevel.findUnique({
      where: { tenantId_variantId_warehouseId: targetKey }
    });
    const transfer = await tx.stockTransfer.create({
      data: {
        tenantId,
        variantId: input.variantId,
        sourceWarehouseId: input.sourceWarehouseId,
        targetWarehouseId: input.targetWarehouseId,
        quantity: input.quantity,
        reason: input.reason ?? null
      }
    });
    await tx.inventoryAdjustment.createMany({
      data: [
        {
          ...sourceKey,
          delta: -input.quantity,
          balanceAfter: sourceStock.quantity,
          reason: `Transfer ${transfer.id} out`
        },
        {
          ...targetKey,
          delta: input.quantity,
          balanceAfter: targetStock.quantity,
          reason: `Transfer ${transfer.id} in`
        }
      ]
    });

    return { transfer, sourceStock, targetStock };
  });
}

export async function listInventory(tenantId, filters) {
  await requireOwnedVariant(prisma, tenantId, filters.variantId);

  return prisma.stockLevel.findMany({
    where: {
      tenantId,
      variantId: filters.variantId,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {})
    },
    include: { warehouse: true },
    orderBy: { warehouseId: "asc" }
  });
}

export async function listInventorySummary(tenantId, filters) {
  const warehouses = await listInventory(tenantId, filters);
  return {
    variantId: filters.variantId,
    totalQuantity: warehouses.reduce((total, stock) => total + stock.quantity, 0),
    warehouses
  };
}

export function listInventoryAdjustments(tenantId, filters) {
  return prisma.inventoryAdjustment.findMany({
    where: {
      tenantId,
      variantId: filters.variantId,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {})
    },
    orderBy: { createdAt: "asc" }
  });
}
