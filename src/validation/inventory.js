import Joi from "joi";

export const warehouseInput = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  code: Joi.string().trim().min(1).max(60).required()
});

export const adjustmentInput = Joi.object({
  variantId: Joi.string().guid({ version: "uuidv4" }).required(),
  warehouseId: Joi.string().guid({ version: "uuidv4" }).required(),
  delta: Joi.number()
    .integer()
    .min(-2147483647)
    .max(2147483647)
    .invalid(0)
    .required(),
  reason: Joi.string().trim().max(300).allow(null).optional()
});

export const inventoryQuery = Joi.object({
  variantId: Joi.string().guid({ version: "uuidv4" }).required(),
  warehouseId: Joi.string().guid({ version: "uuidv4" }).optional()
});

export const transferInput = Joi.object({
  variantId: Joi.string().guid({ version: "uuidv4" }).required(),
  sourceWarehouseId: Joi.string().guid({ version: "uuidv4" }).required(),
  targetWarehouseId: Joi.string().guid({ version: "uuidv4" }).required(),
  quantity: Joi.number().integer().min(1).max(2147483647).required(),
  reason: Joi.string().trim().max(300).allow(null).optional()
});
