import { createHash, randomBytes } from "node:crypto";

export function createApiKey() {
  const value = randomBytes(32).toString("base64url");
  return { value, hash: hashApiKey(value) };
}

export function hashApiKey(value) {
  return createHash("sha256").update(value).digest("hex");
}
