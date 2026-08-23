"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type LandlordListing = {
  user_id: string;
  email: string;
  full_name: string;
  verification_status: string;
  ownership_type: string;
  onboarding_step: number;
  created_at: string;
};

export default function LandlordsList() {
  const [landlords, setLandlords] = useState<LandlordListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    let isActive = true;

    const loadLandlords = async () => {
      let query = supabase
        .from("landlord_profiles")
        .select(
          `
          user_id,
          verification_status,
          ownership_type,
          onboarding_step,
          created_at,
          profiles(full_name)
        `
        )
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("verification_status", filter);
      }

      const { data, error } = await query;

      if (!isActive) {
        return;
      }

      console.log("Admin landlords query:", { data, error, filter });

      if (error) {
        console.error("Failed to load landlords:", error);
        return;
      }

      // For each landlord, fetch their email from auth
      const formatted = await Promise.all(
        (data || []).map(async (record: any) => {
          // Email will not be directly available through API calls
          // For now, we'll show user_id or fetch through an API route
          return {
            user_id: record.user_id,
            email: "user@example.com", // This will need to be fetched via API route
            full_name: record.profiles?.full_name || "Not set",
            verification_status: record.verification_status,
            ownership_type: record.ownership_type || "Not set",
            onboarding_step: record.onboarding_step,
            created_at: record.created_at,
          };
        })
      );

      setLandlords(formatted);
      setLoading(false);
    };

    loadLandlords();

    return () => {
      isActive = false;
    };
  }, [filter]);

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Landlord Approvals</h2>
          <p className="mt-1 text-sm text-slate-300">
            Review and approve landlord onboarding applications.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              filter === status
                ? "bg-slate-100 text-slate-950"
                : "border border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            {status === "all"
              ? "All"
              : status === "pending"
                ? "Pending"
                : status === "approved"
                  ? "Approved"
                  : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300">
          Loading landlords...
        </div>
      ) : landlords.length === 0 ? (
        <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-300">No landlords to review.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Progress
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {landlords.map((landlord) => (
                <tr
                  key={landlord.user_id}
                  className="border-b border-slate-900/50 bg-slate-950/20 transition hover:bg-slate-950/50"
                >
                  <td className="px-4 py-3 text-slate-100">{landlord.full_name}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{landlord.email}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-slate-300">
                      {landlord.ownership_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                        landlord.verification_status === "approved"
                          ? "bg-emerald-500/20 text-emerald-100"
                          : landlord.verification_status === "pending"
                            ? "bg-amber-500/20 text-amber-100"
                            : "bg-rose-500/20 text-rose-100"
                      }`}
                    >
                      {landlord.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {landlord.onboarding_step}/5
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboards/admin/landlords/${landlord.user_id}`}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:border-slate-500 hover:text-white"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
