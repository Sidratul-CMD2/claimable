import { desc } from "drizzle-orm";
import { formatDateTime } from "@/lib/format";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePageUser();
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300);
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Audit log</h1>
        <p className="text-sm text-muted">Every administrative change, newest first (latest 300). Secrets are redacted.</p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface text-xs text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-3 py-2">{r.actorEmail}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2 text-muted">
                  {r.entityType} <span className="font-mono text-xs">{r.entityId?.slice(0, 8)}</span>
                </td>
                <td className="px-3 py-2">
                  {r.after ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-link">Details</summary>
                      <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap text-xs text-muted">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
