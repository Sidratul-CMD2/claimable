import { NextResponse, type NextRequest } from "next/server";
import { suggest } from "@/server/services/search";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const suggestions = await suggest(q);
  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=60" } });
}
