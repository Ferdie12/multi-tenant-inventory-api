import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/application/database.js";
import { resetTestDatabase } from "./support/database.js";
import { tenantHeaders } from "./support/http.js";

const app = createApp();

before(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

async function createVariant(tenant) {
  const product = (await request(app)
    .post("/products")
    .set(tenantHeaders(tenant))
    .send({
      name: "T-Shirt",
      sku: "SHIRT",
      variantSchema: { size: { type: "string", required: true } }
    })).body.data;

  return (await request(app)
    .post(`/products/${product.id}/variants`)
    .set(tenantHeaders(tenant))
    .send({ sku: "SHIRT-M", attributes: { size: "M" } })).body.data;
}

test("stock is tracked independently in multiple warehouses", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const jakarta = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })
    .expect(201)).body.data;
  const bandung = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Bandung", code: "BDG" })
    .expect(201)).body.data;

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: jakarta.id, delta: 10, reason: "opening stock" })
    .expect(201);
  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: bandung.id, delta: 4 })
    .expect(201);

  const response = await request(app)
    .get(`/inventory?variantId=${variant.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);

  assert.deepEqual(
    response.body.data.map(({ warehouseId, quantity }) => ({ warehouseId, quantity })),
    [
      { warehouseId: bandung.id, quantity: 4 },
      { warehouseId: jakarta.id, quantity: 10 }
    ].sort((a, b) => a.warehouseId.localeCompare(b.warehouseId))
  );
});

test("an adjustment cannot make stock negative or write a failed ledger entry", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const warehouse = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: warehouse.id, delta: 5 })
    .expect(201);

  const rejected = await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: warehouse.id, delta: -6 })
    .expect(409);
  assert.equal(rejected.body.message, "Insufficient stock");

  const stock = await request(app)
    .get(`/inventory?variantId=${variant.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);
  assert.equal(stock.body.data[0].quantity, 5);

  const ledger = await request(app)
    .get(`/inventory/adjustments?variantId=${variant.id}&warehouseId=${warehouse.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);
  assert.deepEqual(ledger.body.data.map(({ delta, balanceAfter }) => ({ delta, balanceAfter })), [
    { delta: 5, balanceAfter: 5 }
  ]);
});

test("inventory resources cannot be adjusted or read by another tenant", async () => {
  const tenantA = (await request(app).post("/tenants").send({ name: "A" })).body.data;
  const tenantB = (await request(app).post("/tenants").send({ name: "B" })).body.data;
  const variant = await createVariant(tenantA);
  const warehouse = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenantA))
    .send({ name: "Jakarta", code: "JKT" })).body.data;

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenantB))
    .send({ variantId: variant.id, warehouseId: warehouse.id, delta: 1 })
    .expect(404);
  await request(app)
    .get(`/inventory?variantId=${variant.id}`)
    .set(tenantHeaders(tenantB))
    .expect(404);
});

test("concurrent withdrawals cannot overdraw stock", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const warehouse = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;
  const adjustment = { variantId: variant.id, warehouseId: warehouse.id };

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ ...adjustment, delta: 1 })
    .expect(201);

  const responses = await Promise.all([
    request(app).post("/inventory/adjustments").set(tenantHeaders(tenant)).send({ ...adjustment, delta: -1 }),
    request(app).post("/inventory/adjustments").set(tenantHeaders(tenant)).send({ ...adjustment, delta: -1 })
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);

  const stock = await request(app)
    .get(`/inventory?variantId=${variant.id}&warehouseId=${warehouse.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);
  assert.equal(stock.body.data[0].quantity, 0);
});

test("an adjustment delta must fit the PostgreSQL integer range", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const warehouse = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;

  const response = await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: warehouse.id, delta: 2147483648 })
    .expect(400);

  assert.equal(response.body.message, "Request validation failed");

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: warehouse.id, delta: -2147483648 })
    .expect(400);
});

test("a positive adjustment cannot overflow the stock quantity", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const warehouse = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;
  const adjustment = { variantId: variant.id, warehouseId: warehouse.id };

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ ...adjustment, delta: 2147483647 })
    .expect(201);
  const response = await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ ...adjustment, delta: 1 })
    .expect(409);

  assert.equal(response.body.message, "Stock limit exceeded");
});

test("stock transfer moves quantity atomically and summary includes total stock", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const jakarta = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;
  const medan = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Medan", code: "MDN" })).body.data;

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: jakarta.id, delta: 10 })
    .expect(201);

  const transfer = await request(app)
    .post("/inventory/transfers")
    .set(tenantHeaders(tenant))
    .send({
      variantId: variant.id,
      sourceWarehouseId: jakarta.id,
      targetWarehouseId: medan.id,
      quantity: 4,
      reason: "rebalancing"
    })
    .expect(201);

  assert.equal(transfer.body.data.sourceStock.quantity, 6);
  assert.equal(transfer.body.data.targetStock.quantity, 4);

  const summary = await request(app)
    .get(`/inventory/summary?variantId=${variant.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);
  assert.equal(summary.body.data.totalQuantity, 10);
  assert.deepEqual(
    summary.body.data.warehouses.map(({ warehouseId, quantity }) => ({ warehouseId, quantity })),
    [
      { warehouseId: jakarta.id, quantity: 6 },
      { warehouseId: medan.id, quantity: 4 }
    ].sort((a, b) => a.warehouseId.localeCompare(b.warehouseId))
  );
});

test("failed stock transfer rolls back both warehouses", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const source = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Jakarta", code: "JKT" })).body.data;
  const target = (await request(app)
    .post("/warehouses")
    .set(tenantHeaders(tenant))
    .send({ name: "Medan", code: "MDN" })).body.data;

  await request(app)
    .post("/inventory/adjustments")
    .set(tenantHeaders(tenant))
    .send({ variantId: variant.id, warehouseId: source.id, delta: 2 })
    .expect(201);

  await request(app)
    .post("/inventory/transfers")
    .set(tenantHeaders(tenant))
    .send({
      variantId: variant.id,
      sourceWarehouseId: source.id,
      targetWarehouseId: target.id,
      quantity: 3
    })
    .expect(409);

  const summary = await request(app)
    .get(`/inventory/summary?variantId=${variant.id}`)
    .set(tenantHeaders(tenant))
    .expect(200);
  assert.equal(summary.body.data.totalQuantity, 2);
  assert.deepEqual(summary.body.data.warehouses.map((stock) => stock.quantity), [2]);
});

test("inventory listing exposes pagination outside the data array", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const variant = await createVariant(tenant);
  const warehouses = [];
  for (const code of ["JKT", "BDG", "MDN"]) {
    warehouses.push((await request(app)
      .post("/warehouses")
      .set(tenantHeaders(tenant))
      .send({ name: code, code })
      .expect(201)).body.data);
  }

  for (const warehouse of warehouses) {
    await request(app)
      .post("/inventory/adjustments")
      .set(tenantHeaders(tenant))
      .send({ variantId: variant.id, warehouseId: warehouse.id, delta: 1 })
      .expect(201);
  }

  const response = await request(app)
    .get(`/inventory?variantId=${variant.id}&page=2&limit=1`)
    .set(tenantHeaders(tenant))
    .expect(200);

  assert.equal(response.body.data.length, 1);
  assert.deepEqual(response.body.pagination, {
    page: 2,
    limit: 1,
    totalItems: 3,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true
  });
});
