import { createDb, DEFAULT_DATABASE_URL, type Db } from "./connection";

export * from "./connection";

declare global {
  var __claimableDb: Db | undefined;
}

/**
 * Shared connection pool, created on first use from DATABASE_URL.
 * Reused across hot reloads in development and across test files.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    globalThis.__claimableDb ??= createDb(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
    const value = Reflect.get(globalThis.__claimableDb, property, receiver);
    return typeof value === "function" ? value.bind(globalThis.__claimableDb) : value;
  },
});

export async function closeDb() {
  if (globalThis.__claimableDb) {
    await globalThis.__claimableDb.$client.end({ timeout: 5 });
    globalThis.__claimableDb = undefined;
  }
}
