import Link from "next/link";
import { Suspense } from "react";
import WarpText from "@/components/effects/WarpText";
import { countryName } from "@/lib/countries";
import { site } from "@/lib/site";
import CountrySelector from "./CountrySelector";
import HeaderNav from "./HeaderNav";
import SearchBox from "./SearchBox";

/**
 * Header: animated wordmark above a sticky navigation row (GooeyNav + search + country).
 * The wordmark row scrolls away so the sticky row stays compact.
 */
export default function SiteHeader({ country, suggested, searchDefault = "" }: { country: string | null; suggested: string | null; searchDefault?: string }) {
  const names = { countryLabel: country ? countryName(country) : null, suggestedLabel: suggested ? countryName(suggested) : null };
  return (
    <>
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-full bg-fg px-4 py-2 text-sm font-medium text-[var(--ink-on-light)]">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 pt-3 md:px-6 md:pt-4">
        <p className="hidden w-48 text-xs leading-snug text-subtle lg:block">Software deals with the conditions spelled out.</p>
        <Link href="/" aria-label={`${site.name} home`} className="rounded-xl">
          <WarpText
            text={site.name}
            className="h-11 w-[176px] md:h-[60px] md:w-[260px]"
            textClassName="font-display text-[34px] font-extrabold tracking-[-0.055em] text-fg md:text-[46px]"
          />
        </Link>
        <div className="flex w-48 items-center justify-end gap-3">
          <Link href="/submit" className="hidden text-xs text-muted hover:text-fg lg:inline">
            Submit a deal
          </Link>
          <Link href="/methodology" className="hidden text-xs text-muted hover:text-fg lg:inline">
            How we verify
          </Link>
          <div className="lg:hidden">
            <Suspense>
              <CountrySelector country={country} suggested={suggested} {...names} compact />
            </Suspense>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-40 overflow-x-clip border-b border-line/0 py-2.5 backdrop-blur-xl [background:linear-gradient(to_bottom,rgb(9_9_11/0.92),rgb(9_9_11/0.75))]">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 md:px-6">
          <Suspense>
            <HeaderNav searchDefault={searchDefault} />
          </Suspense>
          <div className="ml-auto hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex">
            <Suspense>
              <SearchBox defaultValue={searchDefault} className="w-full max-w-[300px]" />
            </Suspense>
            <div className="hidden lg:block">
              <Suspense>
                <CountrySelector country={country} suggested={suggested} {...names} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
