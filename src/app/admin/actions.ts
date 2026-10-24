"use server";

/**
 * Admin server actions. Every action authorizes itself with requireRole() — never relying on
 * the page that rendered the form — then validates, calls a service (which audits), and
 * revalidates affected pages.
 */
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { UserRole } from "@/lib/enums";
import { AuthorizationError, requireRole } from "@/server/auth/guard";
import { db } from "@/server/db";
import { connectors, discoveryCandidates, monitoringJobs, promotionalEvents, reviewItems, submissions, userReports } from "@/server/db/schema";
import { toMinorUnits, eventInputSchema } from "@/server/validation/admin";
import { offerFormToInput } from "@/server/validation/offer-form";
import {
  addCoupon,
  attachSource,
  createOffer,
  detachSource,
  parseOrThrow,
  recordVerification,
  removeCoupon,
  setAvailability,
  setPublicationStatus,
  updateCouponStatus,
  updateOffer,
  ValidationFailure,
} from "@/server/services/admin-offers";
import { createCategory, createCompany, createPlan, createProduct, recordListPrice, updateCategory, updateCompany, updateHomepageSection } from "@/server/services/admin-catalog";
import { writeAudit, type Actor } from "@/server/services/audit";
import { createUser, setUserDisabled } from "@/server/services/users";

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  problems?: string[];
  duplicates?: { id: string; slug: string; title: string; exact: boolean }[];
} | null;

async function run(roles: UserRole[], fn: (actor: Actor) => Promise<ActionState | void>, paths: string[] = []): Promise<ActionState> {
  try {
    const user = await requireRole(roles);
    const result = await fn({ id: user.id, email: user.email, type: "user" });
    for (const p of paths) revalidatePath(p);
    return result ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ValidationFailure) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error("[admin action]", error);
    return { ok: false, error: "Unexpected error. Nothing was saved." };
  }
}

const EDITORS: UserRole[] = ["admin", "editor"];
const ADMINS: UserRole[] = ["admin"];
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const checked = (fd: FormData, k: string) => fd.get(k) === "on";

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function saveOfferAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = s(fd, "id");
  let createdId: string | null = null;
  const result = await run(EDITORS, async (actor) => {
    const { input, formErrors } = offerFormToInput(fd);
    if (Object.keys(formErrors).length) throw new ValidationFailure(formErrors);
    if (id) {
      const saved = await updateOffer(actor, id, input);
      return { ok: true, message: "Offer saved.", duplicates: saved.duplicates.filter((d) => d.exact) };
    }
    const created = await createOffer(actor, input);
    createdId = created.id;
  }, ["/admin/offers", "/deals"]);
  if (createdId) redirect(`/admin/offers/${createdId}?created=1`);
  return result;
}

export async function setPublicationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const to = s(fd, "to") as "draft" | "pending_review" | "published" | "archived";
    const res = await setPublicationStatus(actor, s(fd, "offerId"), to, s(fd, "note"));
    if (!res.ok) return { ok: false, error: "Not published — fix these first:", problems: res.problems };
    return { ok: true, message: `Status changed to ${to.replace("_", " ")}.` };
  }, ["/admin/offers", "/deals", "/"]);
}

export async function setAvailabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const availability = s(fd, "availability") as "active" | "expired" | "paused" | "unknown";
    if (!s(fd, "note")) throw new ValidationFailure({ note: ["Explain the change (it is shown in the offer history)."] });
    await setAvailability(actor, s(fd, "offerId"), availability, s(fd, "note"));
    return { ok: true, message: "Availability updated." };
  }, ["/admin/offers", "/deals"]);
}

export async function addCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await addCoupon(actor, { offerId: s(fd, "offerId"), code: s(fd, "code"), status: s(fd, "status") || "unverified", description: s(fd, "description"), sourceUrl: s(fd, "sourceUrl") });
    return { ok: true, message: "Code added." };
  }, ["/admin/offers"]);
}

