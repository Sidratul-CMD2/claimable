import { asc } from "drizzle-orm";
import { saveCategoryAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Checkbox, TextInput } from "@/components/admin/fields";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";

export const metadata = { title: "Categories" };

export default async function CategoriesAdmin() {
  await requirePageUser();
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Categories</h1>
        <p className="text-sm text-muted">Data-driven: pages, navigation and filters read from here. Offer types (student, coupon, trial, lifetime) are cross-category filters, not categories.</p>
      </header>
      <ul className="grid gap-3">
        {rows.map((c) => (
          <li key={c.id} className="bento-card p-4">
            <ActionForm action={saveCategoryAction} submitLabel="Save" inline variant="secondary">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid min-w-[12rem] flex-1 gap-1">
                <TextInput name="name" scope={c.id} aria-label="Name" defaultValue={c.name} />
              </div>
              <div className="grid w-40 gap-1">
                <TextInput name="slug" scope={c.id} aria-label="Slug" defaultValue={c.slug} />
              </div>
              <div className="grid min-w-[16rem] flex-[2] gap-1">
                <TextInput name="description" scope={c.id} aria-label="Description" defaultValue={c.description} />
              </div>
              <input name="sortOrder" type="number" aria-label="Order" defaultValue={c.sortOrder} className="h-10 w-20 rounded-lg border border-line bg-surface-2 px-2 text-sm" />
              <div className="pb-2">
                <Checkbox name="isVisible" scope={c.id} label="Visible" defaultChecked={c.isVisible} />
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>
      <section className="bento-card p-5" aria-labelledby="new-category">
        <h2 id="new-category" className="font-display text-lg font-semibold">
          New category
        </h2>
        <ActionForm action={saveCategoryAction} submitLabel="Create" inline resetOnSuccess className="mt-3">
          <TextInput name="name" scope="new" aria-label="Name" placeholder="Name" />
          <TextInput name="slug" scope="new" aria-label="Slug" placeholder="slug" />
          <TextInput name="description" scope="new" aria-label="Description" placeholder="Description" />
          <input name="sortOrder" type="number" aria-label="Order" defaultValue={200} className="h-10 w-20 rounded-lg border border-line bg-surface-2 px-2 text-sm" />
          <div className="pb-2">
            <Checkbox name="isVisible" scope="new" label="Visible" defaultChecked />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
