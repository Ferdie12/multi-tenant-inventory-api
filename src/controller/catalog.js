import {
  createProduct,
  createTenant,
  createVariant,
  listProducts
} from "../service/catalog.js";
import { validate } from "../validation/common.js";
import {
  productInput,
  productParams,
  tenantInput,
  variantInput
} from "../validation/catalog.js";
import { sendSuccess } from "../response/api-response.js";

export async function createTenantController(req, res) {
  const data = validate(tenantInput, req.body);
  return sendSuccess(res, {
    status: 201,
    message: "Tenant created successfully",
    data: await createTenant(data)
  });
}

export async function createProductController(req, res) {
  const data = validate(productInput, req.body);
  return sendSuccess(res, {
    status: 201,
    message: "Product created successfully",
    data: await createProduct(req.tenantId, data)
  });
}

export async function listProductsController(req, res) {
  return sendSuccess(res, {
    message: "Products retrieved successfully",
    data: await listProducts(req.tenantId)
  });
}

export async function createVariantController(req, res) {
  const { productId } = validate(productParams, req.params);
  const input = validate(variantInput, req.body);
  const variant = await createVariant(req.tenantId, productId, input);
  return sendSuccess(res, {
    status: 201,
    message: "Variant created successfully",
    data: variant
  });
}
