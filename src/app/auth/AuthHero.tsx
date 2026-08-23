import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";

export default function AuthHero() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto grid w-full max-w-5xl gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Access RentSecure
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Secure access for every rental role.
          </h1>
          <p className="text-base leading-7 text-slate-300">
            Sign in to review listings, manage tenants, fund rental loans, or
            oversee compliance. Choose a role to tailor the experience.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/auth/landlord"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Landlord sign-up
            </Link>
            <Link
              href="/landing"
              className="rounded-full border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              Back to landing
            </Link>
            <span className="text-xs text-slate-400">
              Start onboarding in a few minutes.
            </span>
          </div>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
