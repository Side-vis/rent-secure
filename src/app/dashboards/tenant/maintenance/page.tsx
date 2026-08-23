"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TenantTenancy = {
  id: string;
  unit_label: string | null;
  landlord_id: string;
  property_id: string;
  properties: {
    title: string;
  } | null;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  preferred_visit_date: string | null;
  contact_phone: string | null;
  landlord_note: string | null;
  created_at: string;
  properties: {
    title: string;
  } | null;
};

const PRIORITY_OPTIONS: Array<MaintenanceRequest["priority"]> = [
  "low",
  "medium",
  "high",
  "urgent",
];

export default function TenantMaintenancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState("");
  const [tenancies, setTenancies] = useState<TenantTenancy[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  const [tenancyId, setTenancyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<MaintenanceRequest["priority"]>("medium");
  const [preferredVisitDate, setPreferredVisitDate] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const selectedTenancy = useMemo(
    () => tenancies.find((item) => item.id === tenancyId) ?? null,
    [tenancies, tenancyId]
  );

  const openCount = requests.filter((item) => item.status === "open").length;

  const loadData = useCallback(async (userId: string, preferredTenancyId = "") => {
    setLoading(true);

    const [tenanciesRes, requestsRes] = await Promise.all([
      supabase
        .from("tenancies")
        .select("id, unit_label, landlord_id, property_id, properties(title)")
        .eq("tenant_user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_requests")
        .select(
          "id, title, description, priority, status, preferred_visit_date, contact_phone, landlord_note, created_at, properties(title)"
        )
        .eq("tenant_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const activeTenancies = (tenanciesRes.data as TenantTenancy[] | null) ?? [];
    setTenancies(activeTenancies);
    setRequests((requestsRes.data as MaintenanceRequest[] | null) ?? []);

    if (activeTenancies.length > 0) {
      const nextTenancy =
        activeTenancies.find((item) => item.id === preferredTenancyId) ?? activeTenancies[0];
      setTenancyId(nextTenancy.id);
    }

    setLoading(false);
  }, []);

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

      setTenantId(user.id);
      await loadData(user.id);
    };

    init();

    return () => {
      active = false;
    };
  }, [loadData, router]);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    if (!selectedTenancy) {
      setStatusMessage("Select your tenancy before submitting a request.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setStatusMessage("Title and description are required.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("maintenance_requests").insert({
      tenancy_id: selectedTenancy.id,
      tenant_user_id: tenantId,
      landlord_id: selectedTenancy.landlord_id,
      property_id: selectedTenancy.property_id,
      title: title.trim(),
      description: description.trim(),
      priority,
      preferred_visit_date: preferredVisitDate || null,
      contact_phone: contactPhone.trim() || null,
      status: "open",
    });

    if (error) {
      setStatusMessage(error.message || "Failed to submit maintenance request.");
      setSubmitting(false);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setPreferredVisitDate("");
    setContactPhone("");
    setStatusMessage("Maintenance request submitted. Your landlord can now review it.");

    await loadData(tenantId, tenancyId);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading maintenance workspace...
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Maintenance</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Request Maintenance</h1>
        <p className="mt-2 text-sm text-slate-300">
          Report issues, set priority, and track landlord updates in one place.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active tenancies" value={`${tenancies.length}`} />
        <StatCard label="Open requests" value={`${openCount}`} />
        <StatCard
          label="Resolved requests"
          value={`${requests.filter((item) => item.status === "resolved").length}`}
        />
      </div>

      {statusMessage ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form
          onSubmit={submitRequest}
          className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-6"
        >
          <h2 className="text-lg font-semibold text-white">New request</h2>

          <label className="grid gap-2 text-sm text-slate-200">
            Tenancy
            <select
              value={tenancyId}
              onChange={(event) => setTenancyId(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              required
            >
              <option value="" disabled>
                Select tenancy
              </option>
              {tenancies.map((tenancy) => (
                <option key={tenancy.id} value={tenancy.id}>
                  {tenancy.properties?.title || "Rental"}
                  {tenancy.unit_label ? ` - ${tenancy.unit_label}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Issue title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Water heater not working"
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the issue and when it started"
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-200">
              Priority
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as MaintenanceRequest["priority"])
                }
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              >
                {PRIORITY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Preferred visit date
              <input
                type="date"
                value={preferredVisitDate}
                onChange={(event) => setPreferredVisitDate(event.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-slate-200">
            Contact phone (optional)
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="Best phone for technician coordination"
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || tenancies.length === 0}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Submitting..." : "Submit maintenance request"}
          </button>

          {tenancies.length === 0 ? (
            <p className="text-xs text-amber-300">
              You need an active tenancy before requesting maintenance.
            </p>
          ) : null}
        </form>

        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Request history</h2>
          {requests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No maintenance requests submitted yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3 text-sm">
              {requests.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{item.title}</p>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${statusClass(item.status)}`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.properties?.title || "Rental"} - Priority: {item.priority}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                  {item.preferred_visit_date ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Preferred visit: {new Date(item.preferred_visit_date).toLocaleDateString()}
                    </p>
                  ) : null}
                  {item.landlord_note ? (
                    <p className="mt-2 rounded-xl border border-emerald-700/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      Landlord note: {item.landlord_note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
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

function statusClass(status: MaintenanceRequest["status"]) {
  switch (status) {
    case "resolved":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
    case "closed":
      return "border-slate-500/60 bg-slate-700/20 text-slate-200";
    case "in_progress":
      return "border-cyan-500/50 bg-cyan-500/10 text-cyan-100";
    default:
      return "border-amber-500/50 bg-amber-500/10 text-amber-100";
  }
}
