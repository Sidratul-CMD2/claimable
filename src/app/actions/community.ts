"use server";

import { headers } from "next/headers";
import { anonymousFingerprint, clientIp } from "@/server/security/rate-limit";
import { submitDeal, submitReport, type CommunityResult } from "@/server/services/community";

export type FormState = (CommunityResult & { fieldErrors?: Record<string, string> }) | null;

async function fingerprint() {
  const h = await headers();
  return anonymousFingerprint(clientIp(h), h.get("user-agent"));
}

export async function reportProblemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitReport(Object.fromEntries(formData), await fingerprint());
}

export async function submitDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitDeal(Object.fromEntries(formData), await fingerprint());
}
