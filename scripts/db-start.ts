/**
 * Local development PostgreSQL server.
 *
 * Runs a real PostgreSQL 18 cluster from the `embedded-postgres` binaries so the
 * project works on machines without Docker or a system Postgres install.
 * Production deployments should point DATABASE_URL at a managed PostgreSQL
 * instance instead; this script is never used there.
 */
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DATA_DIR = path.resolve(process.env.LOCAL_PG_DIR ?? ".data/postgres");
const DATABASES = ["claimable", "claimable_test"];

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function main() {
  if (await portInUse(PORT)) {
    console.log(`[db] Something is already listening on 127.0.0.1:${PORT}; assuming the local database is running.`);
    return;
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: "postgres",
    password: "postgres",
    authMethod: "scram-sha-256",
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (message) => {
      if (process.env.LOCAL_PG_VERBOSE) console.log(`[db] ${message}`);
    },
    onError: (error) => console.error(`[db] ${String(error)}`),
  });

  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log(`[db] Initialising cluster in ${DATA_DIR}`);
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  for (const name of DATABASES) {
    const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (exists.rowCount === 0) {
      await client.query(`create database "${name}"`);
      console.log(`[db] Created database ${name}`);
    }
  }
  await client.end();

  console.log(`[db] PostgreSQL ready on postgres://postgres:postgres@127.0.0.1:${PORT}/claimable`);

  const shutdown = async () => {
    console.log("[db] Stopping PostgreSQL…");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the process alive while the cluster runs.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error("[db] Failed to start local PostgreSQL:", error);
  process.exit(1);
});
