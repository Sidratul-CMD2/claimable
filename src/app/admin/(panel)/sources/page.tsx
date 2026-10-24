import { runJobNowAction, updateConnectorAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Checkbox, Field, TextArea, TextInput } from "@/components/admin/fields";
import StatusBadge from "@/components/offers/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { requirePageUser } from "@/server/auth/guard";
import { partnerFeedConfigured } from "@/server/connectors/partner-feed";
import { dashboardSummary, jobsWithTargets, recentJobRuns, recentObservations } from "@/server/services/admin-dashboard";

export const metadata = { title: "Sources & jobs" };

export default async function SourcesPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const [{ connectors }, jobs, runs, observations] = await Promise.all([dashboardSummary(), jobsWithTargets(), recentJobRuns(30), recentObservations(30)]);
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Sources & jobs</h1>
        <p className="text-sm text-muted">
          Connectors only use permitted retrieval: robots.txt is honoured, requests are rate-limited, and login, CAPTCHA or anti-bot controls are never bypassed. Run jobs with{" "}
          <code className="font-mono text-xs">bun run worker</code> (or the cron endpoint).
        </p>
      </header>

      <section aria-labelledby="connectors-heading" className="grid gap-4">
        <h2 id="connectors-heading" className="font-display text-xl font-semibold">
          Connectors
        </h2>
        {connectors.map((c) => (
          <article key={c.key} className="bento-card grid gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{c.name}</h3>
              <StatusBadge label={`Permission: ${c.permissionStatus.replace("_", " ")}`} tone={c.permissionStatus === "approved" ? "positive" : "caution"} size="xs" />
              <StatusBadge label={c.enabled ? "Enabled" : "Paused"} tone={c.enabled ? "positive" : "neutral"} size="xs" />
              {c.key === "partner-json-feed" && !partnerFeedConfigured() ? <StatusBadge label="Credentials not configured" tone="warning" size="xs" /> : null}
            </div>
            <p className="text-sm text-muted">{c.description}</p>
            <dl className="grid gap-1 text-xs text-muted md:grid-cols-2">
              <div>
                <dt className="inline font-medium text-fg">Permission basis: </dt>
                <dd className="inline">{c.permissionBasis}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-fg">Retrieval: </dt>
                <dd className="inline">{c.retrievalMethod}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-fg">Last run: </dt>
                <dd className="inline">{c.lastRunAt ? formatDateTime(c.lastRunAt) : "never"}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-fg">Last success: </dt>
                <dd className="inline">{c.lastSuccessAt ? formatDateTime(c.lastSuccessAt) : "never"}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-fg">Consecutive failures: </dt>
                <dd className={`inline ${c.consecutiveFailures ? "text-negative" : ""}`}>{c.consecutiveFailures}</dd>
              </div>
              {c.lastError ? (
                <div className="md:col-span-2">
                  <dt className="inline font-medium text-fg">Last error: </dt>
                  <dd className="inline text-negative">{c.lastError}</dd>
                </div>
              ) : null}
            </dl>
            {isAdmin ? (
              <details>
                <summary className="cursor-pointer text-sm text-link">Configure</summary>
                <ActionForm action={updateConnectorAction} submitLabel="Save connector" className="mt-3">
                  <input type="hidden" name="key" value={c.key} />
                  <Checkbox name="enabled" scope={c.key} label="Enabled" defaultChecked={c.enabled} hint={c.permissionStatus !== "approved" ? "Requires approved permission first." : undefined} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Run every (minutes)" name="intervalMinutes" scope={c.key}>
                      <TextInput name="intervalMinutes" scope={c.key} type="number" min={5} defaultValue={c.intervalMinutes} />
                    </Field>
                    <Field label="Pause reason" name="pausedReason" scope={c.key}>
                      <TextInput name="pausedReason" scope={c.key} defaultValue={c.pausedReason ?? ""} />
                    </Field>
                  </div>
                  <Field label="Configuration (JSON)" name="config" scope={c.key} hint={c.key === "rss-announcements" ? 'feeds: [{ "url": "https://…/feed.xml", "companySlug": "…" }], keywords, lookbackDays' : undefined}>
                    <TextArea name="config" scope={c.key} rows={8} defaultValue={JSON.stringify(c.config, null, 2)} hint />
                  </Field>
                </ActionForm>
              </details>
            ) : null}
          </article>
        ))}
      </section>

      <section aria-labelledby="jobs-heading" className="grid gap-3">
        <h2 id="jobs-heading" className="font-display text-xl font-semibold">
          Scheduled jobs ({jobs.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface text-xs text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Every</th>
                <th className="px-3 py-2 font-medium">Next run</th>
                <th className="px-3 py-2 font-medium">Last success</th>
                <th className="px-3 py-2 font-medium">Failures</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((j) => (
                <tr key={j.id} className={j.enabled ? "" : "opacity-60"}>
                  <td className="px-3 py-2">{j.kind.replace(/_/g, " ")}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-muted">{j.targetLabel}</td>
                  <td className="px-3 py-2 text-muted">{j.intervalMinutes >= 60 ? `${Math.round(j.intervalMinutes / 60)} h` : `${j.intervalMinutes} min`}</td>
                  <td className="px-3 py-2 text-muted">{j.enabled ? formatDateTime(j.nextRunAt) : "disabled"}</td>
                  <td className="px-3 py-2 text-muted">{j.lastSuccessAt ? formatDateTime(j.lastSuccessAt) : "never"}</td>
                  <td className={`px-3 py-2 ${j.attempts ? "text-negative" : ""}`} title={j.lastError ?? undefined}>
                    {j.attempts}
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin && j.enabled ? (
                      <ActionForm action={runJobNowAction} submitLabel="Run now" variant="secondary" inline>
                        <input type="hidden" name="jobId" value={j.id} />
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="runs-heading" className="bento-card p-5">
          <h2 id="runs-heading" className="font-display text-lg font-semibold">
            Recent runs
          </h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className={r.status === "success" ? "text-positive" : r.status === "skipped" ? "text-muted" : "text-negative"}>{r.status}</span> {r.kind.replace(/_/g, " ")}
                  {r.message ? <span className="block max-w-md truncate text-xs text-muted">{r.message}</span> : null}
                </span>
                <span className="text-xs text-subtle">{formatDateTime(r.startedAt)}</span>
              </li>
            ))}
            {runs.length === 0 ? <li className="text-muted">No runs yet. Start the worker.</li> : null}
          </ul>
        </section>
        <section aria-labelledby="obs-heading" className="bento-card p-5">
          <h2 id="obs-heading" className="font-display text-lg font-semibold">
            Recent observations
          </h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {observations.map(({ obs, url, offerTitle }) => (
              <li key={obs.id}>
                <span className={["ok", "changed"].includes(obs.outcome) ? "text-positive" : "text-warning"}>{obs.outcome}</span>
                {obs.httpStatus ? ` ${obs.httpStatus}` : ""} · <span className="text-muted">{offerTitle ?? url}</span>
                <span className="block text-xs text-subtle">
                  {formatDateTime(obs.observedAt)}
                  {obs.errorMessage ? ` · ${obs.errorMessage}` : ""}
                </span>
              </li>
            ))}
            {observations.length === 0 ? <li className="text-muted">No observations yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
