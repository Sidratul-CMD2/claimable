"use client";

/**
 * BranchedMenu — adapted from the React Bits sidebar reference (docs/Design Direction.pdf pp. 23–30;
 * the PDF heading says "undefined", the snippet's component is BranchedMenu).
 *
 * Adaptations: TypeScript; children and leaves are navigation links (the active value comes from
 * the route), so this stays category *navigation*, distinct from the multi-select filters;
 * lucide-react icons instead of @hugeicons; reduced-motion handling kept from the reference CSS.
 */
import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./BranchedMenu.css";

export interface BranchedMenuChild {
  value: string;
  label: string;
  href: string;
  icon?: ReactNode;
  count?: number;
}
export interface BranchedMenuSection {
  label: string;
  value?: string;
  href?: string;
  children?: BranchedMenuChild[];
}

const PAD = 6;
const MARK = 16;

export default function BranchedMenu({
  items,
  active,
  defaultOpen = [0],
  ariaLabel,
  rowHeight = 34,
  indent = 38,
  trunk = 13,
  radius = 10,
  lineWidth = 1.5,
  fontSize = 14,
}: {
  items: BranchedMenuSection[];
  active: string;
  defaultOpen?: number[];
  ariaLabel: string;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
}) {
  const activeSection = items.findIndex((it) => it.children?.some((kid) => kid.value === active));
  const [open, setOpen] = useState(() => new Set(activeSection >= 0 ? [...defaultOpen, activeSection] : defaultOpen));
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const markerShown = activeSection >= 0 && open.has(activeSection);

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight]);

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k: number) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className="branched-menu"
      style={
        {
          "--bm-font": `${fontSize}px`,
          "--bm-row": `${rowHeight}px`,
          "--bm-indent": `${indent}px`,
          "--bm-line-w": lineWidth,
        } as React.CSSProperties
      }
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafActive = !kids && item.value === active;
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0;
        const bodyId = `bm-body-${i}`;
        return (
          <div key={item.label} className="branched-menu__section" data-open={isOpen ? "" : undefined}>
            {kids ? (
              <button
                ref={(el) => {
                  heads.current[i] = el;
                }}
                type="button"
                className="branched-menu__head"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => toggle(i)}
              >
                {item.label}
              </button>
            ) : (
              <Link
                ref={(el) => {
                  heads.current[i] = el;
                }}
                href={item.href ?? "#"}
                className="branched-menu__head"
                aria-current={leafActive ? "page" : undefined}
                data-active={leafActive ? "" : undefined}
              >
                {item.label}
              </Link>
            )}
            {kids ? (
              <div className="branched-menu__body" id={bodyId}>
                <div className="branched-menu__fold">
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                      <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                      {kids.map((kid, k) => (
                        <path key={kid.value} className="branched-menu__base" d={branch(k)} />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={`${kid.value}-reach`}
                          className="branched-menu__reach"
                          d={reach(k)}
                          style={{ strokeDasharray: length(k), strokeDashoffset: kid.value === active ? 0 : length(k) }}
                        />
                      ))}
                    </svg>
                    <ul className="branched-menu__list">
                      {kids.map((kid) => (
                        <li key={kid.value}>
                          <Link
                            href={kid.href}
                            className="branched-menu__item"
                            aria-current={kid.value === active ? "page" : undefined}
                            data-active={kid.value === active ? "" : undefined}
                            tabIndex={isOpen ? 0 : -1}
                          >
                            {kid.icon ? (
                              <span className="branched-menu__icon" aria-hidden="true">
                                {kid.icon}
                              </span>
                            ) : null}
                            <span className="branched-menu__label">{kid.label}</span>
                            {kid.count != null ? <span className="branched-menu__count">{kid.count}</span> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
