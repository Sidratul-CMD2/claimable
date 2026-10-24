/**
 * Durable job queue on Postgres. Jobs are rows in monitoring_jobs; claiming uses
 * FOR UPDATE SKIP LOCKED so several workers (or a worker plus the cron endpoint) never run
 * the same job twice. A lock older than twice the job timeout is considered abandoned.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { jobRuns, monitoringJobs } from "../db/schema";
import { backoffMinutes } from "../domain/monitoring";

export type JobRow = typeof monitoringJobs.$inferSelect;

export async function claimDueJobs(workerId: string, limit: number, onlyJobId?: string, now: Date = new Date()): Promise<JobRow[]> {
  const at = now.toISOString();
  const rows = await db.execute<Record<string, unknown>>(sql`
    update monitoring_jobs set locked_at = ${at}::timestamptz, locked_by = ${workerId}
    where id in (
      select id from monitoring_jobs
      where enabled = true
        and next_run_at <= ${at}::timestamptz
        and (locked_at is null or locked_at < ${at}::timestamptz - make_interval(secs => timeout_seconds * 2))
        ${onlyJobId ? sql`and id = ${onlyJobId}` : sql``}
      order by next_run_at
      limit ${limit}
      for update skip locked
    )
    returning id
  `);
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r.id));
  return db.select().from(monitoringJobs).where(inArray(monitoringJobs.id, ids));
}

export interface JobOutcome {
  status: "success" | "failure" | "timeout" | "skipped";
  message?: string;
  /** Retry soon with backoff (transient failure). Otherwise wait for the normal interval. */
  retry?: boolean;
  stats?: Record<string, unknown>;
  /** Override the interval for the next run (e.g. soon-expiring offers). */
  nextIntervalMinutes?: number;
}

export async function finishJob(job: JobRow, startedAt: Date, outcome: JobOutcome, now: Date = new Date()) {
  const failed = outcome.status === "failure" || outcome.status === "timeout";
  const attempts = failed ? job.attempts + 1 : 0;
  const interval = outcome.nextIntervalMinutes ?? job.intervalMinutes;
  const delayMinutes = failed && outcome.retry && attempts < job.maxAttempts ? backoffMinutes(attempts) : interval;
  await db.transaction(async (tx) => {
    await tx.insert(jobRuns).values({
      jobId: job.id,
      kind: job.kind,
      targetId: job.targetId,
      startedAt,
      finishedAt: now,
      status: outcome.status,
      attempt: failed ? attempts : 1,
      message: (outcome.message ?? "").slice(0, 1000),
      stats: outcome.stats ?? null,
    });
    await tx
      .update(monitoringJobs)
      .set({
        lockedAt: null,
        lockedBy: null,
        attempts,
        intervalMinutes: interval,
        nextRunAt: new Date(now.getTime() + delayMinutes * 60_000),
        lastRunAt: startedAt,
        lastSuccessAt: failed ? job.lastSuccessAt : now,
        lastError: failed ? (outcome.message ?? "failed").slice(0, 500) : null,
        updatedAt: now,
      })
      .where(eq(monitoringJobs.id, job.id));
  });
}