export async function couponStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const status = s(fd, "status");
    if (status === "remove") await removeCoupon(actor, s(fd, "couponId"));
    else await updateCouponStatus(actor, s(fd, "couponId"), status as never, { testCountry: s(fd, "testCountry") || null, testNote: s(fd, "testNote") || null });
    return { ok: true, message: "Code updated." };
  }, ["/admin/offers"]);
}

export async function attachSourceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await attachSource(actor, {
      offerId: s(fd, "offerId"),
      url: s(fd, "url"),
      sourceType: s(fd, "sourceType"),
      title: s(fd, "title"),
      publisher: s(fd, "publisher"),
      isOfficial: checked(fd, "isOfficial"),
      role: s(fd, "role") || "supporting",
      expectedMarkers: s(fd, "expectedMarkers").split("\n").map((m) => m.trim()).filter(Boolean),
    });
    return { ok: true, message: "Source attached." };
  }, ["/admin/offers"]);
}

export async function detachSourceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await detachSource(actor, s(fd, "offerId"), s(fd, "sourceId"));
    return { ok: true, message: "Source removed." };
  }, ["/admin/offers"]);
}

export async function recordVerificationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await recordVerification(actor, {
      offerId: s(fd, "offerId"),
      couponId: s(fd, "couponId"),
      state: s(fd, "state"),
      method: s(fd, "method"),
      countryCode: s(fd, "countryCode"),
      evidenceUrl: s(fd, "evidenceUrl"),
      note: s(fd, "note"),
      verifiedAt: s(fd, "verifiedAt") || new Date().toISOString(),
    });
    return { ok: true, message: "Verification recorded." };
  }, ["/admin/offers", "/deals"]);
}

// ---------------------------------------------------------------------------
// Companies, products, plans, prices, categories, homepage
// ---------------------------------------------------------------------------

function companyFromForm(fd: FormData) {
  return {
    name: s(fd, "name"),
    slug: s(fd, "slug"),
    websiteUrl: s(fd, "websiteUrl"),
    description: s(fd, "description"),
    allowedDomains: s(fd, "allowedDomains").split(/[\s,]+/).map((d) => d.trim()).filter(Boolean),
    categoryIds: fd.getAll("categoryIds").map(String),
    logoUrl: s(fd, "logoUrl"),
  };
}

export async function saveCompanyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = s(fd, "id");
  let createdId: string | null = null;
  const result = await run(EDITORS, async (actor) => {
    if (id) {
      await updateCompany(actor, id, companyFromForm(fd));
      return { ok: true, message: "Company saved." };
    }
    createdId = (await createCompany(actor, companyFromForm(fd))).id;
  }, ["/admin/companies", "/companies"]);
  if (createdId) redirect(`/admin/companies/${createdId}?created=1`);
  return result;
}

export async function createProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await createProduct(actor, { companyId: s(fd, "companyId"), name: s(fd, "name"), slug: s(fd, "slug"), description: s(fd, "description"), platforms: fd.getAll("platforms").map(String) });
    return { ok: true, message: "Product added." };
  }, ["/admin/companies"]);
}

export async function createPlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await createPlan(actor, { productId: s(fd, "productId"), name: s(fd, "name"), slug: s(fd, "slug"), audience: s(fd, "audience") || "individual", officialPricingUrl: s(fd, "officialPricingUrl"), notes: s(fd, "notes") });
    return { ok: true, message: "Plan added." };
  }, ["/admin/companies"]);
}

export async function recordListPriceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const currency = s(fd, "currency").toUpperCase();
    const amountMinor = toMinorUnits(fd.get("amount"), /^[A-Z]{3}$/.test(currency) ? currency : null);
    if (amountMinor == null || Number.isNaN(amountMinor)) throw new ValidationFailure({ amount: ["Enter the list price, e.g. 12.99"] });
    await recordListPrice(actor, {
      planId: s(fd, "planId"),
      amountMinor,
      currency,
      interval: s(fd, "interval"),
      countryCode: s(fd, "countryCode"),
      observedAt: s(fd, "observedAt") || new Date().toISOString(),
      sourceUrl: s(fd, "sourceUrl"),
      isReliable: checked(fd, "isReliable"),
      note: s(fd, "note"),
    });
    return { ok: true, message: "List price recorded." };
  }, ["/admin/companies", "/deals"]);
}

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const input = { name: s(fd, "name"), slug: s(fd, "slug"), description: s(fd, "description"), sortOrder: s(fd, "sortOrder") || "0", isVisible: checked(fd, "isVisible") };
    if (s(fd, "id")) await updateCategory(actor, s(fd, "id"), input);
    else await createCategory(actor, input);
    return { ok: true, message: "Category saved." };
  }, ["/admin/categories", "/deals", "/"]);
}

