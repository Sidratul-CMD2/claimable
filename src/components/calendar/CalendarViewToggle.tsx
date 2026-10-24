"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import JellyRadio from "@/components/effects/JellyRadio";

/** Month / upcoming / history: one mutually exclusive choice (JellyRadio). */
export default function CalendarViewToggle({ view }: { view: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <JellyRadio
      ariaLabel="Calendar view"
      value={view}
      onChange={(v) => {
        const next = new URLSearchParams(params);
        if (v === "month") next.delete("view");
        else next.set("view", v);
        router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
      }}
      items={[
        { value: "month", label: "Month" },
        { value: "upcoming", label: "Upcoming" },
        { value: "history", label: "History" },
      ]}
    />
  );
}
