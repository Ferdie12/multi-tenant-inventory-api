function connectionTarget(value, label) {
  if (!value) throw new Error(`${label} is required`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !database) {
    throw new Error(`${label} must include a host and database name`);
  }

  return { database: database.toLowerCase() };
}

export function safeTestDatabaseUrl(environment = process.env) {
  const app = connectionTarget(environment.DATABASE_URL, "DATABASE_URL");
  const test = connectionTarget(environment.TEST_DATABASE_URL, "TEST_DATABASE_URL");

  if (app.database === test.database) {
    throw new Error("Tests require a different PostgreSQL database from DATABASE_URL");
  }
  if (!test.database.includes("test")) {
    throw new Error("TEST_DATABASE_URL database name must contain 'test'");
  }

  return environment.TEST_DATABASE_URL;
}

