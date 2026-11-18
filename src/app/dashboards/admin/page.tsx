"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { firstEmbedded } from "@/lib/supabase/embedded";

type Stat = {
  label: string;
  value: number | null;
  hint: string;
  href?: string;
};

type QueueItem = {
  id: string;
  kind: "landlord" | "listing";
  title: string;
  detail: string;
  createdAt: string;
  href: string;
};

const QUEUE_LIMIT = 6;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Pending landlords", value: null, hint: "Awaiting verification", href: "/dashboards/admin/landlords?status=pending" },
    { label: "Pending listings", value: null, hint: "Awaiting verification", href: "/dashboards/admin/listings-verification" },
    { label: "Active tenancies", value: null, hint: "Across all landlords" },
    { label: "Open maintenance", value: null, hint: "Open or in progress" },
  ]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      const count = { count: "exact" as const, head: true };

      const [
        pendingLandlords,
        pendingListings,
        activeTenancies,
        openMaintenance,
        oldestLandlords,
        oldestListings,
      ] = await Promise.all([
        supabase.from("landlord_profiles").select("user_id", count).eq("verification_status", "pending"),
        supabase.from("properties").select("id", count).eq("status", "pending_verification"),
        supabase.from("tenancies").select("id", count).eq("status", "active"),
        supabase.from("maintenance_requests").select("id", count).in("status", ["open", "in_progress"]),
        supabase
          .from("landlord_profiles")
          .select("user_id, onboarding_step, created_at, profiles(full_name, email)")
          .eq("verification_status", "pending")
          .order("created_at", { ascending: true })
          .limit(QUEUE_LIMIT),
        supabase
          .from("properties")
          .select("id, title, city, created_at")
          .eq("status", "pending_verification")
          .order("created_at", { ascending: true })
          .limit(QUEUE_LIMIT),
      ]);

      if (!isActive) return;

      const results = [pendingLandlords, pendingListings, activeTenancies, openMaintenance, oldestLandlords, oldestListings];
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        console.error("Failed to load admin overview:", failed.error);
        setLoadError("Some figures could not be loaded.");
      }

      setStats((prev) =>
        prev.map((stat, i) => ({ ...stat, value: results[i].error ? null : results[i].count ?? 0 }))
      );

      const landlordItems: QueueItem[] = (oldestLandlords.data ?? []).map((record) => ({
        id: `landlord-${record.user_id}`,
        kind: "landlord",
        title: firstEmbedded(record.profiles)?.full_name || firstEmbedded(record.profiles)?.email || "Unnamed landlord",
        detail: `Landlord verification · onboarding ${record.onboarding_step}/5`,
        createdAt: record.created_at,
        href: `/dashboards/admin/landlords/${record.user_id}`,
      }));

      const listingItems: QueueItem[] = (oldestListings.data ?? []).map((record) => ({
        id: `listing-${record.id}`,
        kind: "listing",
        title: record.title || "Untitled listing",
        detail: `Listing verification${record.city ? ` · ${record.city}` : ""}`,
        createdAt: record.created_at,
        href: "/dashboards/admin/listings-verification",
      }));

      setQueue(
        [...landlordItems, ...listingItems]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, QUEUE_LIMIT)
      );
      setLoading(false);
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-slate-900 bg-gradient-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-8">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Control Center</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Admin Dashboard</h2>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          Verification queues and platform activity at a glance.
        </p>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const body = (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <div className="mt-3 text-3xl font-semibold text-white">
                {item.value === null ? (loading ? "…" : "—") : item.value}
              </div>
              <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
            </>
          );

          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/60"
            >
              {body}
            </Link>
          ) : (
            <div key={item.label} className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Priority Queue</h3>
          <p className="mt-2 text-sm text-slate-300">Oldest items waiting for review.</p>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">Loading queue...</p>
          ) : queue.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
              Nothing waiting for review.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {queue.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 transition hover:border-slate-600"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.detail}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full border border-amber-700/60 px-2.5 py-1 text-xs text-amber-200"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {timeAgo(item.createdAt)} ago
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Coming soon</h3>
          <p className="mt-2 text-sm text-slate-300">Planned admin tools, not yet available.</p>
          <ul className="mt-5 grid gap-2 text-sm text-slate-400">
            {["Disputes", "Support tickets", "Risk & fraud alerts", "Payment monitoring", "Usage analytics"].map(
              (item) => (
                <li key={item} className="rounded-2xl border border-dashed border-slate-800 px-4 py-3">
                  {item}
                </li>
              )
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
