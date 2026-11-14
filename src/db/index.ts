import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Prefer the app-specific URL, then the Supabase/Vercel integration URLs.
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error("A database connection URL is required (DATABASE_URL or POSTGRES_URL).");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
