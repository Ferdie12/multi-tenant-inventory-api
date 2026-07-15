import { prisma } from "../application/database.js";
import { HttpError } from "../error/response-error.js";
import { createApiKey } from "../security/api-key.js";
import { validateVariantAttributes } from "../validation/variant.js";
import { buildPagination } from "../validation/common.js";

export async function createTenant(data) {
  const apiKey = createApiKey();
  const tenant = await prisma.tenant.create({
    data: { ...data, apiKeyHash: apiKey.hash }
  });
  const { apiKeyHash: _apiKeyHash, ...safeTenant } = tenant;
  return { ...safeTenant, apiKey: apiKey.value };
}

export function createProduct(tenantId, data) {
  return prisma.product.create({ data: { ...data, tenantId } });
}

export async function listProducts(tenantId, { page, limit }) {
  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where: { tenantId },
      include: { variants: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip,
      take: limit
    }),
    prisma.product.count({ where: { tenantId } })
  ]);

  return {
    items,
    pagination: buildPagination(page, limit, total)
  };
}

export async function createVariant(tenantId, productId, input) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId }
  });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  const attributes = validateVariantAttributes(
    product.variantSchema,
    input.attributes
  );
  return prisma.productVariant.create({
    data: {
      tenantId,
      productId: product.id,
      sku: input.sku,
      attributes
    }
  });
}
