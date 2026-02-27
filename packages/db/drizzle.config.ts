import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  throw new Error("TURSO_DATABASE_URL is required");
}

const configuredToken = process.env.TURSO_AUTH_TOKEN?.trim();
const isLocalLibsql =
  url.includes("localhost:8080") ||
  url.includes("127.0.0.1:8080") ||
  url.includes("libsql:8080");

// drizzle-kit with dialect "turso" expects a non-empty token value.
// Local libsql does not enforce auth, so use a placeholder when empty.
const authToken =
  configuredToken && configuredToken.length > 0
    ? configuredToken
    : isLocalLibsql
      ? "local-dev-token"
      : undefined;

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "turso",
  dbCredentials: {
    url,
    ...(authToken ? { authToken } : {}),
  },
  tablesFilter: ["!memories_fts*"],
});
