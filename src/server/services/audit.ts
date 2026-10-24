import type { DbOrTx } from "../db";
import { auditLogs, offerRevisions } from "../db/schema";

export interface Actor {
  id: string | null;
  email: string;
  /** user | system | connector */
  type?: "user" | "system" | "connector";
  label?: string;
}

export const SYSTEM_ACTOR: Actor = { id: null, email: "system", type: "system", label: "Scheduled job" };

export async function writeAudit(
  tx: DbOrTx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  await tx.insert(auditLogs).values({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    entityType,
    entityId,
    before: before === undefined ? null : sanitize(before),
    after: after === undefined ? null : sanitize(after),
  });
}

/** Never persist secrets in audit payloads. */
function sanitize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (/password|token|secret/i.test(key) ? "[redacted]" : v)),
  );
}

const PRICE_FIELDS = new Set([
  "currency",
  "promoPriceMinor",
  "promoInterval",
  "promoDurationMonths",
  "upfrontPaymentMinor",
  "renewalPriceMinor",
  "renewalInterval",
  "autoRenews",
  "advertisedDiscountPercent",
  "trialDays",
  "creditAmountMinor",
]);
const ELIGIBILITY_FIELDS = new Set(["customerEligibility", "studentRequired", "defaultCountryStatus", "countryRules", "conditions", "studentRequirements"]);
const STATUS_FIELDS = new Set(["availability", "publicationStatus", "verificationState"]);
const IGNORED = new Set(["updatedAt", "createdAt", "searchText", "dedupeKey", "updatedBy", "createdBy", "id"]);

export type Changes = Record<string, { from: unknown; to: unknown }>;

export function diffRecords(before: Record<string, unknown>, after: Record<string, unknown>): Changes {
  const changes: Changes = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (IGNORED.has(key)) continue;
    const a = normalize(before[key]);
    const b = normalize(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { from: a, to: b };
  }
  return changes;
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v;
}

export function classifyChanges(changes: Changes): string {
  const keys = Object.keys(changes);
  if (keys.some((k) => STATUS_FIELDS.has(k))) return "status_changed";
  if (keys.some((k) => PRICE_FIELDS.has(k))) return "price_changed";
  if (keys.some((k) => ELIGIBILITY_FIELDS.has(k))) return "eligibility_changed";
  if (keys.includes("redemptionUrl")) return "redemption_changed";
  if (keys.some((k) => k === "endsAt" || k === "startsAt" || k === "endsAtConfirmed")) return "dates_changed";
  return "updated";
}

export async function writeRevision(
  tx: DbOrTx,
  offerId: string,
  actor: Actor,
  changeType: string,
  changes: Changes,
  note = "",
) {
  await tx.insert(offerRevisions).values({
    offerId,
    actorType: actor.type ?? "user",
    actorUserId: actor.id,
    actorLabel: actor.label ?? actor.email,
    changeType,
    changes,
    note,
  });
}
