import { Router } from "express";

import {
  createProductController,
  createTenantController,
  createVariantController,
  listProductsController
} from "../controller/catalog.js";
import { requireTenant } from "../middleware/tenant.js";

export const catalogRouter = Router();

catalogRouter.post("/tenants", createTenantController);
catalogRouter.post("/products", requireTenant, createProductController);
catalogRouter.get("/products", requireTenant, listProductsController);
catalogRouter.post(
  "/products/:productId/variants",
  requireTenant,
  createVariantController
);

