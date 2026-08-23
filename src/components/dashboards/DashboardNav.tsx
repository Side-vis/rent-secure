"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getDashboardRoute, type Role } from "@/lib/roles";
import { useDashboardTheme } from "@/components/dashboards/DashboardThemeProvider";

type UserProfile = {
  full_name: string | null;
  email: string | null;
  role: Role | null;
};

export default function DashboardNav() {
  const router = useRouter();
  const { theme, toggleTheme } = useDashboardTheme();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    full_name: null,
    email: null,
    role: null,
  });

  const dashboardLabel = useMemo(() => {
    if (!profile.role) {
      return "Dashboard";
    }
    return `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}`;
  }, [profile.role]);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isActive) {
        return;
      }

      const user = data.user;
      if (!user) {
        return;
      }

      const baseProfile: UserProfile = {
        full_name: null,
        email: user.email ?? null,
        role: (user.user_metadata?.role as Role | undefined) ?? null,
      };

      const { data: storedProfile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      setProfile({
        full_name: storedProfile?.full_name ?? baseProfile.full_name,
        email: baseProfile.email,
        role: (storedProfile?.role as Role | null) ?? baseProfile.role,
      });
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <header className="border-b border-slate-900/60 bg-slate-950/90">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            RentSecure
          </p>
          <h1 className="text-lg font-semibold text-slate-100">
            Dashboards
          </h1>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          {profile.role ? (
            <Link
              href={getDashboardRoute(profile.role)}
              className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              {dashboardLabel}
            </Link>
          ) : null}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-3 rounded-full border border-slate-800 px-4 py-2 text-left text-slate-200 transition hover:border-slate-600"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 text-xs font-semibold uppercase text-slate-300">
                {(profile.full_name ?? profile.email ?? "U").slice(0, 2)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">
                  {profile.full_name || profile.email || "Account"}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {profile.role || "Signed in"}
                </p>
              </div>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-3 w-48 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-xl shadow-black/40">
                <Link
                  href="/dashboards/profile"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
