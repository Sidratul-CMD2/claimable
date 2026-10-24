import Link from "next/link";
import StatusBadge from "@/components/offers/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requirePageUser } from "@/server/auth/guard";
import { dashboardSummary } from "@/server/services/admin-dashboard";

export const metadata = { title: "Overview" };

function Stat({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "warning" | "negative" }) {
  const body = (
    <div className="bento-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === "warning" && value ? "text-warning" : tone === "negative" && value ? "text-negative" : ""}`}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requirePageUser();
  const { denied } = await searchParams;
  const d = await dashboardSummary();
  const openReview = Object.values(d.reviewCounts).reduce((a, b) => a + b, 0);
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Overview</h1>
        <p className="text-sm text-muted">Fixture data is excluded from these counts.</p>
        {denied ? (
          <p className="mt-3 rounded-lg bg-[var(--negative-bg)] px-3 py-2 text-sm text-negative" role="alert">
            That page requires the administrator role.
          </p>
        ) : null}
      </header>

      <section aria-labelledby="content-health" className="grid gap-3">
        <h2 id="content-health" className="text-sm font-semibold uppercase tracking-wider text-subtle">
          Content health
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Published" value={d.statusCounts.published ?? 0} href="/admin/offers?status=published" />
          <Stat label="Pending review" value={d.statusCounts.pending_review ?? 0} href="/admin/offers?status=pending_review" />
          <Stat label="Drafts" value={d.statusCounts.draft ?? 0} href="/admin/offers?status=draft" />
          <Stat label="Verification stale" value={d.stale.length} tone="warning" href="/admin/offers?status=published&freshness=stale" />
          <Stat label="Published but unverified" value={d.unverified.length} tone="warning" />
          <Stat label="Open review items" value={openReview} tone="negative" href="/admin/review" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bento-card p-5" aria-labelledby="queues">
          <h2 id="queues" className="font-display text-lg font-semibold">
            Review queues
          </h2>
          {openReview ? (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {Object.entries(d.reviewCounts).map(([kind, count]) => (
                <li key={kind} className="flex justify-between">
                  <Link href={`/admin/review?kind=${kind}`} className="text-link capitalize">
                    {kind.replace(/_/g, " ")}
                  </Link>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Nothing waiting for review.</p>
          )}
          <p className="mt-3 text-xs text-subtle">{d.openReports} open visitor reports (grouped into review items).</p>
        </section>

        <section className="bento-card p-5" aria-labelledby="expiring">
          <h2 id="expiring" className="font-display text-lg font-semibold">
            Confirmed to expire in 14 days
          </h2>
          {d.expiring.length ? (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {d.expiring.map((o) => (
                <li key={o.id} className="flex justify-between gap-3">
                  <Link href={`/admin/offers/${o.id}`} className="truncate text-link">
                    {o.title}
                  </Link>
                  <span className="shrink-0 text-muted">{formatDate(o.endsAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No published offers with a confirmed end date in the next 14 days.</p>
          )}
        </section>

        <section className="bento-card p-5" aria-labelledby="stale">
          <h2 id="stale" className="font-display text-lg font-semibold">
            Stale verification
          </h2>
          {d.stale.length ? (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {d.stale.slice(0, 10).map((o) => (
                <li key={o.id} className="flex justify-between gap-3">
                  <Link href={`/admin/offers/${o.id}`} className="truncate text-link">
                    {o.company}: {o.title}
                  </Link>
                  <span className="shrink-0 text-muted">{o.verifiedAt ? formatDate(o.verifiedAt) : "never"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">All published evidence is within its freshness window.</p>
          )}
        </section>

        <section className="bento-card p-5" aria-labelledby="jobs">
          <h2 id="jobs" className="font-display text-lg font-semibold">
            Job health (24 h)
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {["success", "failure", "timeout", "skipped"].map((s) => (
              <StatusBadge key={s} label={`${s}: ${d.runs24h[s] ?? 0}`} tone={s === "success" ? "positive" : s === "skipped" ? "neutral" : (d.runs24h[s] ?? 0) ? "negative" : "neutral"} />
            ))}
          </div>
          {d.failingJobs.length ? (
            <ul className="mt-3 grid gap-1 text-sm">
              {d.failingJobs.map((j) => (
                <li key={j.id}>
                  <span className="font-medium">{j.kind}</span> <span className="text-muted">({j.attempts} consecutive failures)</span>
                  <span className="block truncate text-xs text-negative">{j.lastError}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No jobs are currently failing.</p>
          )}
          <Link href="/admin/sources" className="mt-3 inline-block text-sm text-link">
            Connectors and jobs →
          </Link>
        </section>
      </div>

      <section className="bento-card p-5" aria-labelledby="connectors">
        <h2 id="connectors" className="font-display text-lg font-semibold">
          Source connectors
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr>
                <th className="py-2 pr-4 font-medium">Connector</th>
                <th className="py-2 pr-4 font-medium">Permission</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">Last success</th>
                <th className="py-2 font-medium">Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.connectors.map((c) => (
                <tr key={c.key}>
                  <td className="py-2 pr-4">{c.name}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge label={c.permissionStatus.replace("_", " ")} tone={c.permissionStatus === "approved" ? "positive" : "caution"} size="xs" />
                  </td>
                  <td className="py-2 pr-4">{c.enabled ? "Enabled" : (c.pausedReason ?? "Disabled")}</td>
                  <td className="py-2 pr-4 text-muted">{c.lastSuccessAt ? formatDateTime(c.lastSuccessAt) : "Never"}</td>
                  <td className={`py-2 ${c.consecutiveFailures ? "text-negative" : ""}`}>{c.consecutiveFailures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="audit">
        <h2 id="audit" className="text-sm font-semibold uppercase tracking-wider text-subtle">
          Recent changes
        </h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {d.recentAudit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-2 text-muted">
              <span className="text-fg">{a.action}</span> by {a.actorEmail} · {formatDateTime(a.createdAt)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
