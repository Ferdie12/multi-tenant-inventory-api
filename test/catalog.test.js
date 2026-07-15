import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { prisma } from "../src/application/database.js";
import { createApp } from "../src/app.js";
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

test("a tenant creates a product with a dynamic variant schema", async () => {
  const tenantResponse = await request(app)
    .post("/tenants")
    .send({ name: "Acme" })
    .expect(201);

  const response = await request(app)
    .post("/products")
    .set(tenantHeaders(tenantResponse.body.data))
    .send({
      name: "T-Shirt",
      sku: "SHIRT",
      variantSchema: {
        color: { type: "string", required: true, values: ["black", "white"] },
        size: { type: "string", required: true, values: ["S", "M", "L"] }
      }
    })
    .expect(201);

  assert.equal(response.body.status, "ok");
  assert.equal(response.body.data.name, "T-Shirt");
  assert.equal(response.body.data.sku, "SHIRT");
  assert.deepEqual(response.body.data.variantSchema.color.values, ["black", "white"]);
});

test("a variant is rejected when its attributes do not match the product schema", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const product = (await request(app)
    .post("/products")
    .set(tenantHeaders(tenant))
    .send({
      name: "Phone",
      sku: "PHONE",
      variantSchema: {
        color: { type: "string", required: true, values: ["black", "white"] },
        storage: { type: "number", required: true, min: 128, max: 512 },
        refurbished: { type: "boolean" }
      }
    })).body.data;

  const response = await request(app)
    .post(`/products/${product.id}/variants`)
    .set(tenantHeaders(tenant))
    .send({
      sku: "PHONE-BAD",
      attributes: { color: "blue", storage: 64, extra: "not allowed" }
    })
    .expect(400);

  assert.equal(response.body.message, "Variant attributes do not match product schema");
  assert.ok(response.body.errors.length >= 3);
});

test("product and SKU data is isolated by tenant", async () => {
  const tenantA = (await request(app).post("/tenants").send({ name: "A" })).body.data;
  const tenantB = (await request(app).post("/tenants").send({ name: "B" })).body.data;
  const product = {
    name: "Shared SKU",
    sku: "SAME-SKU",
    variantSchema: { color: { type: "string", required: true } }
  };

  const productA = (await request(app)
    .post("/products")
    .set(tenantHeaders(tenantA))
    .send(product)
    .expect(201)).body.data;
  await request(app).post("/products").set(tenantHeaders(tenantB)).send(product).expect(201);

  const variant = await request(app)
    .post(`/products/${productA.id}/variants`)
    .set(tenantHeaders(tenantA))
    .send({ sku: "SAME-VARIANT-SKU", attributes: { color: "red" } })
    .expect(201);

  const response = await request(app)
    .get("/products")
    .set(tenantHeaders(tenantA))
    .expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].tenantId, tenantA.id);
  assert.equal(response.body.data[0].variants[0].id, variant.body.data.id);
});

test("duplicate product SKUs within one tenant return a conflict", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const product = {
    name: "T-Shirt",
    sku: "SHIRT",
    variantSchema: { size: { type: "string", required: true } }
  };

  await request(app).post("/products").set(tenantHeaders(tenant)).send(product).expect(201);
  const response = await request(app)
    .post("/products")
    .set(tenantHeaders(tenant))
    .send(product)
    .expect(409);

  assert.equal(response.body.message, "A resource with that SKU or code already exists");
});

test("a malformed product ID is rejected before querying PostgreSQL", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const response = await request(app)
    .post("/products/not-a-uuid/variants")
    .set(tenantHeaders(tenant))
    .send({ sku: "VARIANT", attributes: { color: "red" } })
    .expect(400);

  assert.equal(response.body.message, "Request validation failed");
});

test("unknown dynamic schema rules are rejected instead of silently ignored", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const response = await request(app)
    .post("/products")
    .set(tenantHeaders(tenant))
    .send({
      name: "T-Shirt",
      sku: "SHIRT",
      variantSchema: {
        color: { type: "string", required: true, enum: ["red", "blue"] }
      }
    })
    .expect(400);

  assert.ok(response.body.errors.some((detail) => detail.includes("enum")));
});

test("a numeric variant rule cannot define min greater than max", async () => {
  const tenant = (await request(app).post("/tenants").send({ name: "Acme" })).body.data;
  const response = await request(app)
    .post("/products")
    .set(tenantHeaders(tenant))
    .send({
      name: "Phone",
      sku: "PHONE",
      variantSchema: {
        storage: { type: "number", min: 512, max: 128 }
      }
    })
    .expect(400);

  assert.equal(response.body.message, "Request validation failed");
});
