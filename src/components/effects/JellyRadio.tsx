"use client";

/**
 * JellyRadio — adapted from the React Bits "JellyRadio" reference (docs/Design Direction.pdf pp. 30–36).
 *
 * Used only for mutually exclusive choices (grid/list view, calendar view). Adaptations: the
 * `motion` spring library is replaced by CSS transforms with a `linear()` spring easing and
 * per-neighbour stagger, keeping the "chosen chip swells, neighbours make room" behaviour;
 * the malformed transform expression in the PDF extraction is not used. Keyboard behaviour
 * (roving tabindex, arrows, Home/End) follows the reference and the ARIA radio pattern.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./JellyRadio.css";

export interface JellyRadioItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export default function JellyRadio({
  items,
  value,
  onChange,
  ariaLabel,
  size = "md",
  swell = 0.12,
  barge = 4,
  shrink = 0.03,
  stagger = 22,
  className = "",
}: {
  items: JellyRadioItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  swell?: number;
  barge?: number;
  shrink?: number;
  stagger?: number;
  className?: string;
}) {
  const at = Math.max(0, items.findIndex((it) => it.value === value));
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>([]);

  useLayoutEffect(() => {
    const measure = () => setWidths(chipRefs.current.map((el) => el?.offsetWidth ?? 0));
    measure();
    const ro = new ResizeObserver(measure);
    chipRefs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [items.length]);

  const push = ((widths[at] ?? 0) * swell) / 2 + barge;

  const commit = (i: number) => {
    if (i === at || !items[i] || items[i].disabled) return;
    onChange(items[i].value);
  };
  const stepFrom = (i: number, dir: number) => {
    const n = items.length;
    let j = i;
    for (let tries = 0; tries < n; tries++) {
      j = (j + dir + n) % n;
      if (!items[j].disabled) return j;
    }
    return i;
  };
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = stepFrom(i, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = stepFrom(i, -1);
    else if (e.key === "Home") next = stepFrom(-1, 1);
    else if (e.key === "End") next = stepFrom(items.length, -1);
    else if (e.key === " " || e.key === "Enter") next = i;
    if (next === null) return;
    e.preventDefault();
    commit(next);
    chipRefs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`jelly-radio jelly-radio--${size} ${className}`}
      style={{ "--jr-pad-x": `${Math.ceil(push) + 2}px` } as React.CSSProperties}
    >
      {items.map((it, i) => {
        const on = i === at;
        const far = Math.abs(i - at);
        const x = Math.sign(i - at) * push;
        const s = on ? 1 + swell : 1 - shrink;
        return (
          <button
            key={it.value}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            className="jelly-radio__chip"
            data-on={on ? "true" : "false"}
            style={{ transform: `translateX(${x}px) scale(${s})`, transitionDelay: `${far * stagger}ms` }}
            onClick={() => commit(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className="jelly-radio__skin">
              {it.icon ? <span className="jelly-radio__icon" aria-hidden="true">{it.icon}</span> : null}
              <span className="jelly-radio__label">{it.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
