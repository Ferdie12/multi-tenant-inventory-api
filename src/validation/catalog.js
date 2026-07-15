import Joi from "joi";

import { variantSchemaInput } from "./variant.js";
import { paginationInput } from "./common.js";

export const tenantInput = Joi.object({
  name: Joi.string().trim().min(1).max(120).required()
});

export const productInput = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  sku: Joi.string().trim().min(1).max(100).required(),
  variantSchema: variantSchemaInput
});

export const variantInput = Joi.object({
  sku: Joi.string().trim().min(1).max(100).required(),
  attributes: Joi.object().required()
});

export const productParams = Joi.object({
  productId: Joi.string().guid({ version: "uuidv4" }).required()
});

export const productQuery = paginationInput;
