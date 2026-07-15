import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const collectionPath = new URL(
  "../output/postman/multi-tenant-inventory.postman_collection.json",
  import.meta.url
);

async function readCollection() {
  return JSON.parse(await readFile(collectionPath, "utf8"));
}

function collectRequests(items, requests = []) {
  for (const item of items) {
    if (item.request) requests.push(item);
    if (item.item) collectRequests(item.item, requests);
  }
  return requests;
}

function findRequest(requests, name) {
  const request = requests.find((item) => item.name === name);
  assert.ok(request, `Postman request not found: ${name}`);
  return request;
}

test("every Postman request has a saved example for its tested status", async () => {
  const collection = await readCollection();
  const requests = collectRequests(collection.item);

  for (const item of requests) {
    const testScript = (item.event ?? [])
      .filter((event) => event.listen === "test")
      .flatMap((event) => event.script.exec)
      .join("\n");
    const expectedStatuses = [...testScript.matchAll(/HTTP (\d+)/g)].map(
      ([, status]) => Number(status)
    );
    const savedStatuses = (item.response ?? []).map((example) => example.code);

    for (const status of expectedStatuses) {
      assert.ok(
        savedStatuses.includes(status),
        `${item.name} is missing a saved ${status} response example`
      );
    }
  }

  const createProduct = findRequest(requests, "Create product with dynamic schema");
  const createVariant = findRequest(requests, "Create valid variant");
  const productTests = createProduct.event
    .find((event) => event.listen === "test")
    .script.exec.join("\n");
  const variantTests = createVariant.event
    .find((event) => event.listen === "test")
    .script.exec.join("\n");

  assert.match(productTests, /pm\.collectionVariables\.set\('productId', body\.data\.id\)/);
  assert.match(productTests, /pm\.environment\.has\('productId'\)/);
  assert.match(productTests, /pm\.environment\.set\('productId', body\.data\.id\)/);
  assert.equal(
    createVariant.request.url,
    "{{baseUrl}}/products/{{productId}}/variants"
  );
  assert.deepEqual(
    createVariant.response.map((example) => example.code).sort(),
    [201, 400]
  );
  assert.match(
    variantTests,
    /body\.data\.productId\)\.to\.eql\(pm\.collectionVariables\.get\('productId'\)\)/
  );
});
