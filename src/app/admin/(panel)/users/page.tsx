import { createUserAction, setUserDisabledAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Field, Select, TextInput } from "@/components/admin/fields";
import { formatDateTime } from "@/lib/format";
import { requirePageUser } from "@/server/auth/guard";
import { listUsers } from "@/server/services/users";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePageUser(["admin"]);
  const users = await listUsers();
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Staff users</h1>
        <p className="text-sm text-muted">Editors manage offers and the review queue. Administrators also manage connectors, jobs and users.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="grid content-start gap-2">
          {users.map((u) => (
            <li key={u.id} className="bento-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {u.name} <span className="text-xs capitalize text-muted">{u.role}</span>
                </p>
                <p className="text-xs text-muted">
                  {u.email} · last sign-in {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never"}
                  {u.disabledAt ? " · disabled" : ""}
                </p>
              </div>
              {u.id !== me.id ? (
                <ActionForm action={setUserDisabledAction} submitLabel={u.disabledAt ? "Enable" : "Disable"} variant={u.disabledAt ? "secondary" : "danger"} inline>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="disabled" value={u.disabledAt ? "0" : "1"} />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
        <section className="bento-card h-fit p-5" aria-labelledby="new-user">
          <h2 id="new-user" className="font-display text-lg font-semibold">
            Add a user
          </h2>
          <ActionForm action={createUserAction} submitLabel="Create user" resetOnSuccess className="mt-3">
            <Field label="Name" name="name">
              <TextInput name="name" required />
            </Field>
            <Field label="Email" name="email">
              <TextInput name="email" type="email" required />
            </Field>
            <Field label="Role" name="role">
              <Select name="role" options={[{ value: "editor", label: "Editor" }, { value: "admin", label: "Administrator" }]} />
            </Field>
            <Field label="Initial password (min. 12 characters)" name="password">
              <TextInput name="password" type="password" required autoComplete="new-password" />
            </Field>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
