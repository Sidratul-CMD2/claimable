import { ArrowRight, BadgeCheck, CalendarDays, Globe2, Receipt } from "lucide-react";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import Orb from "@/components/effects/Orb";
import SearchBox from "@/components/layout/SearchBox";
import { cardDetailsFor } from "@/components/offers/card-details";
import OfferCard from "@/components/offers/OfferCard";
import { countryName } from "@/lib/countries";
import { formatDate, pluralize } from "@/lib/format";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";
import { resolveCountry } from "@/server/request-context";
import { getHomepage, type HomepageSection } from "@/server/services/homepage";

export default async function HomePage() {
  const country = await resolveCountry();
  const [{ sections, stats }, categoryRows] = await Promise.all([
    getHomepage(country),
    db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.isVisible, true)).orderBy(asc(categories.sortOrder)),
  ]);
  const [featured, ...rest] = sections;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        {/*
          Decorative, never intercepts input; static fallback under reduced motion. backgroundColor = --bg.
          Anchored just right of the text column (which ends at max(696px, 50% + 76px)) so the ring never
          sits behind text: unchanged from 1440px up, cropped at the edge on narrower screens, hidden on phones.
        */}
        <Orb
          className="absolute top-0 -z-10 hidden size-[640px] md:block md:left-[max(700px,calc(50%_+_80px),calc(100%_-_640px))]"
          colors={["#9c43fe", "#4cc2e9", "#101499"]}
          backgroundColor="#09090b"
          opacity={1}
          glow={1.5}
          bleed={1.4}
          highlight={1.6}
          trail={1.2}
          wobble={1}
          hoverIntensity={1.2}
          rotateOnHover
          followCursor
        />
        <div className="mx-auto max-w-[1240px] px-4 pb-14 pt-12 md:px-6 md:pb-20 md:pt-20">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Find better deals on the software you actually use.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Discover software discounts, student offers, promo codes and lifetime deals. Check eligibility, compare real costs, and track upcoming promotions.
            </p>
            <SearchBox size="lg" className="mt-8 max-w-xl" placeholder="Try “Figma”, “student”, or “cloud credits”" label="Search software deals" />
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <Link href="/deals" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 hover:border-line-strong">
                Explore all deals <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              {categoryRows.slice(0, 5).map((c) => (
                <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full bg-surface-2 px-3 py-1.5 text-muted hover:text-fg">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <ul className="mt-12 grid max-w-3xl gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4" aria-label="What every offer shows">
            {[
              { icon: Globe2, text: country ? `Eligibility for ${countryName(country)}` : "Country eligibility, never assumed" },
              { icon: Receipt, text: "Renewal price after the promo" },
              { icon: BadgeCheck, text: "Verification state and date" },
              { icon: CalendarDays, text: "Past and announced promotions" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 rounded-xl border border-line bg-[rgb(9_9_11/0.6)] px-3 py-2.5 backdrop-blur">
                <Icon className="size-4 shrink-0 text-[var(--orb-cyan)]" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          {stats.offers ? (
            <p className="mt-6 text-xs text-subtle">
              {pluralize(stats.offers, "published offer")} from {pluralize(stats.companies, "company", "companies")}
              {stats.lastVerified ? ` · most recent confirmation ${formatDate(stats.lastVerified)}` : ""}. We list fewer offers rather than unverified ones.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1240px] gap-16 px-4 md:px-6">
        {featured ? <SectionBlock section={featured} featured /> : null}
        {rest.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
        {sections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-semibold">We&apos;re still verifying our first offers</h2>
            <p className="mx-auto mt-2 max-w-lg text-muted">Offers appear here only after we&apos;ve confirmed their terms. We don&apos;t fill the page with unverified deals.</p>
            <Link href="/submit" className="mt-6 inline-block rounded-full bg-fg px-4 py-2 text-sm font-medium text-[var(--ink-on-light)]">
              Suggest a deal
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

function SectionHeader({ section }: { section: HomepageSection }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={`section-${section.key}`} className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {section.title}
        </h2>
        {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
      </div>
      {section.kind === "offers" && section.href ? (
        <Link href={section.href} className="inline-flex items-center gap-1 text-sm text-link">
          See all <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : section.kind === "events" ? (
        <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-link">
          Deals calendar <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Column spans (6-column grid) for the featured bento: a 4×2 lead card with two cards beside it,
 * then complete rows (3 cards of 2 columns, or 2 cards of 3) so no row ends in an empty hole.
 */
function featuredSpans(count: number): string[] {
  const spans = ["md:col-span-4 md:row-span-2", "md:col-span-2", "md:col-span-2"].slice(0, count);
  const rest = Math.max(0, count - 3);
  // Rows of three; a leftover of 1 or 2 is laid out as pairs of 3-column cards instead.
  const pairs = rest % 3 === 1 ? (rest >= 4 ? 4 : 0) : rest % 3 === 2 ? 2 : 0;
  for (let i = 0; i < rest; i++) spans.push(i >= rest - pairs ? "md:col-span-3" : rest === 1 ? "md:col-span-6" : "md:col-span-2");
  return spans;
}

/** Bento layout: the first section uses varied spans; other sections use a consistent scan order. */
function SectionBlock({ section, featured = false }: { section: HomepageSection; featured?: boolean }) {
  const headingId = `section-${section.key}`;
  if (section.kind === "events") {
    return (
      <section aria-labelledby={headingId}>
        <SectionHeader section={section} />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {section.items.map((e) => (
            <li key={e.id} className="bento-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-positive">Confirmed</p>
              <p className="mt-1 font-medium">{e.title}</p>
              <p className="text-sm text-muted">
                <Link href={`/companies/${e.companySlug}`} className="hover:underline">
                  {e.company}
                </Link>{" "}
                · {formatDate(e.startsOn)}
                {e.endsOn ? ` – ${formatDate(e.endsOn)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (section.kind === "companies") {
    return (
      <section aria-labelledby={headingId}>
        <SectionHeader section={section} />
        <ul className="flex flex-wrap gap-2">
          {section.items.map((c) => (
            <li key={c.slug}>
              <Link href={`/companies/${c.slug}`} className="inline-block rounded-full border border-line px-4 py-2 text-sm hover:border-line-strong">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  const spans = featured ? featuredSpans(section.items.length) : [];
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader section={section} />
      <ul className={featured ? "grid grid-cols-1 gap-4 md:grid-cols-6" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
        {section.items.map((offer, i) => (
          <li key={offer.id} className={featured ? (spans[i] ?? "md:col-span-2") : ""}>
            <OfferCard
              offer={offer}
              featured={featured && i === 0}
              // DaisyDisk's details fill the tall featured slot of "Recently verified"; other cards and slots are unchanged.
              details={featured && i === 0 && section.key === "recently_verified" ? cardDetailsFor(offer) : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
