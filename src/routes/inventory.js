import { Router } from "express";

import {
  createAdjustmentController,
  createTransferController,
  createWarehouseController,
  listAdjustmentsController,
  listStockLevelsController,
  listStockSummaryController
} from "../controller/inventory.js";
import { requireTenant } from "../middleware/tenant.js";

export const inventoryRouter = Router();

inventoryRouter.post("/warehouses", requireTenant, createWarehouseController);
inventoryRouter.post(
  "/inventory/adjustments",
  requireTenant,
  createAdjustmentController
);
inventoryRouter.post(
  "/inventory/transfers",
  requireTenant,
  createTransferController
);
inventoryRouter.get(
  "/inventory/adjustments",
  requireTenant,
  listAdjustmentsController
);
inventoryRouter.get("/inventory", requireTenant, listStockLevelsController);
inventoryRouter.get(
  "/inventory/summary",
  requireTenant,
  listStockSummaryController
);
