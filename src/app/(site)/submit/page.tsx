import type { Metadata } from "next";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "Submit a deal",
  description: "Tell us about a software deal we're missing. Every submission is verified before it is published.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 md:px-6 md:pt-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Submit a deal</h1>
      <p className="mt-2 text-muted">
        Know a software offer we&apos;re missing? Submissions go to a review queue. We publish an offer only after confirming it with an official source, and we never publish an unverified code as working. No account needed.
      </p>
      <div className="bento-card mt-8 p-5 md:p-6">
        <SubmitForm />
      </div>
    </div>
  );
}
