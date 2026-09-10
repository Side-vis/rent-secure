"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getDashboardRoute, type Role } from "@/lib/roles";

// type Mode = "sign-in" | "sign-up";
//
// const roleLabels: Record<Role, string> = {
//   tenant: "Tenant",
//   landlord: "Landlord",
//   investor: "Investor",
//   admin: "Admin",
// };

export default function AuthForm() {
  // const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // const [role, setRole] = useState<Role>("tenant");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const router = useRouter();

  // const actionLabel = useMemo(() => {
  //   return mode === "sign-in" ? "Sign in" : "Create account";
  // }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      // Sign-up flow is intentionally disabled in the UI for now.
      // Re-enable this branch together with the tab controls below when needed.
      // if (mode === "sign-up") {
      //   const { data, error } = await supabase.auth.signUp({
      //     email,
      //     password,
      //     options: {
      //       data: {
      //         role,
      //       },
      //     },
      //   });
      //
      //   if (error) {
      //     setStatus(error.message);
      //     return;
      //   }
      //
      //   const createdRole = data.user?.user_metadata?.role as Role | undefined;
      //   router.replace(getDashboardRoute(createdRole ?? role));
      //   return;
      // }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const userId = data.user?.id;
      let userRole = data.user?.user_metadata?.role as Role | undefined;

      if (!userRole && userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        userRole = profile?.role as Role | undefined;
      }

      // For landlords, check if onboarding is complete
      if (userRole === "landlord" && userId) {
        const { data: landlordProfile } = await supabase
          .from("landlord_profiles")
          .select("onboarding_step")
          .eq("user_id", userId)
          .maybeSingle();

        if (!landlordProfile || landlordProfile.onboarding_step < 5) {
          router.replace("/dashboards/landlord/onboarding");
          return;
        }
      }

      router.replace(getDashboardRoute(userRole));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setStatus("Enter your email to receive a sign-in link.");
      return;
    }

    setIsSendingMagicLink(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setStatus(payload.error || "Unable to send sign-in link right now.");
        return;
      }

      setStatus(payload.message || "A secure sign-in link has been sent to your email.");
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setStatus("Enter your email to receive a reset link.");
      return;
    }

    setIsSendingReset(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setStatus(payload.error || "Unable to send reset link right now.");
        return;
      }

      setStatus(payload.message || "A password reset link has been sent to your email.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-black/20">
      <div className="flex gap-3">
        {/*
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
            mode === "sign-in"
              ? "bg-slate-100 text-slate-950"
              : "border border-slate-700 text-slate-300"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
            mode === "sign-up"
              ? "bg-slate-100 text-slate-950"
              : "border border-slate-700 text-slate-300"
          }`}
        >
          Sign Up
        </button>
        */}
        <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950">
          Sign In
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
        <label className="grid gap-2 text-sm text-slate-200">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            placeholder="you@rentsecure.com"
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
            placeholder="••••••••"
          />
        </label>

        {/*
        {mode === "sign-up" ? (
          <label className="grid gap-2 text-sm text-slate-200">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            >
              {dashboardRoles.map((value) => (
                <option key={value} value={value}>
                  {roleLabels[value]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        */}

        {status ? (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {status}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {/* {isSubmitting ? "Working..." : actionLabel} */}
          {isSubmitting ? "Working..." : "Sign in"}
        </button>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={isSendingMagicLink}
            className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSendingMagicLink ? "Sending..." : "Email sign-in link"}
          </button>

          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isSendingReset}
            className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSendingReset ? "Sending..." : "Forgot password"}
          </button>
        </div>
      </form>
    </div>
  );
}
