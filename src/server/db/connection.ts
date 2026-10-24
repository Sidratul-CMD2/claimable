import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5433/claimable";

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

/** Creates a Drizzle database handle. Scripts and tests call this directly; the app uses `db` from ./client. */
export function createDb(url = DEFAULT_DATABASE_URL, options: { max?: number } = {}): Db {
  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 30,
    onnotice: () => {},
  });
  return drizzle({ client, schema, casing: "snake_case" }) as Db;
}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
