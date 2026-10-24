import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { jobRuns } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/** Liveness + basic job health (no sensitive data). */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const [lastRun] = await db.select({ startedAt: jobRuns.startedAt, status: jobRuns.status }).from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(1);
    return NextResponse.json({ ok: true, database: "up", lastJobRunAt: lastRun?.startedAt ?? null, lastJobStatus: lastRun?.status ?? null });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503 });
  }
}
