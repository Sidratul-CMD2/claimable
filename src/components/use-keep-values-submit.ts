"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets uncontrolled form fields after a `<form action>` submission completes —
 * even when the action returned validation errors — which would wipe what people typed.
 * Submitting through a transition keeps the values; the `action` attribute stays on the form
 * so it still works without JavaScript.
 */
export function useKeepValuesSubmit(formAction: (fd: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(fd));
  };
}
