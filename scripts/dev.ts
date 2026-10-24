/**
 * One-command local development: embedded PostgreSQL, migrations, the Next.js dev server
 * (http://localhost:3000) and the job worker.
 *   bun run dev
 *   bun run dev -- --no-worker      # skip the background worker
 *
 * Output is prefixed in this terminal and appended to log files OUTSIDE the project
 * (~/Library/Logs/claimable on macOS, or CLAIMABLE_LOG_DIR). Never log into the project
 * folder: Next's file watcher treats each log line as a change and reloads endlessly.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { DEFAULT_DATABASE_URL } from "../src/server/db/connection";
import { testDatabaseUrl } from "./lib/env";
import { runMigrations } from "./migrate";

const LOG_DIR =
  process.env.CLAIMABLE_LOG_DIR ?? (process.platform === "darwin" ? join(homedir(), "Library/Logs/claimable") : join(homedir(), ".local/state/claimable/logs"));
const PG_PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const children: { name: string; proc: Subprocess }[] = [];
let stopping = false;

mkdirSync(LOG_DIR, { recursive: true });

function log(name: string, line: string) {
  // The db and worker scripts already prefix their own lines.
  console.log(line.startsWith(`[${name}]`) ? line : `[${name}] ${line}`);
  appendFileSync(join(LOG_DIR, `${name}.log`), `${new Date().toISOString()} ${line}\n`);
}

async function pipeLines(name: string, stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) log(name, line);
  }
  if (buffer.trim()) log(name, buffer);
}

function start(name: string, cmd: string[], env: Record<string, string> = {}) {
  const proc = Bun.spawn(cmd, { env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  children.push({ name, proc });
  void pipeLines(name, proc.stdout);
  void pipeLines(name, proc.stderr);
  return proc;
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  log("dev", "Stopping…");
  // Reverse order: web and worker first, the database last.
  for (const { proc } of [...children].reverse()) proc.kill("SIGTERM");
  await Promise.race([Promise.all(children.map((c) => c.proc.exited)), Bun.sleep(10_000)]);
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

log("dev", `Logs: ${LOG_DIR}`);

// db-start exits straight away when something already listens on the port.
start("db", ["bun", "scripts/db-start.ts"]);
for (let i = 0; !(await portOpen(PG_PORT)); i++) {
  if (i > 120) {
    log("dev", `PostgreSQL did not come up on port ${PG_PORT}. See ${join(LOG_DIR, "db.log")}.`);
    await shutdown(1);
  }
  await Bun.sleep(500);
}

for (const url of [process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, testDatabaseUrl()]) {
  try {
    await runMigrations(url);
    log("dev", `Migrations up to date: ${url.replace(/\/\/[^@]+@/, "//***@")}`);
  } catch (error) {
    // Postgres can accept connections a moment before databases are created on first run.
    log("dev", `Migration failed (${String(error)}); retrying once…`);
    await Bun.sleep(2000);
    await runMigrations(url);
  }
}

const web = start("web", ["bun", "run", "dev:web"], { NEXT_TELEMETRY_DISABLED: "1" });
if (!process.argv.includes("--no-worker")) start("worker", ["bun", "scripts/worker.ts"]);

const code = await web.exited;
if (!stopping) {
  log("dev", `The Next.js dev server exited (code ${code}).`);
  await shutdown(code ?? 1);
}
