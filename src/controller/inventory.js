import {
  adjustInventory,
  createWarehouse,
  listInventory,
  listInventoryAdjustments,
  listInventorySummary,
  transferInventory
} from "../service/inventory.js";
import { validate } from "../validation/common.js";
import {
  adjustmentInput,
  inventoryQuery,
  transferInput,
  warehouseInput
} from "../validation/inventory.js";
import { sendSuccess } from "../response/api-response.js";

export async function createWarehouseController(req, res) {
  const data = validate(warehouseInput, req.body);
  return sendSuccess(res, {
    status: 201,
    message: "Warehouse created successfully",
    data: await createWarehouse(req.tenantId, data)
  });
}

export async function createAdjustmentController(req, res) {
  const input = validate(adjustmentInput, req.body);
  return sendSuccess(res, {
    status: 201,
    message: "Inventory adjusted successfully",
    data: await adjustInventory(req.tenantId, input)
  });
}

export async function createTransferController(req, res) {
  const input = validate(transferInput, req.body);
  return sendSuccess(res, {
    status: 201,
    message: "Stock transferred successfully",
    data: await transferInventory(req.tenantId, input)
  });
}

export async function listAdjustmentsController(req, res) {
  const filters = validate(inventoryQuery, req.query);
  return sendSuccess(res, {
    message: "Inventory adjustments retrieved successfully",
    data: await listInventoryAdjustments(req.tenantId, filters)
  });
}

export async function listStockLevelsController(req, res) {
  const filters = validate(inventoryQuery, req.query);
  return sendSuccess(res, {
    message: "Stock levels retrieved successfully",
    data: await listInventory(req.tenantId, filters)
  });
}

export async function listStockSummaryController(req, res) {
  const filters = validate(inventoryQuery, req.query);
  return sendSuccess(res, {
    message: "Inventory summary retrieved successfully",
    data: await listInventorySummary(req.tenantId, filters)
  });
}
