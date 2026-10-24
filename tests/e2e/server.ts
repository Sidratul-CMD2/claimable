/**
 * Starts (or reuses) a production Next.js server for browser tests, pointed at the test
 * database. Requires `bun run build` first. Set E2E_BASE_URL to use a server you started.
 */
import { existsSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3001";
export const SERVER_LOG = join(tmpdir(), "claimable-e2e-server.log");

async function isUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns a function that stops the server if this call started it. */
export async function ensureServer(): Promise<() => void> {
  if (await isUp()) return () => {};
  if (process.env.E2E_BASE_URL) throw new Error(`E2E_BASE_URL ${BASE_URL} is not reachable.`);
  if (!existsSync(".next/BUILD_ID")) throw new Error("No production build found. Run `bun run build` before `bun run test:e2e`.");

  const log = openSync(SERVER_LOG, "w");
  const proc = Bun.spawn(["bun", "node_modules/next/dist/bin/next", "start", "--port", new URL(BASE_URL).port], {
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
    stdout: log,
    stderr: log,
  });
  for (let i = 0; i < 120; i++) {
    if (await isUp()) return () => proc.kill();
    if (proc.exitCode !== null) break;
    await Bun.sleep(500);
  }
  proc.kill();
  throw new Error(`The e2e server did not start. See ${SERVER_LOG}.`);
}
