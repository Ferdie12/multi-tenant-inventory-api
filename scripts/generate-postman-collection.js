import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL(
  "../output/postman/multi-tenant-inventory.postman_collection.json",
  import.meta.url
);

const jsonHeader = { key: "Content-Type", value: "application/json" };
const tenantHeader = {
  key: "x-tenant-api-key",
  value: "{{tenantApiKey}}",
  type: "text"
};
const tenantBHeader = {
  key: "x-tenant-api-key",
  value: "{{tenantBApiKey}}",
  type: "text"
};

function testEvent(lines) {
  return [{
    listen: "test",
    script: { type: "text/javascript", exec: lines }
  }];
}

function syncVariableScript(name, expression) {
  return [
    `pm.collectionVariables.set('${name}', ${expression});`,
    `if (pm.environment && pm.environment.has('${name}')) {`,
    `  pm.environment.set('${name}', ${expression});`,
    "}"
  ];
}

function request({
  name,
  method = "GET",
  path,
  headers = [],
  body,
  tests = [],
  prerequest = [],
  examples = []
}) {
  const savedResponses = examples.length
    ? examples
    : [defaultExample({ name, method, path, headers, body, tests })];
  const item = {
    name,
    request: {
      method,
      header: headers,
      url: `{{baseUrl}}${path}`
    },
    response: savedResponses
  };
  if (body !== undefined) {
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: "json" } }
    };
  }
  const events = [];
  if (prerequest.length) {
    events.push({
      listen: "prerequest",
      script: { type: "text/javascript", exec: prerequest }
    });
  }
  events.push(...testEvent(tests));
  item.event = events;
  return item;
}

function savedExample({
  name,
  code,
  status,
  method = "GET",
  path,
  headers = [],
  requestBody,
  responseBody
}) {
  const originalRequest = {
    method,
    header: headers,
    url: `{{baseUrl}}${path}`
  };
  if (requestBody !== undefined) {
    originalRequest.body = {
      mode: "raw",
      raw: JSON.stringify(requestBody, null, 2),
      options: { raw: { language: "json" } }
    };
  }
  return {
    name,
    originalRequest,
    status,
    code,
    _postman_previewlanguage: "json",
    header: [{ key: "Content-Type", value: "application/json" }],
    cookie: [],
    body: JSON.stringify(responseBody, null, 2)
  };
}

const exampleMessages = {
  "Health check returns API readiness": "API is ready",
  "Create tenant A and save API key": "Tenant created successfully",
  "Create valid variant": "Variant created successfully",
  "Create Jakarta warehouse": "Warehouse created successfully",
  "Create Bandung warehouse": "Warehouse created successfully",
  "Add 10 opening stock": "Inventory adjusted successfully",
  "Remove 3 stock": "Inventory adjusted successfully",
  "Transfer 2 stock to Bandung": "Stock transferred successfully",
  "List stock levels in both warehouses": "Stock levels retrieved successfully",
  "Adjustment ledger is complete and immutable":
    "Inventory adjustments retrieved successfully",
  "List products includes the created variant": "Products retrieved successfully",
  "Verify failed withdrawal leaves stock unchanged": "Stock levels retrieved successfully",
  "Create tenant B and save API key": "Tenant created successfully",
  "Tenant B cannot list tenant A products": "Products retrieved successfully"
};

