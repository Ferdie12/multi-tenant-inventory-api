import test from "node:test";
import assert from "node:assert/strict";

import { safeTestDatabaseUrl } from "../src/application/database-url.js";

test("test database guard rejects host aliases with the same database name", () => {
  assert.throws(
    () => safeTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:secret@LOCALHOST:5432/inventory_test?schema=public",
      TEST_DATABASE_URL: "postgres://tester@127.0.0.1/inventory_test?schema=other"
    }),
    /different PostgreSQL database/
  );
});
