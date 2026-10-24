/**
 * Applies SQL migrations from ./drizzle. Usage:
 *   bun run db:migrate                 # DATABASE_URL or the local default
 *   bun run db:migrate -- --test       # TEST_DATABASE_URL or the local test database
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, DEFAULT_DATABASE_URL } from "../src/server/db/connection";
import { testDatabaseUrl } from "./lib/env";

export async function runMigrations(url: string) {
  const db = createDb(url, { max: 1 });
  try {
    // Extensions are created outside drizzle-kit migrations; managed Postgres providers support both.
    await db.$client.unsafe("create extension if not exists pg_trgm");
    await db.$client.unsafe("create extension if not exists unaccent");
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await db.$client.end();
  }
}

if (import.meta.main) {
  const url = process.argv.includes("--test") ? testDatabaseUrl() : (process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  runMigrations(url)
    .then(() => console.log(`[migrate] Up to date: ${url.replace(/\/\/[^@]+@/, "//***@")}`))
    .catch((error) => {
      console.error("[migrate] Failed:", error);
      process.exit(1);
    });
}
