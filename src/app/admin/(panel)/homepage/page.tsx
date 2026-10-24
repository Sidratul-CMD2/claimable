import { asc } from "drizzle-orm";
import { saveHomepageSectionAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Checkbox, TextInput } from "@/components/admin/fields";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { homepageSections } from "@/server/db/schema";

export const metadata = { title: "Homepage sections" };

export default async function HomepageAdmin() {
  await requirePageUser();
  const sections = await db.select().from(homepageSections).orderBy(asc(homepageSections.sortOrder));
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Homepage sections</h1>
        <p className="text-sm text-muted">Order and visibility. A visible section still stays hidden when it has fewer real offers than its minimum — the homepage never pads sections.</p>
      </header>
      <ul className="grid gap-3">
        {sections.map((s) => (
          <li key={s.key} className="bento-card p-4">
            <ActionForm action={saveHomepageSectionAction} submitLabel="Save" inline variant="secondary">
              <input type="hidden" name="key" value={s.key} />
              <div className="grid min-w-[14rem] flex-1 gap-1">
                <span className="text-xs text-subtle">{s.key}</span>
                <TextInput name="title" scope={s.key} aria-label={`Title of ${s.key}`} defaultValue={s.title} />
              </div>
              <label className="grid gap-1 text-xs text-muted">
                Order
                <input name="sortOrder" type="number" defaultValue={s.sortOrder} className="h-10 w-20 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg" />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                Min
                <input name="minItems" type="number" min={1} defaultValue={s.minItems} className="h-10 w-16 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg" />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                Max
                <input name="maxItems" type="number" min={1} max={24} defaultValue={s.maxItems} className="h-10 w-16 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg" />
              </label>
              <div className="pb-2">
                <Checkbox name="isVisible" scope={s.key} label="Visible" defaultChecked={s.isVisible} />
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
