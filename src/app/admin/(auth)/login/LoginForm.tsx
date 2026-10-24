"use client";

import { useActionState } from "react";
import { useKeepValuesSubmit } from "@/components/use-keep-values-submit";
import { loginAction, type LoginState } from "../../auth-actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const submit = useKeepValuesSubmit(action);
  return (
    <form action={action} onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required className="h-11 rounded-lg border border-line bg-surface-2 px-3 font-normal" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="h-11 rounded-lg border border-line bg-surface-2 px-3 font-normal" />
      </label>
      {state?.error ? (
        <p className="text-sm text-negative" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="h-11 rounded-full bg-fg text-sm font-medium text-[var(--ink-on-light)] hover:bg-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
