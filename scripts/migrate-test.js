import { spawnSync } from "node:child_process";

import { safeTestDatabaseUrl } from "../src/application/database-url.js";

const testUrl = safeTestDatabaseUrl();

const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl }
  }
);
process.exit(result.status ?? 1);