export async function saveHomepageSectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    await updateHomepageSection(actor, s(fd, "key"), {
      title: s(fd, "title"),
      isVisible: checked(fd, "isVisible"),
      sortOrder: Number(s(fd, "sortOrder")) || 0,
      maxItems: Number(s(fd, "maxItems")) || 6,
      minItems: Number(s(fd, "minItems")) || 1,
    });
    return { ok: true, message: "Section saved." };
  }, ["/admin/homepage", "/"]);
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export async function resolveReviewItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const id = s(fd, "id");
    const status = s(fd, "status") === "dismissed" ? "dismissed" : "resolved";
    const note = s(fd, "note");
    if (!note) throw new ValidationFailure({ note: ["Add a short resolution note."] });
    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(reviewItems).where(eq(reviewItems.id, id));
      if (!item) throw new ValidationFailure({ form: ["Review item not found."] });
      await tx.update(reviewItems).set({ status, resolvedAt: new Date(), resolvedBy: actor.id, resolutionNote: note, updatedAt: new Date() }).where(eq(reviewItems.id, id));
      // Resolving a reports item settles the underlying open reports with the same outcome.
      if (item.kind === "user_reports" && item.offerId) {
        const reason = (item.payload as { reason?: string } | null)?.reason;
        const reportStatus = s(fd, "reportOutcome") === "valid" ? "resolved_valid" : status === "dismissed" ? "dismissed" : "resolved_invalid";
        await tx
          .update(userReports)
          .set({ status: reportStatus, resolvedAt: new Date(), resolvedBy: actor.id, resolutionNote: note })
          .where(and(eq(userReports.offerId, item.offerId), eq(userReports.status, "open"), reason ? eq(userReports.reason, reason as never) : undefined));
      }
      if (item.kind === "submission") {
        const submissionId = (item.payload as { submissionId?: string } | null)?.submissionId;
        if (submissionId) {
          await tx
            .update(submissions)
            .set({ status: s(fd, "submissionOutcome") === "accepted" ? "accepted" : "rejected", reviewNote: note, reviewedBy: actor.id, reviewedAt: new Date() })
            .where(eq(submissions.id, submissionId));
        }
      }
      if (item.kind === "discovery_candidate") {
        const candidateId = (item.payload as { candidateId?: string } | null)?.candidateId;
        if (candidateId) {
          await tx
            .update(discoveryCandidates)
            .set({ status: s(fd, "candidateOutcome") === "promoted" ? "promoted" : "dismissed", reviewedBy: actor.id, reviewedAt: new Date() })
            .where(eq(discoveryCandidates.id, candidateId));
        }
      }
      await writeAudit(tx, actor, `review.${status}`, "review_item", id, { status: item.status }, { status, note });
    });
    return { ok: true, message: "Review item closed." };
  }, ["/admin/review", "/admin"]);
}

// ---------------------------------------------------------------------------
// Connectors and jobs (admins only)
// ---------------------------------------------------------------------------

