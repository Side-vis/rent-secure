"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LandlordSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "landlord",
          },
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      if (data.session) {
        router.replace("/dashboards/landlord/onboarding");
        return;
      }

      setStatus(
        "Check your email to confirm the account, then sign in to continue onboarding."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-xl shadow-black/30">
      <h2 className="text-2xl font-semibold text-white">Landlord sign-up</h2>
      <p className="mt-2 text-sm text-slate-300">
        Create your account to start the trust-first onboarding flow.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
        <label className="grid gap-2 text-sm text-slate-200">
          Work email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            placeholder="you@company.com"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-200">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            placeholder="At least 8 characters"
          />
        </label>

        {status ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
            {status}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating account..." : "Create landlord account"}
        </button>
      </form>
    </div>
  );
}
