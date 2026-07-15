# Architecture Report

## Scope

This project implements a multi-tenant e-commerce inventory API with REST, dynamic
product variant schemas, and stock tracked independently per warehouse. GraphQL is
intentionally excluded because the selected scope is REST-only.

## Decisions

- **Node.js + Express 5:** small HTTP surface and straightforward middleware composition.
- **JavaScript ES modules:** matches the project runtime and keeps the sample easy to run.
- **Prisma + PostgreSQL:** Prisma provides a readable data access layer while PostgreSQL
  provides UUIDs, relational constraints, composite uniqueness, and transactional updates.
- **Tenant scoping:** every tenant-owned lookup includes `tenantId`; the tenant is resolved
  by middleware from the tenant API key before controller/service execution. Clients never
  choose the tenant ID used by services.
- **Dynamic variants:** `Product.variantSchema` is JSON because merchants define their own
  attributes. Joi validates the schema definition and the service validates each variant's
  attributes against that definition.
- **Inventory safety:** stock changes run in a transaction with a guarded conditional
  update. Negative balances and integer overflow are rejected, and the adjustment ledger
  is written only after the stock update succeeds.
- **Transfers:** moving stock between warehouses updates both balances and creates the
  transfer record plus paired ledger entries inside one interactive transaction. A failed
  source withdrawal or destination update rolls back the entire transfer.
- **API onboarding:** `POST /tenants` returns a random API key once. Only its SHA-256 hash
  is persisted, and middleware derives tenant context from that credential.
- **Layering:** routes wire endpoints, controllers handle HTTP input/output, validation
  handles Joi rules, and services contain business decisions. This keeps controllers thin
  and makes the domain rules testable.
- **Response contract:** successful responses use `status`, `message`, and `data`; errors
  keep their HTTP `4xx`/`5xx` status and use `status`, `message`, plus optional validation
  `errors`. Data and errors are not mixed in one payload.

## AI-assisted development

AI coding tools were used to generate initial Express/Prisma boilerplate, suggest the
layered structure, and review tenant-scoped queries and atomic stock updates. The generated
code was checked against the requirements, simplified into the current controller/service/
validation layout, and verified with HTTP integration tests. No generated code is treated as
trusted without tests and manual review.

## Verification

The project has HTTP tests for tenant isolation, API-key mismatch, dynamic schema validation,
duplicate SKUs, multiple warehouses, negative-stock rejection, concurrent withdrawals,
atomic transfer rollback, total stock summaries, and integer limits.
Run `npm test` after configuring the separate `TEST_DATABASE_URL`.
