/** Small, accessible form primitives for the admin dashboard (server- and client-safe). */
import type { ReactNode } from "react";

export type FieldErrors = Record<string, string[] | undefined>;

/**
 * Element id for a field. Pages that render the same form more than once (one per category,
 * per connector, per plan…) pass a `scope` so every label points at its own control.
 */
const fieldId = (name: string, scope?: string) => (scope ? `${scope}-${name}` : name);

const control =
  "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle hover:border-line-strong aria-[invalid=true]:border-[var(--negative)]";

export function Field({
  label,
  name,
  hint,
  errors,
  errorKey,
  children,
  className = "",
  scope,
}: {
  label: string;
  name: string;
  scope?: string;
  hint?: ReactNode;
  errors?: FieldErrors;
  /** Validation key when it differs from the input name (e.g. promoPrice → promoPriceMinor). */
  errorKey?: string;
  children: ReactNode;
  className?: string;
}) {
  const error = errors?.[errorKey ?? name]?.[0];
  const id = fieldId(name, scope);
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint ? <p id={`${id}-hint`} className="text-xs text-subtle">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, errorKey: string, errors?: FieldErrors, hint?: boolean) =>
  [hint ? `${id}-hint` : null, errors?.[errorKey]?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

export function TextInput({
  name,
  defaultValue,
  errors,
  errorKey,
  type = "text",
  required,
  placeholder,
  hint,
  scope,
  ...rest
}: {
  name: string;
  scope?: string;
  defaultValue?: string | number | null;
  errors?: FieldErrors;
  errorKey?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: boolean;
  step?: string;
  min?: number;
  max?: number;
  inputMode?: "numeric" | "decimal" | "email" | "url" | "text";
  autoComplete?: string;
  /** Accessible name for inputs that have no visible <Field> label. */
  "aria-label"?: string;
}) {
  const id = fieldId(name, scope);
  return (
    <input
      id={id}
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      defaultValue={defaultValue ?? ""}
      aria-invalid={errors?.[errorKey ?? name]?.length ? true : undefined}
      aria-describedby={describedBy(id, errorKey ?? name, errors, hint)}
      className={`${control} h-10`}
      {...rest}
    />
  );
}

export function TextArea({
  name,
  defaultValue,
  errors,
  rows = 3,
  placeholder,
  hint,
  scope,
}: {
  name: string;
  defaultValue?: string | null;
  errors?: FieldErrors;
  rows?: number;
  placeholder?: string;
  hint?: boolean;
  scope?: string;
}) {
  const id = fieldId(name, scope);
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue ?? ""}
      aria-invalid={errors?.[name]?.length ? true : undefined}
      aria-describedby={describedBy(id, name, errors, hint)}
      className={`${control} py-2`}
    />
  );
}

export function Select({
  name,
  defaultValue,
  errors,
  options,
  hint,
  required,
  scope,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string | null;
  errors?: FieldErrors;
  options: { value: string; label: string }[];
  hint?: boolean;
  required?: boolean;
  scope?: string;
  "aria-label"?: string;
}) {
  const id = fieldId(name, scope);
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      aria-label={ariaLabel}
      aria-invalid={errors?.[name]?.length ? true : undefined}
      aria-describedby={describedBy(id, name, errors, hint)}
      className={`${control} h-10`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  name,
  value = "on",
  label,
  defaultChecked,
  hint,
  scope,
}: {
  name: string;
  value?: string;
  label: ReactNode;
  defaultChecked?: boolean;
  hint?: ReactNode;
  scope?: string;
}) {
  const id = `${fieldId(name, scope)}-${value}`;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-fg">
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 accent-[var(--orb-cyan)]" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Fieldset({ legend, description, children }: { legend: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="bento-card grid gap-4 p-5">
      <legend className="sr-only">{legend}</legend>
      <div>
        <h2 className="font-display text-lg font-semibold">{legend}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string; error?: string } | null | undefined }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-lg bg-[var(--positive-bg)] px-3 py-2 text-sm text-positive" role="status">
      {state.message ?? "Saved."}
    </p>
  ) : (
    <p className="rounded-lg bg-[var(--negative-bg)] px-3 py-2 text-sm text-negative" role="alert">
      {state.error ?? "Something went wrong."}
    </p>
  );
}

export function SubmitButton({ children, pending, variant = "primary" }: { children: ReactNode; pending?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-fg text-[var(--ink-on-light)] hover:bg-white",
    secondary: "border border-line-strong text-fg hover:bg-surface-3",
    danger: "border border-[var(--negative)]/50 text-negative hover:bg-[var(--negative-bg)]",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium disabled:opacity-60 ${styles}`}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function enumOptions<T extends string>(values: readonly T[], labels?: Partial<Record<T, string>>, empty?: string) {
  const opts = values.map((v) => ({ value: v as string, label: labels?.[v] ?? v.replace(/_/g, " ") }));
  return empty !== undefined ? [{ value: "", label: empty }, ...opts] : opts;
}
