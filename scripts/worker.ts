/**
 * Background worker: runs due monitoring jobs every WORKER_INTERVAL_SECONDS (default 30).
 *   bun run worker
 * Safe to run alongside the cron endpoint or other workers (jobs are claimed with SKIP LOCKED).
 */
import { hostname } from "node:os";
import { closeDb } from "../src/server/db";
import { runDueJobs } from "../src/server/jobs/runner";
import { ensureRecurringJobs } from "../src/server/jobs/schedule";

const intervalMs = Number(process.env.WORKER_INTERVAL_SECONDS ?? 30) * 1000;
const workerId = `worker:${hostname()}:${process.pid}`;
let stopping = false;
let running = false;

async function tick() {
  if (running || stopping) return;
  running = true;
  try {
    const summary = await runDueJobs({ workerId, limit: 10 });
    for (const run of summary) console.log(`[worker] ${run.kind} → ${run.status}${run.message ? `: ${run.message}` : ""}`);
  } catch (error) {
    console.error("[worker] tick failed", error);
  } finally {
    running = false;
  }
}

async function main() {
  await ensureRecurringJobs();
  console.log(`[worker] ${workerId} started; polling every ${intervalMs / 1000}s`);
  await tick();
  const timer = setInterval(tick, intervalMs);
  const stop = async () => {
    stopping = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 200));
    await closeDb();
    console.log("[worker] stopped");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});
