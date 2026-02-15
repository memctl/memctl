import { createDb, type Database } from "@memctl/db";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = createDb(
      process.env.TURSO_DATABASE_URL,
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