export async function updateConnectorAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(ADMINS, async (actor) => {
    const key = s(fd, "key");
    const intervalMinutes = Number(s(fd, "intervalMinutes"));
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 60 * 24 * 30) {
      throw new ValidationFailure({ intervalMinutes: ["Interval must be between 5 minutes and 30 days."] });
    }
    let config: unknown;
    try {
      config = JSON.parse(s(fd, "config") || "{}");
    } catch {
      throw new ValidationFailure({ config: ["Configuration must be valid JSON."] });
    }
    const [before] = await db.select().from(connectors).where(eq(connectors.key, key));
    if (!before) throw new ValidationFailure({ form: ["Connector not found."] });
    const enabled = checked(fd, "enabled");
    if (enabled && before.permissionStatus !== "approved") throw new ValidationFailure({ enabled: ["Only connectors with approved permission can be enabled."] });
    await db.update(connectors).set({ enabled, intervalMinutes, config: config as object, pausedReason: enabled ? null : s(fd, "pausedReason") || "Paused by administrator", updatedAt: new Date() }).where(eq(connectors.key, key));
    await db.update(monitoringJobs).set({ enabled, intervalMinutes, updatedAt: new Date() }).where(eq(monitoringJobs.uniqueKey, `connector:${key}`));
    await writeAudit(db, actor, "connector.update", "connector", key, { enabled: before.enabled, intervalMinutes: before.intervalMinutes, config: before.config }, { enabled, intervalMinutes, config });
    return { ok: true, message: "Connector updated." };
  }, ["/admin/sources"]);
}

export async function runJobNowAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(ADMINS, async (actor) => {
    const id = s(fd, "jobId");
    await db.update(monitoringJobs).set({ nextRunAt: new Date(), updatedAt: new Date() }).where(eq(monitoringJobs.id, id));
    await writeAudit(db, actor, "job.run_now", "monitoring_job", id);
    const { runDueJobs } = await import("@/server/jobs/runner");
    const summary = await runDueJobs({ workerId: `admin:${actor.email}`, limit: 1, onlyJobId: id });
    return { ok: true, message: `Job ran: ${summary.map((r) => `${r.kind} → ${r.status}${r.message ? ` (${r.message})` : ""}`).join("; ") || "nothing due"}` };
  }, ["/admin/sources", "/admin"]);
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function saveEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const input = parseOrThrow(eventInputSchema, {
      companyId: s(fd, "companyId"),
      offerId: s(fd, "offerId"),
      title: s(fd, "title"),
      kind: s(fd, "kind"),
      occasion: s(fd, "occasion"),
      startsOn: s(fd, "startsOn"),
      endsOn: s(fd, "endsOn"),
      datesApproximate: checked(fd, "datesApproximate"),
      sourceUrl: s(fd, "sourceUrl"),
      evidenceNote: s(fd, "evidenceNote"),
      isPublished: checked(fd, "isPublished"),
    });
    const id = s(fd, "id");
    if (id) {
      await db.update(promotionalEvents).set({ ...input, updatedAt: new Date() }).where(eq(promotionalEvents.id, id));
      await writeAudit(db, actor, "event.update", "promotional_event", id, undefined, input);
    } else {
      const [row] = await db.insert(promotionalEvents).values({ ...input, createdBy: actor.id }).returning();
      await writeAudit(db, actor, "event.create", "promotional_event", row.id, undefined, input);
    }
    return { ok: true, message: "Event saved." };
  }, ["/admin/calendar", "/calendar"]);
}

export async function deleteEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(EDITORS, async (actor) => {
    const id = s(fd, "id");
    const [before] = await db.select().from(promotionalEvents).where(eq(promotionalEvents.id, id));
    await db.delete(promotionalEvents).where(eq(promotionalEvents.id, id));
    await writeAudit(db, actor, "event.delete", "promotional_event", id, before, undefined);
    return { ok: true, message: "Event deleted." };
  }, ["/admin/calendar", "/calendar"]);
}

// ---------------------------------------------------------------------------
// Users (admins only)
// ---------------------------------------------------------------------------

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(ADMINS, async (actor) => {
    await createUser(actor, { email: s(fd, "email"), name: s(fd, "name"), role: s(fd, "role"), password: String(fd.get("password") ?? "") });
    return { ok: true, message: "User created. Share the password through a secure channel." };
  }, ["/admin/users"]);
}

export async function setUserDisabledAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(ADMINS, async (actor) => {
    await setUserDisabled(actor, s(fd, "userId"), s(fd, "disabled") === "1");
    return { ok: true, message: "User updated." };
  }, ["/admin/users"]);
}
