import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<any, typeof schema>;
export { schema };

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export interface DbHandle { db: Db; close: () => Promise<void> }

/**
 * DATABASE_URL set -> real PostgreSQL (Railway). Otherwise embedded Postgres (PGlite):
 * in-memory when `memory` is true (tests), else persisted under .pglite for local development.
 */
export async function openDb(opts: { memory?: boolean } = {}): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url && !opts.memory) {
    const { default: pg } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new pg.Pool({ connectionString: url, ssl: process.env.PGSSL === "disable" || /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = opts.memory ? undefined : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.pglite");
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close() };
}