const exampleData = {
  "Health check returns API readiness": {
    service: "multi-tenant-inventory"
  },
  "Create tenant A and save API key": {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Postman Tenant A",
    apiKey: "tenant-api-key-is-returned-once"
  },
  "Create valid variant": {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    productId: "11111111-1111-4111-8111-111111111111",
    sku: "PHONE-BLACK-256-DEMO",
    attributes: { color: "black", storage: 256, refurbished: false }
  },
  "Create Jakarta warehouse": {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Jakarta Warehouse",
    code: "JKT-DEMO"
  },
  "Create Bandung warehouse": {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Bandung Warehouse",
    code: "BDG-DEMO"
  },
  "Add 10 opening stock": {
    delta: 10,
    balanceAfter: 10,
    stockLevel: { quantity: 10 }
  },
  "Remove 3 stock": {
    delta: -3,
    balanceAfter: 7,
    stockLevel: { quantity: 7 }
  },
  "Transfer 2 stock to Bandung": {
    sourceStock: { quantity: 5 },
    targetStock: { quantity: 2 }
  },
  "List stock levels in both warehouses": [
    { warehouseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", quantity: 5 },
    { warehouseId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", quantity: 2 }
  ],
  "Adjustment ledger is complete and immutable": [
    { delta: 10, balanceAfter: 10 },
    { delta: -3, balanceAfter: 7 },
    { delta: -2, balanceAfter: 5 },
    { delta: 2, balanceAfter: 2 }
  ],
  "List products includes the created variant": [
    {
      id: "11111111-1111-4111-8111-111111111111",
      variants: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]
    }
  ],
  "Verify failed withdrawal leaves stock unchanged": [
    { warehouseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", quantity: 5 }
  ],
  "Create tenant B and save API key": {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    name: "Postman Tenant B",
    apiKey: "tenant-b-api-key-is-returned-once"
  },
  "Tenant B cannot list tenant A products": []
};

const errorMessages = {
  "Protected route rejects a missing API key": "x-tenant-api-key header is required",
  "Protected route rejects an invalid API key": "Invalid tenant API key",
  "Malformed product ID returns 400": "Request validation failed",
  "Variant attributes must match dynamic schema":
    "Variant attributes do not match product schema",
  "Duplicate product SKU returns 409":
    "A resource with that SKU or code already exists",
  "Zero adjustment is rejected": "Request validation failed",
  "Withdrawal cannot make stock negative": "Insufficient stock",
  "Transfer source and target must differ":
    "Source and target warehouses must differ",
  "Inventory query requires variantId": "Request validation failed",
  "Unknown route returns JSON 404": "Route not found",
  "Tenant B cannot adjust tenant A resources": "Variant not found",
  "Tenant B cannot read tenant A inventory": "Variant not found"
};

const errorDetails = {
  "Malformed product ID returns 400": ["\"productId\" must be a valid GUID"],
  "Variant attributes must match dynamic schema": [
    "\"color\" must be one of [black, white]",
    "\"storage\" must be greater than or equal to 128",
    "\"extra\" is not allowed"
  ],
  "Zero adjustment is rejected": ["\"delta\" contains an invalid value"],
  "Inventory query requires variantId": ["\"variantId\" is required"]
};

function statusText(code) {
  return {
    200: "OK",
    201: "Created",
    400: "Bad Request",
    401: "Unauthorized",
    404: "Not Found",
    409: "Conflict"
  }[code] ?? "Response";
}

function defaultExample({ name, method, path, headers, body, tests }) {
  const statusLine = tests.find((line) => line.includes("HTTP "));
  const code = Number(statusLine.match(/HTTP (\d+)/)[1]);
  const isError = code >= 400;
  const responseBody = isError
    ? {
        status: "error",
        message: errorMessages[name] ?? `${name} failed`,
        ...(errorDetails[name] ? { errors: errorDetails[name] } : {})
      }
    : {
        status: "ok",
        message: exampleMessages[name] ?? `${name} succeeded`,
        data: exampleData[name] ?? {}
      };

  return savedExample({
    name: `${code} - ${name}`,
    code,
    status: statusText(code),
    method,
    path,
    headers,
    requestBody: body,
    responseBody
  });
}

const successEnvelope = [
  "const body = pm.response.json();",
  "pm.expect(body.status).to.eql('ok');",
  "pm.expect(body).to.have.property('data');"
];
const errorEnvelope = [
  "const body = pm.response.json();",
  "pm.expect(body.status).to.eql('error');",
  "pm.expect(body).not.to.have.property('data');"
];
const expectStatus = (status) =>
  `pm.test('HTTP ${status}', () => pm.response.to.have.status(${status}));`;

const collection = {
  info: {
    _postman_id: "6f2f09d1-8e34-4a26-9e0b-5e3dc6f0d5f1",
    name: "Multi-tenant Inventory API - Test Cases",
    description: [
      "Automated Postman test cases for the multi-tenant inventory API.",
      "Start the API, then run the whole collection in order with Collection Runner.",
      "The setup requests save API keys and resource IDs automatically.",
      "A unique runId prevents SKU/code conflicts when the collection is run again."
    ].join("\n\n"),
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000", type: "string" },
    { key: "runId", value: "", type: "string" },
    { key: "tenantApiKey", value: "", type: "string" },
    { key: "tenantBApiKey", value: "", type: "string" },
    { key: "productId", value: "", type: "string" },
    { key: "variantId", value: "", type: "string" },
    { key: "warehouseId", value: "", type: "string" },
    { key: "warehouseId2", value: "", type: "string" }
  ],
  item: [
    {
      name: "00 - Smoke and authentication",
      item: [
        request({
          name: "Health check returns API readiness",
          path: "/health",
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.message).to.eql('API is ready');",
            "pm.expect(body.data.service).to.eql('multi-tenant-inventory');"
          ]
        }),
        request({
          name: "Protected route rejects a missing API key",
          path: "/products",
          tests: [
            expectStatus(401),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('x-tenant-api-key header is required');"
          ]
        }),
        request({
          name: "Protected route rejects an invalid API key",
          path: "/products",
          headers: [{ key: "x-tenant-api-key", value: "invalid-api-key" }],
          tests: [
            expectStatus(401),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Invalid tenant API key');"
          ]
        })
      ]
    },
    {
      name: "01 - Setup catalog and warehouses",
      item: [
        request({
          name: "Create tenant A and save API key",
          method: "POST",
          path: "/tenants",
          headers: [jsonHeader],
          body: { name: "Postman Tenant A" },
          prerequest: [
            "const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;",
            ...syncVariableScript("runId", "runId"),
            "const body = JSON.parse(pm.request.body.raw);",
            "body.name = `Postman Tenant A ${runId}`;",
            "pm.request.body.raw = JSON.stringify(body);"
          ],
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.message).to.eql('Tenant created successfully');",
            "pm.expect(body.data.apiKey).to.be.a('string').and.not.empty;",
            ...syncVariableScript("tenantApiKey", "body.data.apiKey")
          ]
        }),
        request({
          name: "Create product with dynamic schema",
          method: "POST",
          path: "/products",
          headers: [jsonHeader, tenantHeader],
          body: {
            name: "Phone",
            sku: "PHONE-{{runId}}",
            variantSchema: {
              color: { type: "string", required: true, values: ["black", "white"] },
              storage: { type: "number", required: true, min: 128, max: 512 },
              refurbished: { type: "boolean" }
            }
          },
          examples: [
            savedExample({
              name: "201 - Product created",
              code: 201,
              status: "Created",
              method: "POST",
              path: "/products",
              headers: [jsonHeader, tenantHeader],
              requestBody: {
                name: "Phone",
                sku: "PHONE-DEMO",
                variantSchema: {
                  color: { type: "string", required: true }
                }
              },
              responseBody: {
                status: "ok",
                message: "Product created successfully",
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  name: "Phone",
                  sku: "PHONE-DEMO",
                  variantSchema: {
                    color: { type: "string", required: true }
                  }
                }
              }
            }),
            savedExample({
              name: "400 - Product validation error",
              code: 400,
              status: "Bad Request",
              method: "POST",
              path: "/products",
              headers: [jsonHeader, tenantHeader],
              requestBody: { name: "Phone" },
              responseBody: {
                status: "error",
                message: "Request validation failed",
                errors: [
                  "\"sku\" is required",
                  "\"variantSchema\" is required"
                ]
              }
            })
          ],
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.sku).to.eql(`PHONE-${pm.collectionVariables.get('runId')}`);",
            "pm.expect(body.data.variantSchema.storage.min).to.eql(128);",
            ...syncVariableScript("productId", "body.data.id")
          ]
        }),
        request({
          name: "Create valid variant",
          method: "POST",
          path: "/products/{{productId}}/variants",
          headers: [jsonHeader, tenantHeader],
          body: {
            sku: "PHONE-BLACK-256-{{runId}}",
            attributes: { color: "black", storage: 256, refurbished: false }
          },
          examples: [
            savedExample({
              name: "201 - Variant created",
              code: 201,
              status: "Created",
              method: "POST",
              path: "/products/{{productId}}/variants",
              headers: [jsonHeader, tenantHeader],
              requestBody: {
                sku: "PHONE-BLACK-256-DEMO",
                attributes: { color: "black", storage: 256, refurbished: false }
              },
              responseBody: {
                status: "ok",
                message: "Variant created successfully",
                data: {
                  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  productId: "11111111-1111-4111-8111-111111111111",
                  sku: "PHONE-BLACK-256-DEMO",
                  attributes: { color: "black", storage: 256, refurbished: false }
                }
              }
            }),
            savedExample({
              name: "400 - Variant schema mismatch",
              code: 400,
              status: "Bad Request",
              method: "POST",
              path: "/products/{{productId}}/variants",
              headers: [jsonHeader, tenantHeader],
              requestBody: {
                sku: "PHONE-BAD-DEMO",
                attributes: { color: "blue", storage: 64, extra: "not allowed" }
              },
              responseBody: {
                status: "error",
                message: "Variant attributes do not match product schema",
                errors: [
                  "\"color\" must be one of [black, white]",
                  "\"storage\" must be greater than or equal to 128",
                  "\"extra\" is not allowed"
                ]
              }
            })
          ],
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.productId).to.eql(pm.collectionVariables.get('productId'));",
            "pm.expect(body.data.attributes.storage).to.eql(256);",
            ...syncVariableScript("variantId", "body.data.id")
          ]
        }),
        request({
          name: "Create Jakarta warehouse",
          method: "POST",
          path: "/warehouses",
          headers: [jsonHeader, tenantHeader],
          body: { name: "Jakarta Warehouse", code: "JKT-{{runId}}" },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.code).to.eql(`JKT-${pm.collectionVariables.get('runId')}`);",
            ...syncVariableScript("warehouseId", "body.data.id")
          ]
        }),
        request({
          name: "Create Bandung warehouse",
          method: "POST",
          path: "/warehouses",
          headers: [jsonHeader, tenantHeader],
          body: { name: "Bandung Warehouse", code: "BDG-{{runId}}" },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            ...syncVariableScript("warehouseId2", "body.data.id")
          ]
        })
      ]
    },
    {
      name: "02 - Inventory happy path",
      item: [
        request({
          name: "Add 10 opening stock",
          method: "POST",
          path: "/inventory/adjustments",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            warehouseId: "{{warehouseId}}",
            delta: 10,
            reason: "opening stock"
          },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.delta).to.eql(10);",
            "pm.expect(body.data.balanceAfter).to.eql(10);",
            "pm.expect(body.data.stockLevel.quantity).to.eql(10);"
          ]
        }),
        request({
          name: "Remove 3 stock",
          method: "POST",
          path: "/inventory/adjustments",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            warehouseId: "{{warehouseId}}",
            delta: -3,
            reason: "customer order"
          },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.balanceAfter).to.eql(7);"
          ]
        }),
        request({
          name: "Transfer 2 stock to Bandung",
          method: "POST",
          path: "/inventory/transfers",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            sourceWarehouseId: "{{warehouseId}}",
            targetWarehouseId: "{{warehouseId2}}",
            quantity: 2,
            reason: "rebalancing"
          },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            "pm.expect(body.data.sourceStock.quantity).to.eql(5);",
            "pm.expect(body.data.targetStock.quantity).to.eql(2);"
          ]
        }),
        request({
          name: "List stock levels in both warehouses",
          path: "/inventory?variantId={{variantId}}",
          headers: [tenantHeader],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.data).to.have.length(2);",
            "const quantities = Object.fromEntries(body.data.map(x => [x.warehouseId, x.quantity]));",
            "pm.expect(quantities[pm.collectionVariables.get('warehouseId')]).to.eql(5);",
            "pm.expect(quantities[pm.collectionVariables.get('warehouseId2')]).to.eql(2);"
          ]
        }),
        request({
          name: "Inventory summary reports total stock",
          path: "/inventory/summary?variantId={{variantId}}",
          headers: [tenantHeader],
          examples: [
            savedExample({
              name: "200 - Inventory summary",
              code: 200,
              status: "OK",
              path: "/inventory/summary?variantId={{variantId}}",
              headers: [tenantHeader],
              responseBody: {
                status: "ok",
                message: "Inventory summary retrieved successfully",
                data: {
                  variantId: "33333333-3333-4333-8333-333333333333",
                  totalQuantity: 7,
                  warehouses: [
                    {
                      warehouseId: "44444444-4444-4444-8444-444444444444",
                      quantity: 5
                    },
                    {
                      warehouseId: "55555555-5555-4555-8555-555555555555",
                      quantity: 2
                    }
                  ]
                }
              }
            }),
            savedExample({
              name: "400 - Invalid variant ID",
              code: 400,
              status: "Bad Request",
              path: "/inventory/summary?variantId=not-a-uuid",
              headers: [tenantHeader],
              responseBody: {
                status: "error",
                message: "Request validation failed",
                errors: ["\"variantId\" must be a valid GUID"]
              }
            })
          ],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.data.totalQuantity).to.eql(7);",
            "pm.expect(body.data.warehouses).to.have.length(2);"
          ]
        }),
        request({
          name: "Adjustment ledger is complete and immutable",
          path: "/inventory/adjustments?variantId={{variantId}}",
          headers: [tenantHeader],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.data).to.have.length(4);",
            "pm.expect(body.data.map(x => x.delta)).to.have.members([10, -3, -2, 2]);"
          ]
        }),
        request({
          name: "List products includes the created variant",
          path: "/products",
          headers: [tenantHeader],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "const product = body.data.find(x => x.id === pm.collectionVariables.get('productId'));",
            "pm.expect(product).to.be.an('object');",
            "pm.expect(product.variants.map(x => x.id)).to.include(pm.collectionVariables.get('variantId'));"
          ]
        })
      ]
    },
    {
      name: "03 - Validation and business errors",
      item: [
        request({
          name: "Malformed product ID returns 400",
          method: "POST",
          path: "/products/not-a-uuid/variants",
          headers: [jsonHeader, tenantHeader],
          body: { sku: "INVALID-{{runId}}", attributes: { color: "black" } },
          tests: [
            expectStatus(400),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Request validation failed');"
          ]
        }),
        request({
          name: "Variant attributes must match dynamic schema",
          method: "POST",
          path: "/products/{{productId}}/variants",
          headers: [jsonHeader, tenantHeader],
          body: {
            sku: "PHONE-BAD-{{runId}}",
            attributes: { color: "blue", storage: 64, extra: "not allowed" }
          },
          tests: [
            expectStatus(400),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Variant attributes do not match product schema');",
            "pm.expect(body.errors.length).to.be.at.least(3);"
          ]
        }),
        request({
          name: "Duplicate product SKU returns 409",
          method: "POST",
          path: "/products",
          headers: [jsonHeader, tenantHeader],
          body: {
            name: "Duplicate Phone",
            sku: "PHONE-{{runId}}",
            variantSchema: { color: { type: "string", required: true } }
          },
          tests: [
            expectStatus(409),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('A resource with that SKU or code already exists');"
          ]
        }),
        request({
          name: "Zero adjustment is rejected",
          method: "POST",
          path: "/inventory/adjustments",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            warehouseId: "{{warehouseId}}",
            delta: 0
          },
          tests: [
            expectStatus(400),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Request validation failed');"
          ]
        }),
        request({
          name: "Withdrawal cannot make stock negative",
          method: "POST",
          path: "/inventory/adjustments",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            warehouseId: "{{warehouseId}}",
            delta: -6,
            reason: "must fail because balance is 5"
          },
          tests: [
            expectStatus(409),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Insufficient stock');"
          ]
        }),
        request({
          name: "Verify failed withdrawal leaves stock unchanged",
          path: "/inventory?variantId={{variantId}}&warehouseId={{warehouseId}}",
          headers: [tenantHeader],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.data).to.have.length(1);",
            "pm.expect(body.data[0].quantity).to.eql(5);"
          ]
        }),
        request({
          name: "Transfer source and target must differ",
          method: "POST",
          path: "/inventory/transfers",
          headers: [jsonHeader, tenantHeader],
          body: {
            variantId: "{{variantId}}",
            sourceWarehouseId: "{{warehouseId}}",
            targetWarehouseId: "{{warehouseId}}",
            quantity: 1
          },
          tests: [
            expectStatus(400),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Source and target warehouses must differ');"
          ]
        }),
        request({
          name: "Inventory query requires variantId",
          path: "/inventory",
          headers: [tenantHeader],
          tests: [
            expectStatus(400),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Request validation failed');"
          ]
        }),
        request({
          name: "Unknown route returns JSON 404",
          path: "/does-not-exist",
          tests: [
            expectStatus(404),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Route not found');"
          ]
        })
      ]
    },
    {
      name: "04 - Tenant isolation",
      item: [
        request({
          name: "Create tenant B and save API key",
          method: "POST",
          path: "/tenants",
          headers: [jsonHeader],
          body: { name: "Postman Tenant B {{runId}}" },
          tests: [
            expectStatus(201),
            ...successEnvelope,
            ...syncVariableScript("tenantBApiKey", "body.data.apiKey")
          ]
        }),
        request({
          name: "Tenant B cannot list tenant A products",
          path: "/products",
          headers: [tenantBHeader],
          tests: [
            expectStatus(200),
            ...successEnvelope,
            "pm.expect(body.data).to.eql([]);"
          ]
        }),
        request({
          name: "Tenant B cannot adjust tenant A resources",
          method: "POST",
          path: "/inventory/adjustments",
          headers: [jsonHeader, tenantBHeader],
          body: {
            variantId: "{{variantId}}",
            warehouseId: "{{warehouseId}}",
            delta: 1
          },
          tests: [
            expectStatus(404),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Variant not found');"
          ]
        }),
        request({
          name: "Tenant B cannot read tenant A inventory",
          path: "/inventory?variantId={{variantId}}",
          headers: [tenantBHeader],
          tests: [
            expectStatus(404),
            ...errorEnvelope,
            "pm.expect(body.message).to.eql('Variant not found');"
          ]
        })
      ]
    }
  ]
};

await mkdir(new URL("../output/postman/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
