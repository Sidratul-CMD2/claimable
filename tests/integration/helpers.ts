import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { seedReferenceData } from "@/server/services/reference-data";
import type { Actor } from "@/server/services/audit";
import { createUser } from "@/server/services/users";

/** Empties every application table in the test database and reloads reference data. */
export async function resetDatabase() {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to reset a non-test database.");
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
  await seedReferenceData(db);
}

export async function makeStaff(role: "admin" | "editor" = "admin"): Promise<Actor & { password: string }> {
  const password = "correct-horse-battery-staple";
  const email = `${role}-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const user = await createUser({ id: null, email: "test", type: "system" }, { email, name: `Test ${role}`, role, password });
  return { id: user.id, email: user.email, type: "user", password };
}
