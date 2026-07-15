export function tenantHeaders(tenant) {
  return {
    "x-tenant-api-key": tenant.apiKey
  };
}
