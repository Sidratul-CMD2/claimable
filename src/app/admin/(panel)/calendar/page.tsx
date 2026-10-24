import { asc, desc, eq } from "drizzle-orm";
import { deleteEventAction, saveEventAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/admin/fields";
import StatusBadge from "@/components/offers/StatusBadge";
import { OCCASIONS } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { OCCASION_LABEL } from "@/lib/labels";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { companies, promotionalEvents } from "@/server/db/schema";

export const metadata = { title: "Calendar events" };

export default async function AdminCalendarPage() {
  await requirePageUser();
  const [events, companyRows] = await Promise.all([
    db
      .select({ event: promotionalEvents, company: companies.name })
      .from(promotionalEvents)
      .innerJoin(companies, eq(companies.id, promotionalEvents.companyId))
      .orderBy(desc(promotionalEvents.startsOn))
      .limit(300),
    db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name)),
  ]);
  const companyOptions = companyRows.map((c) => ({ value: c.id, label: c.name }));
  const occasionOptions = OCCASIONS.map((o) => ({ value: o, label: OCCASION_LABEL[o] }));
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Calendar events</h1>
        <p className="text-sm text-muted">
          <strong>Confirmed</strong>: officially announced, upcoming or ongoing. <strong>Historical</strong>: previously observed with a source. Predicted windows are calculated automatically from two or more years
          of historical events and are never entered by hand.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ul className="grid content-start gap-3">
          {events.map(({ event, company }) => (
            <li key={event.id} className="bento-card grid gap-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{event.title}</strong>
                <StatusBadge label={event.kind} tone={event.kind === "confirmed" ? "positive" : "neutral"} size="xs" />
                {!event.isPublished ? <StatusBadge label="Unpublished" tone="caution" size="xs" /> : null}
                {event.isFixture ? <StatusBadge label="Fixture" tone="warning" size="xs" /> : null}
              </div>
              <p className="text-muted">
                {company} · {OCCASION_LABEL[event.occasion]} · {formatDate(event.startsOn)}
                {event.endsOn ? ` – ${formatDate(event.endsOn)}` : ""}
                {event.datesApproximate ? " (approximate)" : ""}
              </p>
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-link">
                {event.sourceUrl}
              </a>
              {event.evidenceNote ? <p className="text-xs text-muted">{event.evidenceNote}</p> : null}
              <details>
                <summary className="cursor-pointer text-xs text-link">Edit</summary>
                <ActionForm action={saveEventAction} submitLabel="Save event" className="mt-2">
                  <input type="hidden" name="id" value={event.id} />
                  <EventFields companyOptions={companyOptions} occasionOptions={occasionOptions} values={event} />
                </ActionForm>
                <ActionForm action={deleteEventAction} submitLabel="Delete" variant="danger" inline confirmMessage="Delete this event?">
                  <input type="hidden" name="id" value={event.id} />
                </ActionForm>
              </details>
            </li>
          ))}
          {events.length === 0 ? <li className="text-sm text-muted">No events yet.</li> : null}
        </ul>
        <section className="bento-card h-fit p-5" aria-labelledby="new-event">
          <h2 id="new-event" className="font-display text-lg font-semibold">
            Add an event
          </h2>
          <ActionForm action={saveEventAction} submitLabel="Add event" resetOnSuccess className="mt-3">
            <EventFields companyOptions={companyOptions} occasionOptions={occasionOptions} />
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

function EventFields({
  companyOptions,
  occasionOptions,
  values,
}: {
  companyOptions: { value: string; label: string }[];
  occasionOptions: { value: string; label: string }[];
  values?: typeof promotionalEvents.$inferSelect;
}) {
  const scope = values?.id ?? "new-event";
  return (
    <>
      <Field scope={scope} label="Company" name="companyId">
        <Select scope={scope} name="companyId" defaultValue={values?.companyId} options={companyOptions} />
      </Field>
      <Field scope={scope} label="Title" name="title">
        <TextInput scope={scope} name="title" defaultValue={values?.title} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field scope={scope} label="Kind" name="kind">
          <Select scope={scope} name="kind" defaultValue={values?.kind ?? "historical"} options={[{ value: "historical", label: "Historical" }, { value: "confirmed", label: "Confirmed upcoming" }]} />
        </Field>
        <Field scope={scope} label="Occasion" name="occasion">
          <Select scope={scope} name="occasion" defaultValue={values?.occasion ?? "black_friday"} options={occasionOptions} />
        </Field>
        <Field scope={scope} label="Starts" name="startsOn">
          <TextInput scope={scope} name="startsOn" type="date" defaultValue={values?.startsOn} required />
        </Field>
        <Field scope={scope} label="Ends" name="endsOn">
          <TextInput scope={scope} name="endsOn" type="date" defaultValue={values?.endsOn ?? ""} />
        </Field>
      </div>
      <Checkbox scope={scope} name="datesApproximate" label="Dates are approximate" defaultChecked={values?.datesApproximate} />
      <Field scope={scope} label="Source URL (official announcement or archived page)" name="sourceUrl">
        <TextInput scope={scope} name="sourceUrl" type="url" defaultValue={values?.sourceUrl} required />
      </Field>
      <Field scope={scope} label="Evidence note" name="evidenceNote">
        <TextArea scope={scope} name="evidenceNote" defaultValue={values?.evidenceNote} rows={2} />
      </Field>
      <Checkbox scope={scope} name="isPublished" label="Show on the public calendar" defaultChecked={values?.isPublished} />
    </>
  );
}
