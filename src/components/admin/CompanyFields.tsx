import { Checkbox, Field, TextArea, TextInput } from "./fields";

export default function CompanyFields({
  categories,
  values = {},
}: {
  categories: { id: string; name: string }[];
  values?: { name?: string; slug?: string; websiteUrl?: string; description?: string; allowedDomains?: string[]; categoryIds?: string[]; logoUrl?: string | null };
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" name="name">
          <TextInput name="name" defaultValue={values.name} required />
        </Field>
        <Field label="Slug (optional)" name="slug">
          <TextInput name="slug" defaultValue={values.slug} />
        </Field>
        <Field label="Official website" name="websiteUrl">
          <TextInput name="websiteUrl" type="url" defaultValue={values.websiteUrl} required placeholder="https://" />
        </Field>
        <Field label="Approved redirect domains" name="allowedDomains" hint="Claim links may only send visitors to these domains (and their subdomains). Comma separated.">
          <TextInput name="allowedDomains" defaultValue={values.allowedDomains?.join(", ")} required placeholder="example.com" hint />
        </Field>
      </div>
      <Field label="Short description (original wording)" name="description">
        <TextArea name="description" defaultValue={values.description} rows={2} />
      </Field>
      <Field label="Logo URL (only if you have rights to display it)" name="logoUrl" hint="Leave empty to show a monogram.">
        <TextInput name="logoUrl" type="url" defaultValue={values.logoUrl ?? ""} hint />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">Categories (a company can have several)</legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-3">
          {categories.map((c) => (
            <Checkbox key={c.id} name="categoryIds" value={c.id} label={c.name} defaultChecked={values.categoryIds?.includes(c.id)} />
          ))}
        </div>
      </fieldset>
    </>
  );
}
