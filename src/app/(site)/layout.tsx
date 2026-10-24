import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { resolveCountry, suggestedCountry } from "@/server/request-context";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [country, suggested] = await Promise.all([resolveCountry(), suggestedCountry()]);
  return (
    <>
      <SiteHeader country={country} suggested={suggested} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
