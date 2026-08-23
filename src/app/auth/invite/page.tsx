"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type InviteState = "idle" | "ready" | "checking" | "accepted" | "error";

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [state, setState] = useState<InviteState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeInvite = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setHasSession(false);
      setState("idle");
      setMessage("Sign in with your invited email to continue.");
      return;
    }

    setHasSession(true);
    setState("checking");
    setMessage(null);

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage(payload.error || "Failed to accept invite.");
      return;
    }

    setState("accepted");
    setMessage(payload.message || "Invitation accepted.");
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!token) {
        if (!active) {
          return;
        }
        setState("error");
        setMessage("Invitation token is missing.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        setHasSession(false);
        setState("idle");
        return;
      }

      setHasSession(true);
      setState("ready");
      setMessage("Create your password first, then continue to join this rental.");
    };

    run();

    return () => {
      active = false;
    };
  }, [token]);

  const handleCreatePasswordAndContinue = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setState("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setState("error");
      setMessage("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setState("error");
        setMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      await completeInvite();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueWithoutPasswordChange = async () => {
    setIsSubmitting(true);

    try {
      await completeInvite();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-900 bg-slate-900/40 p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Tenant Invitation
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Join rental</h1>

        {state === "checking" ? (
          <p className="mt-4 text-sm text-slate-300">Finalizing your invite...</p>
        ) : null}

        {state === "ready" && hasSession ? (
          <form onSubmit={handleCreatePasswordAndContinue} className="mt-5 grid gap-4">
            <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Create your password first to secure your tenant account.
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                placeholder="Repeat your password"
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Saving..." : "Create password and continue"}
            </button>

            <button
              type="button"
              onClick={handleContinueWithoutPasswordChange}
              disabled={isSubmitting}
              className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              I already have a password
            </button>
          </form>
        ) : null}

        {state === "accepted" ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {state === "error" ? (
          <div className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {message}
          </div>
        ) : null}

        {!hasSession && token ? (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm text-slate-300">
            Open the invitation email and follow the secure link to create your
            password first. After that, sign in with the same invited email and
            return to this page to complete unit assignment.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500"
          >
            Go to Auth
          </Link>

          {state === "accepted" ? (
            <Link
              href="/dashboards/tenant"
              className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-white"
            >
              Open Tenant Dashboard
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Complete invite first
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
