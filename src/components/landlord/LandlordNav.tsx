"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type BadgeKey = "payments" | "maintenance";

const LANDLORD_LINKS: Array<{ href: string; label: string; exact?: boolean; badge?: BadgeKey }> = [
  { href: "/dashboards/landlord", label: "Overview", exact: true },
  { href: "/dashboards/landlord/listings", label: "Listings" },
  { href: "/dashboards/landlord/tenants", label: "Tenants" },
  { href: "/dashboards/landlord/payments", label: "Payments", badge: "payments" },
  { href: "/dashboards/landlord/maintenance", label: "Maintenance", badge: "maintenance" },
];

export default function LandlordNav() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ payments: 0, maintenance: 0 });

  const onOnboarding = pathname.startsWith("/dashboards/landlord/onboarding");

  // Refresh counts on navigation so badges drop after the landlord works through a queue.
  useEffect(() => {
    if (onOnboarding) return;
    let isActive = true;

    const loadBadges = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || !isActive) return;

      const count = { count: "exact" as const, head: true };
      const [payments, maintenance] = await Promise.all([
        supabase.from("rent_payments").select("id", count).eq("landlord_id", userId).eq("status", "submitted"),
        supabase
          .from("maintenance_requests")
          .select("id", count)
          .eq("landlord_id", userId)
          .in("status", ["open", "in_progress"]),
      ]);

      if (!isActive) return;
      setBadges({ payments: payments.count ?? 0, maintenance: maintenance.count ?? 0 });
    };

    loadBadges();
    return () => {
      isActive = false;
    };
  }, [pathname, onOnboarding]);

  // Onboarding is a focused flow; the section menu would only lead away from it.
  if (onOnboarding) return null;

  return (
    <nav
      aria-label="Landlord sections"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-900 bg-slate-900/40 p-1.5"
    >
      {LANDLORD_LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const badge = link.badge ? badges[link.badge] : 0;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-100 text-slate-950"
                : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            {link.label}
            {badge > 0 ? (
              <span
                className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${
                  active ? "bg-slate-950 text-white" : "bg-amber-400 text-slate-950"
                }`}
                aria-label={`${badge} waiting`}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
