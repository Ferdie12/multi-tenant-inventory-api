import express from "express";

import { routeNotFound, handleError } from "../error/response-error.js";
import { sendSuccess } from "../response/api-response.js";
import { catalogRouter } from "../routes/catalog.js";
import { inventoryRouter } from "../routes/inventory.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.get("/health", (_req, res) => sendSuccess(res, {
    message: "API is ready",
    data: { service: "multi-tenant-inventory" }
  }));
  app.use(catalogRouter);
  app.use(inventoryRouter);
  app.use(routeNotFound);
  app.use(handleError);

  return app;
}
