import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

export function createDb(url?: string, authToken?: string) {
  const resolvedUrl = resolveDbUrl(url);
  const client = createClient({
    url: resolvedUrl,
    authToken: authToken ?? process.env.TURSO_AUTH_TOKEN,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

function resolveDbUrl(url?: string): string {
  const candidates = [
    url,
    process.env.TURSO_DATABASE_URL,
    process.env.DATABASE_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  throw new Error(
    "Missing database URL. Set TURSO_DATABASE_URL (preferred) or DATABASE_URL.",
  );
}
