"use client";

import { useEffect } from "react";

/** Desktop sidebar: apply filters as soon as a control changes (progressive enhancement). */
export default function FilterAutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    form.querySelectorAll<HTMLElement>(".js-hide-when-auto").forEach((el) => el.classList.add("sr-only"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      clearTimeout(timer);
      // Let people finish typing a price before applying.
      timer = setTimeout(() => form.requestSubmit(), target.type === "number" ? 600 : 0);
    };
    form.addEventListener("change", onChange);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("change", onChange);
    };
  }, [formId]);
  return null;
}
