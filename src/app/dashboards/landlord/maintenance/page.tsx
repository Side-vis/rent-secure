"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type LandlordMaintenanceRequest = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  preferred_visit_date: string | null;
  contact_phone: string | null;
  landlord_note: string | null;
  created_at: string;
  resolved_at: string | null;
  tenant_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
  properties: {
    title: string;
  } | null;
  tenancies: {
    unit_label: string | null;
  } | null;
};

type RawLandlordMaintenanceRequest = Omit<
  LandlordMaintenanceRequest,
  "tenant_profile" | "properties" | "tenancies"
> & {
  tenant_profile:
    | {
        full_name: string | null;
        email: string | null;
      }[]
    | null;
  properties:
    | {
        title: string;
      }[]
    | null;
  tenancies:
    | {
        unit_label: string | null;
      }[]
    | null;
};

function normalizeRequestRow(raw: RawLandlordMaintenanceRequest): LandlordMaintenanceRequest {
  return {
    ...raw,
    tenant_profile: raw.tenant_profile?.[0] ?? null,
    properties: raw.properties?.[0] ?? null,
    tenancies: raw.tenancies?.[0] ?? null,
  };
}

type QueueFilter = "all" | "open" | "in_progress" | "resolved" | "closed";

const STATUS_OPTIONS: Array<LandlordMaintenanceRequest["status"]> = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export default function LandlordMaintenancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [landlordId, setLandlordId] = useState("");
  const [requests, setRequests] = useState<LandlordMaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [statusById, setStatusById] = useState<Record<string, LandlordMaintenanceRequest["status"]>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const loadRequests = async (userId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select(
        "id, title, description, priority, status, preferred_visit_date, contact_phone, landlord_note, created_at, resolved_at, tenant_profile:tenant_user_id(full_name, email), properties(title), tenancies:tenancy_id(unit_label)"
      )
      .eq("landlord_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setStatusMessage(error.message || "Failed to load maintenance queue.");
      setRequests([]);
      setLoading(false);
      return;
    }

    const rows = ((data as RawLandlordMaintenanceRequest[] | null) ?? []).map(
      normalizeRequestRow
    );
    setRequests(rows);
    setStatusById(
      rows.reduce<Record<string, LandlordMaintenanceRequest["status"]>>((acc, row) => {
        acc[row.id] = row.status;
        return acc;
      }, {})
    );
    setNoteById(
      rows.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.landlord_note || "";
        return acc;
      }, {})
    );

    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        router.replace("/auth");
        return;
      }

      setLandlordId(user.id);
      await loadRequests(user.id);
    };

    init();

    return () => {
      active = false;
    };
  }, [router]);

  const visibleRequests = useMemo(() => {
    if (filter === "all") {
      return requests;
    }
    return requests.filter((item) => item.status === filter);
  }, [filter, requests]);

  const saveUpdate = async (requestId: string) => {
    const nextStatus = statusById[requestId];
    if (!nextStatus) {
      return;
    }

    setStatusMessage(null);
    setUpdatingId(requestId);

    const resolvedAt =
      nextStatus === "resolved" || nextStatus === "closed"
        ? new Date().toISOString()
        : null;

    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        status: nextStatus,
        landlord_note: noteById[requestId]?.trim() || null,
        resolved_at: resolvedAt,
      })
      .eq("id", requestId)
      .eq("landlord_id", landlordId);

    if (error) {
      setStatusMessage(error.message || "Failed to update request.");
      setUpdatingId(null);
      return;
    }

    setStatusMessage("Maintenance request updated.");
    await loadRequests(landlordId);
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading maintenance queue...
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Maintenance Queue</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Manage Tenant Requests</h1>
        <p className="mt-2 text-sm text-slate-300">
          Move issues through open, in-progress, resolved, and closed stages.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={`${requests.length}`} />
        <StatCard
          label="Open"
          value={`${requests.filter((item) => item.status === "open").length}`}
        />
        <StatCard
          label="In progress"
          value={`${requests.filter((item) => item.status === "in_progress").length}`}
        />
        <StatCard
          label="Resolved"
          value={`${requests.filter((item) => item.status === "resolved").length}`}
        />
      </div>

      {statusMessage ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["open", "all", "in_progress", "resolved", "closed"] as QueueFilter[]).map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                filter === item
                  ? "border-slate-500 bg-slate-100 text-slate-950"
                  : "border-slate-800 text-slate-300 hover:border-slate-600"
              }`}
            >
              {item.replace("_", " ")}
            </button>
          )
        )}
      </div>

      <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        {visibleRequests.length === 0 ? (
          <p className="text-sm text-slate-400">No requests in this queue.</p>
        ) : (
          <ul className="grid gap-4 text-sm">
            {visibleRequests.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">{item.title}</p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${priorityClass(item.priority)}`}>
                      {item.priority}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${statusClass(item.status)}`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  {item.properties?.title || "Property"}
                  {item.tenancies?.unit_label ? ` - ${item.tenancies.unit_label}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  Tenant: {item.tenant_profile?.full_name || item.tenant_profile?.email || "Unknown"}
                </p>
                <p className="text-sm text-slate-300">{item.description}</p>

                <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <p>
                    Preferred visit: {item.preferred_visit_date ? new Date(item.preferred_visit_date).toLocaleDateString() : "Not specified"}
                  </p>
                  <p>Contact: {item.contact_phone || "Not provided"}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-[0.45fr_1fr_auto] md:items-end">
                  <label className="grid gap-2 text-xs text-slate-300">
                    Update status
                    <select
                      value={statusById[item.id] || item.status}
                      onChange={(event) =>
                        setStatusById((current) => ({
                          ...current,
                          [item.id]: event.target.value as LandlordMaintenanceRequest["status"],
                        }))
                      }
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                    >
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-xs text-slate-300">
                    Landlord note
                    <input
                      value={noteById[item.id] || ""}
                      onChange={(event) =>
                        setNoteById((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder="Technician assigned, waiting parts, etc"
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => saveUpdate(item.id)}
                    disabled={updatingId === item.id}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {updatingId === item.id ? "Saving..." : "Save"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function priorityClass(priority: LandlordMaintenanceRequest["priority"]) {
  switch (priority) {
    case "urgent":
      return "border-rose-500/60 bg-rose-500/10 text-rose-100";
    case "high":
      return "border-amber-500/60 bg-amber-500/10 text-amber-100";
    case "medium":
      return "border-cyan-500/60 bg-cyan-500/10 text-cyan-100";
    default:
      return "border-slate-600/60 bg-slate-700/20 text-slate-200";
  }
}

function statusClass(status: LandlordMaintenanceRequest["status"]) {
  switch (status) {
    case "resolved":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
    case "closed":
      return "border-slate-600/60 bg-slate-700/20 text-slate-200";
    case "in_progress":
      return "border-cyan-500/50 bg-cyan-500/10 text-cyan-100";
    default:
      return "border-amber-500/50 bg-amber-500/10 text-amber-100";
  }
}
