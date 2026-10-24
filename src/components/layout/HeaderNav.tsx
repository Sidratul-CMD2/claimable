"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import GooeyNav, { type GooeyNavItem } from "@/components/effects/GooeyNav";
import SearchBox from "./SearchBox";
import MobileMenu, { type MobileMenuHandle } from "./MobileMenu";

export const PRIMARY_NAV = [
  { label: "Explore", href: "/deals", match: ["/deals", "/categories"] },
  { label: "Students", href: "/students", match: ["/students"] },
  { label: "Free trials", href: "/free-trials", match: ["/free-trials"] },
  { label: "Lifetime", href: "/lifetime-deals", match: ["/lifetime-deals"] },
  { label: "Calendar", href: "/calendar", match: ["/calendar"] },
  { label: "Companies", href: "/companies", match: ["/companies"] },
];

function activeFor(pathname: string, items: { match?: string[] }[]) {
  return items.findIndex((item) => item.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
}

/** Desktop: full GooeyNav. Tablet/mobile: compact GooeyNav with a "More" menu and a search sheet. */
export default function HeaderNav({ searchDefault }: { searchDefault: string }) {
  const pathname = usePathname();
  const menuRef = useRef<MobileMenuHandle>(null);
  const searchRef = useRef<HTMLDialogElement>(null);

  const desktopIndex = activeFor(pathname, PRIMARY_NAV);
  const compact: (GooeyNavItem & { match?: string[] })[] = [
    { label: "Deals", href: "/deals", match: ["/deals", "/categories", "/coupons", "/free-trials", "/lifetime-deals"] },
    { label: "Students", href: "/students", match: ["/students"] },
    { label: "Calendar", href: "/calendar", match: ["/calendar"] },
    { label: "More", icon: <Menu aria-hidden="true" />, onSelect: () => menuRef.current?.open(), ariaLabel: "More destinations" },
  ];
  const compactIndex = activeFor(pathname, compact);

  return (
    <>
      <div className="hidden lg:block">
        <GooeyNav items={PRIMARY_NAV} activeIndex={desktopIndex} size="sm" ariaLabel="Primary" />
      </div>
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <GooeyNav items={compact} activeIndex={compactIndex} size="sm" ariaLabel="Primary" />
        <button
          type="button"
          onClick={() => searchRef.current?.showModal()}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 md:hidden"
          aria-label="Search deals"
          aria-haspopup="dialog"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
      </div>
      <MobileMenu ref={menuRef} />
      <dialog
        ref={searchRef}
        className="sheet"
        aria-label="Search deals"
        onClick={(e) => e.target === searchRef.current && searchRef.current?.close()}
      >
        <div className="sheet-panel fixed inset-x-0 top-0 border-b border-line bg-raised p-4 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Search</p>
            <button type="button" onClick={() => searchRef.current?.close()} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-3">
              Close
            </button>
          </div>
          <SearchBox defaultValue={searchDefault} autoFocus size="lg" />
        </div>
      </dialog>
    </>
  );
}
