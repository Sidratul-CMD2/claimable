import "server-only";
import { cookies, headers } from "next/headers";
import { normalizeCountry } from "@/lib/countries";
import { COUNTRY_COOKIE } from "@/lib/site";

/** The visitor's chosen country: explicit URL value first, then the saved cookie. Never guessed. */
export async function resolveCountry(fromUrl?: string | null): Promise<string | null> {
  const explicit = normalizeCountry(fromUrl);
  if (explicit) return explicit;
  const store = await cookies();
  return normalizeCountry(store.get(COUNTRY_COOKIE)?.value);
}

/**
 * Approximate location from a hosting provider's geo header, used only to *suggest* a country.
 * Returns null locally (no such header) and whenever the visitor already chose a country.
 */
export async function suggestedCountry(): Promise<string | null> {
  const store = await cookies();
  if (store.get(COUNTRY_COOKIE)) return null;
  const h = await headers();
  return normalizeCountry(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"));
}
