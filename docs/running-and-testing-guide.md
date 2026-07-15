# Running and Testing Guide

## 1. Project scope

This project is a REST-only multi-tenant inventory API built with Node.js, Express,
Prisma, PostgreSQL, and Joi. It demonstrates dynamic product variant schemas,
tenant-isolated catalog data, stock per warehouse, atomic adjustments, and atomic
warehouse transfers.

## 2. Prerequisites

- Node.js 22 or newer
- npm
- PostgreSQL running locally
- Postman for the guided API demonstration

Docker and GraphQL are intentionally not used.

## 3. Database setup

Create separate application and test databases:

```bash
createdb -U postgres inventory
createdb -U postgres inventory_test
```

Copy `.env.example` to `.env`, then replace `YOUR_PASSWORD` with your PostgreSQL
password. If your PostgreSQL administrator role is not `postgres`, change the username
in both URLs.

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory?schema=public"
TEST_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory_test?schema=public"
PORT=3000
```

The databases are deliberately separate because integration tests clear test data.
The test guard refuses to reset the application database.

## 4. Install, migrate, and run

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:migrate:test
npm test
npm run dev
```

Verify startup with `curl http://localhost:3000/health`.

## 5. Postman demonstration

Import `output/postman/multi-tenant-inventory.postman_collection.json`, start the API,
and run the collection in its existing order. The scripts automatically save and reuse
the API key, product ID, variant ID, and warehouse IDs.

Manual click-through order:

1. Create tenant A and save API key.
2. Create product with dynamic schema.
3. Create valid variant.
4. Create Jakarta warehouse.
5. Create Bandung warehouse.
6. Add opening stock.
7. Remove stock or transfer stock.
8. Read stock levels and inventory summary.

Opening a saved Example does not execute scripts. Use **Send** or **Run collection** to
populate variables from real responses.

## 6. Expected business flow

The product defines flexible attributes such as `color`, `storage`, and `refurbished`.
A variant is accepted only when its attributes satisfy that product schema. Stock is
stored independently for each `(tenantId, variantId, warehouseId)` combination.

If Jakarta contains five units and a withdrawal requests six, the adjustment returns
`409 Insufficient stock`. A following GET request returns `200` and quantity five,
proving that the rejected withdrawal did not change stock.

Transfers debit the source, credit the destination, create a transfer record, and write
two ledger entries in one transaction. Any failed step rolls back the entire transfer.

## 7. Verification

```bash
npm test
npx prisma validate
npm audit --omit=dev
```

The HTTP integration tests cover authentication, tenant isolation, variant validation,
multi-warehouse stock, negative-stock rejection, concurrent withdrawal, integer limits,
transfer rollback, inventory summaries, and the Postman response contract.

Architecture decisions and AI-assisted development disclosure are documented in
`docs/architecture-report.md`.
