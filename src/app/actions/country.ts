"use server";

import { cookies } from "next/headers";
import { normalizeCountry } from "@/lib/countries";
import { COUNTRY_COOKIE } from "@/lib/site";

/** Remembers the visitor's chosen country (functional cookie; no account needed). */
export async function setCountryAction(code: string | null): Promise<{ ok: boolean }> {
  const store = await cookies();
  const country = normalizeCountry(code);
  if (!country) {
    store.delete(COUNTRY_COOKIE);
    return { ok: true };
  }
  store.set(COUNTRY_COOKIE, country, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
