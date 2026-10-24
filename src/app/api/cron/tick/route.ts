import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDueJobs } from "@/server/jobs/runner";
import { ensureRecurringJobs } from "@/server/jobs/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** For serverless hosts: a scheduler calls this every 5–15 minutes with the bearer secret. */
async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureRecurringJobs();
  const summary = await runDueJobs({ workerId: "cron", limit: 10, timeBudgetMs: 45_000 });
  return NextResponse.json({ ran: summary.length, summary });
}

export const GET = handle;
export const POST = handle;
