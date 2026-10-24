import { GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import DealsExplorer from "@/components/discovery/DealsExplorer";

export const metadata: Metadata = {
  title: "Student software discounts",
  description: "Free and discounted software for students, with the verification provider, eligible institutions and renewal terms for each offer.",
  alternates: { canonical: "/students" },
};

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <DealsExplorer
      path="/students"
      searchParams={await searchParams}
      fixed={{ student: "only" }}
      heading="Student offers"
      intro="Free and discounted software for students and educators. Each offer shows who verifies eligibility, which institutions qualify, and what happens when the student period ends."
      navActive="type:student"
    >
      <ul className="mt-6 grid gap-3 md:grid-cols-3" aria-label="How student offers work">
        <li className="bento-card flex gap-3 p-4 text-sm">
          <GraduationCap className="size-5 shrink-0 text-[var(--orb-cyan)]" aria-hidden="true" />
          <p>
            <strong className="block">The merchant decides eligibility</strong>
            <span className="text-muted">Usually through a school email, university sign-in, or a provider such as SheerID or UNiDAYS.</span>
          </p>
        </li>
        <li className="bento-card flex gap-3 p-4 text-sm">
          <KeyRound className="size-5 shrink-0 text-[var(--orb-cyan)]" aria-hidden="true" />
          <p>
            <strong className="block">We never ask for credentials</strong>
            <span className="text-muted">No university passwords, student IDs or documents. Verification happens on the official site.</span>
          </p>
        </li>
        <li className="bento-card flex gap-3 p-4 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-[var(--orb-cyan)]" aria-hidden="true" />
          <p>
            <strong className="block">Check the renewal</strong>
            <span className="text-muted">Many student plans renew at the normal price or need yearly re-verification. Each offer lists what we found.</span>
          </p>
        </li>
      </ul>
    </DealsExplorer>
  );
}
