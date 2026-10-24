"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/actions";
import { useKeepValuesSubmit } from "@/components/use-keep-values-submit";

/** Wraps a server action with pending state, success/error feedback and field-error summaries. */
export default function ActionForm({
  action,
  children,
  submitLabel = "Save",
  variant = "primary",
  className = "",
  resetOnSuccess = false,
  confirmMessage,
  inline = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useKeepValuesSubmit(formAction);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const styles = {
    primary: "bg-fg text-[var(--ink-on-light)] hover:bg-white",
    secondary: "border border-line-strong text-fg hover:bg-surface-3",
    danger: "border border-[var(--negative)]/50 text-negative hover:bg-[var(--negative-bg)]",
  }[variant];
  const errors = Object.entries(state?.fieldErrors ?? {});

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        submit(e);
      }}
      className={inline ? `flex flex-wrap items-end gap-2 ${className}` : `grid gap-3 ${className}`}
    >
      {children}
      <div className={inline ? "" : "flex flex-wrap items-center gap-3"}>
        <button type="submit" disabled={pending} className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium disabled:opacity-60 ${styles}`}>
          {pending ? "Working…" : submitLabel}
        </button>
        {state && !inline ? (
          <span role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-positive" : "text-negative"}`}>
            {state.ok ? (state.message ?? "Saved.") : state.error}
          </span>
        ) : null}
      </div>
      {state && inline ? (
        <span role={state.ok ? "status" : "alert"} className={`basis-full text-xs ${state.ok ? "text-positive" : "text-negative"}`}>
          {state.ok ? (state.message ?? "Saved.") : state.error}
        </span>
      ) : null}
      {state?.problems?.length || errors.length ? (
        <ul className="grid gap-1 rounded-lg bg-[var(--negative-bg)] p-3 text-xs text-negative" role="alert">
          {state?.problems?.map((p) => <li key={p}>{p}</li>)}
          {errors.map(([field, messages]) => (
            <li key={field}>
              <strong>{field}</strong>: {messages?.join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
