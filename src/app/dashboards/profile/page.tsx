"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { getDashboardRoute, type Role } from "@/lib/roles";

type ProfileData = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  role: Role | null;
  created_at: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isActive) {
        return;
      }

      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: storedProfile } = await supabase
        .from("profiles")
        .select("full_name, email, phone, location, role, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      setProfile({
        full_name: storedProfile?.full_name ?? null,
        email: storedProfile?.email ?? user.email ?? null,
        phone: storedProfile?.phone ?? null,
        location: storedProfile?.location ?? null,
        role: (storedProfile?.role as Role | null) ?? null,
        created_at: storedProfile?.created_at ?? null,
      });
      setLoading(false);
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const dashboardLink = useMemo(() => {
    if (!profile?.role) {
      return null;
    }
    return getDashboardRoute(profile.role);
  }, [profile?.role]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-8 text-center">
        <p className="text-sm text-slate-300">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Profile
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          {profile.full_name || profile.email || "Your profile"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Keep your contact information up to date for smoother onboarding and
          approvals.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Account Details</h3>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Full name
              </dt>
              <dd className="mt-1 text-slate-100">
                {profile.full_name || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Email
              </dt>
              <dd className="mt-1 text-slate-100">
                {profile.email || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Phone
              </dt>
              <dd className="mt-1 text-slate-100">
                {profile.phone || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Location
              </dt>
              <dd className="mt-1 text-slate-100">
                {profile.location || "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h3 className="text-lg font-semibold text-white">Access</h3>
            <dl className="mt-4 grid gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                  Role
                </dt>
                <dd className="mt-1 capitalize text-slate-100">
                  {profile.role || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                  Member since
                </dt>
                <dd className="mt-1 text-slate-100">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "Unknown"}
                </dd>
              </div>
            </dl>
          </div>

          {dashboardLink ? (
            <Link
              href={dashboardLink}
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Back to dashboard
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
