import type { Tone } from "@/lib/labels";

/** Status pill: colour is never the only signal — the text always states the status. */
export default function StatusBadge({
  label,
  tone,
  title,
  size = "sm",
  className = "",
}: {
  label: string;
  tone: Tone;
  title?: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`tone-${tone} inline-flex max-w-full items-center gap-1.5 rounded-full font-medium ${size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${className}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{label}</span>
    </span>
  );
}
