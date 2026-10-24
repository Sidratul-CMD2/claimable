"use client";

import { Building2, LayoutGrid, Search, Tag } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  type: "company" | "offer" | "category";
  label: string;
  detail: string;
  href: string;
}

const ICONS = { company: Building2, offer: Tag, category: LayoutGrid };

/**
 * Search input with autocomplete (ARIA combobox). Submitting goes to /deals?q=… and works
 * without JavaScript because it is a plain GET form.
 */
export default function SearchBox({
  defaultValue = "",
  size = "md",
  placeholder = "Search software, companies or deals",
  autoFocus = false,
  className = "",
  label = "Search deals",
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  label?: string;
}) {
  // Show the query being viewed (e.g. /deals?q=figma) when no explicit default is given.
  const urlQuery = useSearchParams().get("q") ?? "";
  const initial = defaultValue || urlQuery;
  const [value, setValue] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const listId = useId();
  const inputId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setValue(initial), [initial]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setItems(data.suggestions);
          setActive(-1);
        }
      } catch {
        /* aborted or offline: keep plain search working */
      }
    }, 160);
    return () => clearTimeout(timer);
  }, [value]);

  const expanded = open && items.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!expanded) {
      if (e.key === "ArrowDown" && items.length) {
        setOpen(true);
        setActive(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      setOpen(false);
      router.push(items[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const height = size === "lg" ? "h-14 text-base pl-12" : "h-10 text-sm pl-10";

  return (
    <form action="/deals" method="get" role="search" className={`relative ${className}`} onSubmit={() => setOpen(false)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle ${size === "lg" ? "left-4 size-5" : "left-3.5 size-4"}`}
        aria-hidden="true"
      />
      <input
        id={inputId}
        name="q"
        type="search"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={100}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        className={`w-full rounded-full border border-line bg-surface-2 pr-24 text-fg placeholder:text-subtle hover:border-line-strong ${height}`}
      />
      <button
        type="submit"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-fg font-medium text-[var(--ink-on-light)] hover:bg-white ${size === "lg" ? "h-11 px-5 text-sm" : "h-7 px-3 text-xs"}`}
      >
        Search
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-raised p-1.5 shadow-2xl shadow-black/60"
      >
        {items.map((item, i) => {
          const Icon = ICONS[item.type];
          return (
            <li
              key={`${item.type}-${item.href}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(item.href);
                setOpen(false);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${i === active ? "bg-surface-3" : ""}`}
            >
              <Icon className="size-4 shrink-0 text-subtle" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fg">{item.label}</span>
                <span className="block truncate text-xs text-muted">{item.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
