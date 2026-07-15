import { prisma } from "../application/database.js";
import { HttpError } from "../error/response-error.js";
import { hashApiKey } from "../security/api-key.js";

export async function requireTenant(req, _res, next) {
  const apiKey = req.get("x-tenant-api-key");

  if (!apiKey) {
    throw new HttpError(401, "x-tenant-api-key header is required");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { apiKeyHash: hashApiKey(apiKey) },
    select: { id: true }
  });
  if (!tenant) {
    throw new HttpError(401, "Invalid tenant API key");
  }

  req.tenantId = tenant.id;
  next();
}
