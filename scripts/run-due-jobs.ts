/** One-shot: run jobs that are due now and exit (useful for system cron or debugging). */
import { closeDb } from "../src/server/db";
import { runDueJobs } from "../src/server/jobs/runner";
import { ensureRecurringJobs } from "../src/server/jobs/schedule";

await ensureRecurringJobs();
const summary = await runDueJobs({ workerId: `cli:${process.pid}`, limit: Number(process.env.LIMIT ?? 50) });
for (const run of summary) console.log(`${run.kind} → ${run.status}${run.message ? `: ${run.message}` : ""}`);
if (!summary.length) console.log("No jobs due.");
await closeDb();
