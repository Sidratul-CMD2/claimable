import type { BillingInterval } from "./enums";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats integer minor units. Deterministic locale so server and client output match. */
export function formatMoney(amountMinor: number, currency: string): string {
  const key = currency.toUpperCase();
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: key, currencyDisplay: "narrowSymbol" });
    moneyFormatters.set(key, fmt);
  }
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  const value = amountMinor / 10 ** digits;
  const text = fmt.format(value);
  // Drop ".00" for whole amounts to keep cards compact.
  return Number.isInteger(value) ? text.replace(/\.00$/, "") : text;
}

/** "USD 12" style when the symbol alone is ambiguous ($ for USD/CAD/AUD…). */
export function formatMoneyWithCode(amountMinor: number, currency: string): string {
  const text = formatMoney(amountMinor, currency);
  return /^[A-Z]{3}/.test(text) ? text : `${text} ${currency.toUpperCase()}`;
}

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
  one_time: "one-time",
};

export const INTERVAL_ADJECTIVE: Record<BillingInterval, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Annual",
  one_time: "One-time",
};

const INTERVAL_SHORT: Record<Exclude<BillingInterval, "one_time">, string> = { day: "day", week: "wk", month: "mo", year: "yr" };

export function formatPrice(amountMinor: number, currency: string, interval: BillingInterval | null): string {
  if (amountMinor === 0) return "Free";
  const money = formatMoneyWithCode(amountMinor, currency);
  if (!interval || interval === "one_time") return money;
  return `${money}/${INTERVAL_SHORT[interval]}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return dateFmt.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  return dateTimeFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** "3 days ago" / "in 5 days" with an absolute date available via formatDate. */
export function relativeDays(value: Date | null, now: Date = new Date()): string {
  if (!value) return "";
  const days = Math.round((value.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === -1) return "yesterday";
  if (days === 1) return "tomorrow";
  return days < 0 ? `${-days} days ago` : `in ${days} days`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
