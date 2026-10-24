"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface MobileMenuHandle {
  open: () => void;
}

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "Explore all deals" },
  { href: "/students", label: "Student offers" },
  { href: "/free-trials", label: "Free trials & credits" },
  { href: "/lifetime-deals", label: "Lifetime deals" },
  { href: "/calendar", label: "Deals calendar" },
  { href: "/companies", label: "Companies" },
  { href: "/submit", label: "Submit a deal" },
  { href: "/methodology", label: "How we verify offers" },
];

const MobileMenu = forwardRef<MobileMenuHandle>(function MobileMenu(_, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useImperativeHandle(ref, () => ({ open: () => dialogRef.current?.showModal() }), []);
  const close = () => dialogRef.current?.close();
  return (
    <dialog ref={dialogRef} className="sheet" aria-label="All destinations" onClick={(e) => e.target === dialogRef.current && close()}>
      <nav className="sheet-panel fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-line bg-raised p-4" aria-label="All destinations">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">Menu</p>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-surface-3" aria-label="Close menu">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="grid gap-1">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={close} className="flex min-h-12 items-center rounded-xl px-3 text-base hover:bg-surface-3">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </dialog>
  );
});

export default MobileMenu;
