export const DEFAULT_TEST_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5433/claimable_test";

export function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

export function assertNotProduction(task: string) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${task} is disabled when NODE_ENV=production.`);
  }
}
