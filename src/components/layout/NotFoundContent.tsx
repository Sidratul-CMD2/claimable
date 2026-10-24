import Link from "next/link";

export default function NotFoundContent() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold tracking-tight text-subtle">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The offer may have been removed, or the link may be wrong. Expired offers usually stay available with their history.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/deals" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-[var(--ink-on-light)]">
          Explore deals
        </Link>
        <Link href="/calendar" className="rounded-full border border-line px-4 py-2 text-sm hover:border-line-strong">
          Deals calendar
        </Link>
      </div>
    </div>
  );
}
