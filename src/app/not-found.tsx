import NotFoundContent from "@/components/layout/NotFoundContent";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { resolveCountry, suggestedCountry } from "@/server/request-context";

/** Unmatched URLs render outside the (site) layout, so this adds the same header and footer. */
export default async function NotFound() {
  const [country, suggested] = await Promise.all([resolveCountry(), suggestedCountry()]);
  return (
    <>
      <SiteHeader country={country} suggested={suggested} />
      <main id="main" className="min-h-[60vh]">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
