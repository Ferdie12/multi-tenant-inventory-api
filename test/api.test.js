import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/app.js";

const app = createApp();

test("health endpoint reports API readiness", async () => {
  const response = await request(app).get("/health").expect(200);
  assert.deepEqual(response.body, {
    status: "ok",
    message: "API is ready",
    data: { service: "multi-tenant-inventory" }
  });
});

test("unknown routes return a JSON 404", async () => {
  const response = await request(app).get("/does-not-exist").expect(404);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Route not found");
  assert.equal("data" in response.body, false);
});

test("tenant routes require an API key", async () => {
  const response = await request(app).get("/products").expect(401);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "x-tenant-api-key header is required");
});

test("tenant routes reject an invalid API key", async () => {
  const response = await request(app)
    .get("/products")
    .set("x-tenant-api-key", "invalid")
    .expect(401);
  assert.equal(response.body.message, "Invalid tenant API key");
});

test("production tenant routes require an API key", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const response = await request(app)
      .get("/products")
      .expect(401);
    assert.equal(response.body.message, "x-tenant-api-key header is required");
  } finally {
    process.env.NODE_ENV = previousEnvironment;
  }
});
