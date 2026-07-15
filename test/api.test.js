import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createRateLimiter } from "../src/middleware/rate-limit.js";

const app = createApp();

test("health endpoint reports API readiness", async () => {
  const response = await request(app).get("/health").expect(200);
  assert.deepEqual(response.body, {
    status: "ok",
    message: "API is ready",
    data: { service: "multi-tenant-inventory" }
  });
});

test("HTTP responses include security headers and hide the Express fingerprint", async () => {
  const response = await request(app).get("/health").expect(200);

  assert.equal(response.headers["x-powered-by"], undefined);
  assert.ok(response.headers["content-security-policy"]);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("rate limiter returns a consistent 429 response after the configured limit", async () => {
  const limitedApp = express();
  limitedApp.use(createRateLimiter({ windowMs: 60_000, limit: 1 }));
  limitedApp.get("/limited", (_req, res) => res.json({ status: "ok" }));

  await request(limitedApp).get("/limited").expect(200);
  const response = await request(limitedApp).get("/limited").expect(429);

  assert.deepEqual(response.body, {
    status: "error",
    message: "Too many requests"
  });
  assert.ok(response.headers["ratelimit"]);
  assert.equal(response.headers["x-ratelimit-limit"], undefined);
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
