import Link from "next/link";
import LandlordSignupForm from "@/components/landlord/LandlordSignupForm";

export default function LandlordSignupPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto grid w-full max-w-5xl gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Landlord onboarding
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Build trust from the first property.
          </h1>
          <p className="text-base leading-7 text-slate-300">
            Secure your account, verify ownership, and set up payouts so tenants
            feel confident renting with you.
          </p>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              What you will finish
            </p>
            <ul className="mt-3 grid gap-2">
              <li>Profile basics and contact info</li>
              <li>Ownership verification and documents</li>
              <li>Payout setup for rent collection</li>
              <li>Add your first property as a draft</li>
            </ul>
          </div>
          <Link
            href="/auth"
            className="text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
          >
            Already have access? Sign in
          </Link>
        </div>
        <LandlordSignupForm />
      </div>
    </div>
  );
}
