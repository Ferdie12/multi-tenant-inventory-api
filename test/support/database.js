import { prisma } from "../../src/application/database.js";

export async function resetTestDatabase() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to reset data outside NODE_ENV=test");
  }
  await prisma.tenant.deleteMany();
}
