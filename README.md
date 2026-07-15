# Multi-tenant inventory REST API

A small Node.js API using Express, Joi, Prisma, and PostgreSQL. It supports tenant-isolated products, dynamic variant schemas, multiple warehouses, atomic stock adjustments, and an immutable adjustment ledger.

## Setup

Requirements: Node.js 22+ and a running PostgreSQL server. Docker is not required.

Create separate application and test databases with your PostgreSQL administrator user:

```bash
createdb -U postgres inventory
createdb -U postgres inventory_test
```

If your administrator role is not named `postgres`, replace it with your local PostgreSQL
role. Copy the environment template and replace `YOUR_PASSWORD` with that role's password:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:migrate:test
npm test
npm run dev
```

The expected environment variables are:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory?schema=public"
TEST_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory_test?schema=public"
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=1000
```

`DATABASE_URL` stores development data. `TEST_DATABASE_URL` is intentionally separate
because the test suite clears its data between cases. Tests refuse to start unless the
test URL points to a different database whose name contains `test`.

After startup, verify the API:

```bash
curl http://localhost:3000/health
```

The server listens on `PORT=3000` by default.

## Submission artifacts

- [`docs/architecture-report.md`](docs/architecture-report.md) explains architecture
  decisions, trade-offs, testing, and how AI assistance was reviewed.
- [`docs/running-and-testing-guide.md`](docs/running-and-testing-guide.md) is the readable
  source guide for setup, Postman flow, and verification.
- [`output/pdf/multi-tenant-inventory-guide.pdf`](output/pdf/multi-tenant-inventory-guide.pdf)
  is the printable setup and demonstration guide.
- [`output/postman/multi-tenant-inventory.postman_collection.json`](output/postman/multi-tenant-inventory.postman_collection.json)
  contains the executable REST scenarios and saved response examples.

## Verification commands

```bash
npm run db:generate
npm test
npx prisma validate
npm audit --omit=dev
```

## Code map

- `src/application/web.js` assembles Express; `src/app.js` is a compatibility export.
- `src/application/database.js` owns the Prisma client.
- `src/routes/` wires HTTP endpoints to thin controllers.
- `src/controller/` translates validated HTTP input into service calls and responses.
- `src/service/` contains catalog and atomic inventory business rules.
- `src/validation/` contains Joi request schemas and dynamic variant-attribute validation.
- `src/middleware/tenant.js` resolves and verifies tenant context.
- `src/error/response-error.js` contains shared HTTP errors and final error responses.

## Tenant context and API key

Create a tenant once. The response includes an `apiKey`; store it securely and send it
as `x-tenant-api-key` on every catalog and inventory request. Middleware resolves the
tenant ID from the API key; clients do not send a tenant ID.

```bash
curl -X POST http://localhost:3000/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme"}'
```

The API key is returned only when the tenant is created. It is stored as a hash in the
database, so create a new tenant if the key is lost.

The API key is intentionally simple for this assignment. Production user-facing systems
should normally derive tenant context from verified authentication and use HTTPS.

## Response format

Successful responses keep the HTTP status code and use a predictable envelope:

```json
{
  "status": "ok",
  "message": "Product created successfully",
  "data": {
    "id": "...",
    "name": "Phone"
  }
}
```

Errors keep their `4xx` or `5xx` HTTP status and do not include `data`:

```json
{
  "status": "error",
  "message": "Request validation failed",
  "errors": ["\"sku\" is required"]
}
```

The optional `errors` array is included for validation details. Internal server errors
return a generic message and never expose stack traces.

## Dynamic variants

The keys in `variantSchema` are merchant-defined. Supported types are `string`, `number`, and `boolean`. String rules may use `values`; number rules may use `min` and `max`; any rule may be `required`.

```bash
curl -X POST http://localhost:3000/products \
  -H 'content-type: application/json' \
  -H 'x-tenant-api-key: TENANT_API_KEY' \
  -d '{
    "name":"Phone",
    "sku":"PHONE",
    "variantSchema":{
      "color":{"type":"string","required":true,"values":["black","white"]},
      "storage":{"type":"number","required":true,"min":128,"max":512},
      "refurbished":{"type":"boolean"}
    }
  }'

curl -X POST http://localhost:3000/products/PRODUCT_ID/variants \
  -H 'content-type: application/json' \
  -H 'x-tenant-api-key: TENANT_API_KEY' \
  -d '{"sku":"PHONE-BLACK-256","attributes":{"color":"black","storage":256,"refurbished":false}}'
```

## REST endpoints

Import `output/postman/multi-tenant-inventory.postman_collection.json` into Postman
to run 28 automated API test cases. Start the API, select the collection, then click
**Run collection** and keep the requests in their existing order. Test scripts save API
keys and resource IDs in collection variables automatically. Each run also creates a
unique suffix, so the collection can be run repeatedly without duplicate SKU or warehouse
code conflicts.

If an active Postman environment already contains a variable with the same ID name, the
scripts refresh that environment value too, so an old environment value cannot override
the newly generated collection value.

The collection covers smoke checks, authentication, the complete catalog/inventory happy
path, request validation, stock and transfer business rules, and tenant isolation. To
regenerate it after changing the generator, run `npm run postman:generate`.

Every collection request now includes a saved response example for the status asserted by
its test script. This includes the variant success response (`201`), the dynamic-schema
validation error (`400`), authentication errors, stock business errors, tenant-isolation
errors, and the product/summary requests with both success and error examples. Open a
request's **Examples** menu in Postman to view a response without sending the request.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/tenants` | Create a tenant |
| `POST` | `/products` | Create a schema-driven product |
| `GET` | `/products?page=1&limit=50` | List products with variants and pagination |
| `POST` | `/products/:productId/variants` | Create and validate a variant |
| `POST` | `/warehouses` | Create a warehouse |
| `POST` | `/inventory/adjustments` | Atomically add or remove stock |
| `POST` | `/inventory/transfers` | Atomically move stock between warehouses |
| `GET` | `/inventory?variantId=...&warehouseId=...&page=1&limit=50` | Read stock levels with pagination |
| `GET` | `/inventory/summary?variantId=...&page=1&limit=50` | Read per-warehouse stock plus total |
| `GET` | `/inventory/adjustments?variantId=...&warehouseId=...&page=1&limit=50` | Read the adjustment ledger with pagination |

List endpoints keep `data` as an array and return pagination metadata outside it:

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Requests are limited by `RATE_LIMIT_MAX` within `RATE_LIMIT_WINDOW_MS` milliseconds.

Adjustment example:

```bash
curl -X POST http://localhost:3000/inventory/adjustments \
  -H 'content-type: application/json' \
  -H 'x-tenant-api-key: TENANT_API_KEY' \
  -d '{"variantId":"VARIANT_ID","warehouseId":"WAREHOUSE_ID","delta":10,"reason":"opening stock"}'
```

Negative `delta` values remove stock. An adjustment that would make the balance negative returns `409 Conflict` and is rolled back without a ledger entry.

Transfer example:

```bash
curl -X POST http://localhost:3000/inventory/transfers \
  -H 'content-type: application/json' \
  -H 'x-tenant-api-key: TENANT_API_KEY' \
  -d '{"variantId":"VARIANT_ID","sourceWarehouseId":"JAKARTA_ID","targetWarehouseId":"MEDAN_ID","quantity":5,"reason":"rebalancing"}'
```

The transfer updates both warehouses and writes its ledger entries in one transaction.
