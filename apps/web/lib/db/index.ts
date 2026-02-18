import { createDb, type Database } from "@memctl/db";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    const dbUrl =
      process.env.TURSO_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "http://libsql:8080";

    _db = createDb(
      dbUrl,
      process.env.TURSO_AUTH_TOKEN,
    );
  }
  return _db;
}

// Proxy so existing `db.select()` etc. calls keep working
export const db = new Proxy({} as Database, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
