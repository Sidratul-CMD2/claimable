"use client";

import { Check, ChevronDown, Globe2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { setCountryAction } from "@/app/actions/country";
import { COUNTRIES, countryFlag, countryName } from "@/lib/countries";

export default function CountrySelector({
  country,
  suggested,
  compact = false,
  countryLabel,
  suggestedLabel,
}: {
  country: string | null;
  suggested: string | null;
  compact?: boolean;
  /**
   * Names computed on the server. Intl region names can differ between the server runtime
   * and the browser, so rendering them on both sides risks a hydration mismatch.
   */
  countryLabel?: string | null;
  suggestedLabel?: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // The list is rendered only while open: Intl country names differ between runtimes,
  // so server-rendering them would cause hydration mismatches (and 249 items per instance).
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const listId = useId();
  const titleId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const open = () => {
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const close = () => dialogRef.current?.close();

  const choose = (code: string | null) => {
    startTransition(async () => {
      await setCountryAction(code);
      close();
      // An explicit ?country= in the URL would override the saved choice; drop it.
      if (params.has("country")) {
        const next = new URLSearchParams(params);
        next.delete("country");
        next.delete("page");
        router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
      }
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      choose(results[activeIndex].code);
    }
  };

  const label = country ? (countryLabel ?? countryName(country)) : "Choose country";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg hover:border-line-strong"
        aria-haspopup="dialog"
        aria-label={country ? `Country: ${label}. Change country` : "Choose your country"}
      >
        {country ? <span aria-hidden="true">{countryFlag(country)}</span> : <Globe2 className="size-4 text-muted" aria-hidden="true" />}
        <span className={compact ? "sr-only" : "max-w-[9rem] truncate"}>{label}</span>
        <ChevronDown className="size-3.5 text-subtle" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby={titleId}
        onClose={() => setIsOpen(false)}
        onClick={(e) => e.target === dialogRef.current && close()}
      >
        <div className="sheet-panel fixed inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-raised p-4 sm:bottom-auto sm:top-24 sm:rounded-3xl">
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              Your country
            </h2>
            <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full hover:bg-surface-3" aria-label="Close">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">
            We use it to show whether offers are confirmed for you. A page being reachable from your country does not mean the offer applies there.
          </p>
          {suggested && suggested !== country ? (
            <button
              type="button"
              onClick={() => choose(suggested)}
              className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-sm hover:border-line-strong"
            >
              <span>
                Use <strong>{suggestedLabel ?? countryName(suggested)}</strong>? <span className="text-subtle">(approximate location)</span>
              </span>
              <span aria-hidden="true">{countryFlag(suggested)}</span>
            </button>
          ) : null}
          <label className="relative mt-3 block">
            <span className="sr-only">Search countries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].code}` : undefined}
              placeholder="Search countries"
              className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm placeholder:text-subtle"
            />
          </label>
          <ul id={listId} role="listbox" aria-label="Countries" className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {(isOpen ? results : []).map((c, i) => (
              <li
                key={c.code}
                id={`${listId}-${c.code}`}
                role="option"
                aria-selected={c.code === country}
                onClick={() => choose(c.code)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${i === activeIndex ? "bg-surface-3" : ""}`}
              >
                <span aria-hidden="true">{countryFlag(c.code)}</span>
                <span className="flex-1">{c.name}</span>
                {c.code === country ? <Check className="size-4 text-positive" aria-hidden="true" /> : null}
              </li>
            ))}
            {isOpen && results.length === 0 ? <li className="px-3 py-4 text-sm text-muted">No country matches “{query}”.</li> : null}
          </ul>
          {country ? (
            <button type="button" onClick={() => choose(null)} className="mt-3 text-sm text-link underline-offset-4 hover:underline" disabled={pending}>
              Clear country (show eligibility as unconfirmed)
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
