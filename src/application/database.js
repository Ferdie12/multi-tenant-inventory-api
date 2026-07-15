import { PrismaClient } from "@prisma/client";

import { safeTestDatabaseUrl } from "./database-url.js";

function clientOptions() {
  if (process.env.NODE_ENV !== "test") return undefined;
  return { datasources: { db: { url: safeTestDatabaseUrl() } } };
}

export const prisma = new PrismaClient(clientOptions());

