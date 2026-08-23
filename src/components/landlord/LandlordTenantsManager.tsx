"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PropertyOption = {
  id: string;
  title: string;
  address: string | null;
};

type UnitOption = {
  id: string;
  property_id: string;
  unit_number: string;
  is_available: boolean;
};

type InviteItem = {
  id: string;
  property_id: string;
  tenant_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  unit_label: string | null;
  expires_at: string;
  created_at: string;
  properties: {
    title: string;
  } | null;
};

type TenancyItem = {
  id: string;
  property_id: string;
  status: "active" | "ended";
  unit_label: string | null;
  created_at: string;
  start_date: string | null;
  properties: {
    title: string;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  tenant_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type RepairAction = "resend" | "force_relink";
type TenantTab = "invitations" | "manage";
type TenancyStatusFilter = "all" | "active" | "ended";

export default function LandlordTenantsManager() {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [tenancies, setTenancies] = useState<TenancyItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [repairingInviteId, setRepairingInviteId] = useState<string | null>(null);
  const [repairAction, setRepairAction] = useState<RepairAction | null>(null);
  const [updatingTenancyId, setUpdatingTenancyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [unitsTableMissing, setUnitsTableMissing] = useState(false);
  const [activeTab, setActiveTab] = useState<TenantTab>("manage");
  const [searchTerm, setSearchTerm] = useState("");
  const [tenancyStatusFilter, setTenancyStatusFilter] =
    useState<TenancyStatusFilter>("all");
  const [tenancyPropertyFilter, setTenancyPropertyFilter] = useState("all");

  const pendingInvites = useMemo(
    () => invites.filter((item) => item.status === "pending"),
    [invites]
  );

  const activeTenancies = useMemo(
    () => tenancies.filter((item) => item.status === "active"),
    [tenancies]
  );

  const endedTenancies = useMemo(
    () => tenancies.filter((item) => item.status === "ended"),
    [tenancies]
  );

  const likelyExistingTenantEmails = useMemo(() => {
    const emails = new Set<string>();

    invites.forEach((invite) => {
      if (invite.status === "accepted") {
        emails.add(invite.tenant_email.toLowerCase());
      }
    });

    tenancies.forEach((tenancy) => {
      const email = tenancy.tenant_profile?.email;
      if (email) {
        emails.add(email.toLowerCase());
      }
    });

    return emails;
  }, [invites, tenancies]);

  const reservedUnitLabelsForProperty = useMemo(() => {
    const labels = new Set<string>();

    pendingInvites.forEach((invite) => {
      if (invite.property_id !== selectedPropertyId || !invite.unit_label) {
        return;
      }

      labels.add(invite.unit_label.trim().toLowerCase());
    });

    activeTenancies.forEach((tenancy) => {
      if (tenancy.property_id !== selectedPropertyId || !tenancy.unit_label) {
        return;
      }

      labels.add(tenancy.unit_label.trim().toLowerCase());
    });

    return labels;
  }, [activeTenancies, pendingInvites, selectedPropertyId]);

  const availableUnitsForProperty = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.property_id === selectedPropertyId &&
          unit.is_available &&
          !reservedUnitLabelsForProperty.has(unit.unit_number.trim().toLowerCase())
      ),
    [reservedUnitLabelsForProperty, selectedPropertyId, units]
  );

  const filteredTenancies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return tenancies.filter((tenancy) => {
      if (tenancyStatusFilter !== "all" && tenancy.status !== tenancyStatusFilter) {
        return false;
      }

      if (
        tenancyPropertyFilter !== "all" &&
        tenancy.properties?.title !== tenancyPropertyFilter
      ) {
        return false;
      }

      if (!term) {
        return true;
      }

      const searchable = [
        tenancy.tenant_profile?.full_name,
        tenancy.tenant_profile?.email,
        tenancy.properties?.title,
        tenancy.properties?.address,
        tenancy.unit_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [searchTerm, tenancies, tenancyPropertyFilter, tenancyStatusFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: propertiesData },
      { data: unitsData, error: unitsError },
      { data: invitesData },
      { data: tenanciesData },
    ] = await Promise.all([
      supabase
        .from("properties")
        .select("id, title, address")
        .order("created_at", { ascending: false }),
      supabase
        .from("property_units")
        .select("id, property_id, unit_number, is_available")
        .order("unit_number", { ascending: true }),
      supabase
        .from("tenant_invitations")
        .select(
          "id, property_id, tenant_email, status, unit_label, expires_at, created_at, properties(title)"
        )
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("tenancies")
        .select(
          "id, property_id, status, unit_label, created_at, start_date, properties(title, address, city, country), tenant_profile:tenant_user_id(full_name, email)"
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setProperties((propertiesData as PropertyOption[] | null) ?? []);
    setUnits((unitsData as UnitOption[] | null) ?? []);
    setInvites((invitesData as InviteItem[] | null) ?? []);
    setTenancies((tenanciesData as TenancyItem[] | null) ?? []);

    if (unitsError && unitsError.message.toLowerCase().includes("property_units")) {
      setUnitsTableMissing(true);
    } else {
      setUnitsTableMissing(false);
    }

    if (!selectedPropertyId && propertiesData?.length) {
      setSelectedPropertyId(propertiesData[0].id);
    }

    setLoading(false);
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyId) {
      return;
    }

    if (availableUnitsForProperty.length === 0) {
      setUnitLabel("");
      return;
    }

    const selectedStillValid = availableUnitsForProperty.some(
      (unit) => unit.unit_number === unitLabel
    );

    if (!selectedStillValid) {
      setUnitLabel(availableUnitsForProperty[0].unit_number);
    }
  }, [availableUnitsForProperty, selectedPropertyId, unitLabel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatus("Please sign in again and retry.");
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/landlord/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          tenantEmail,
          unitLabel: unitLabel || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const detail = payload.detail ? ` (${payload.detail})` : "";
        setStatus((payload.error || "Failed to create invitation") + detail);
        setSubmitting(false);
        return;
      }

      setStatus(payload.message || "Invitation sent.");
      setTenantEmail("");
      setUnitLabel("");
      await loadData();
    } catch {
      setStatus("Unexpected error while creating invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const repairInvite = async (invitationId: string, action: RepairAction) => {
    setStatus(null);
    setRepairingInviteId(invitationId);
    setRepairAction(action);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatus("Please sign in again and retry.");
        setRepairingInviteId(null);
        setRepairAction(null);
        return;
      }

      const response = await fetch("/api/landlord/invitations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          invitationId,
          action,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const detail = payload.detail ? ` (${payload.detail})` : "";
        setStatus((payload.error || "Failed to repair invitation") + detail);
        setRepairingInviteId(null);
        setRepairAction(null);
        return;
      }

      setStatus(payload.message || "Invitation repaired successfully.");
      await loadData();
    } catch {
      setStatus("Unexpected error while repairing invitation.");
    } finally {
      setRepairingInviteId(null);
      setRepairAction(null);
    }
  };

  const updateTenancyStatus = async (
    tenancyId: string,
    nextStatus: "active" | "ended"
  ) => {
    setStatus(null);
    setUpdatingTenancyId(tenancyId);

    try {
      const { error } = await supabase
        .from("tenancies")
        .update({ status: nextStatus })
        .eq("id", tenancyId);

      if (error) {
        setStatus(error.message || "Failed to update tenancy status.");
        setUpdatingTenancyId(null);
        return;
      }

      setStatus(
        nextStatus === "ended"
          ? "Tenancy marked as ended."
          : "Tenancy reactivated."
      );
      await loadData();
    } catch {
      setStatus("Unexpected error while updating tenancy.");
    } finally {
      setUpdatingTenancyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading tenant assignments...
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/60 to-slate-900/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Tenant Management
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Manage tenants</h1>
        <p className="mt-2 text-sm text-slate-300">
          Invite tenants, repair assignment issues, and manage tenancy lifecycle.
        </p>
      </header>

      <div className="flex gap-2 rounded-3xl border border-slate-900 bg-slate-900/40 p-2">
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "manage"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-300 hover:bg-slate-800/40"
          }`}
        >
          Manage Tenants
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invitations")}
          className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "invitations"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-300 hover:bg-slate-800/40"
          }`}
        >
          Send Invitations
        </button>
      </div>

      {status ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {status}
        </p>
      ) : null}

      {activeTab === "invitations" ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={submitInvite}
            className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-6"
          >
            <h2 className="text-lg font-semibold text-white">New assignment invite</h2>

            <label className="grid gap-2 text-sm text-slate-200">
              Property
              <select
                value={selectedPropertyId}
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                required
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Tenant email
              <input
                type="email"
                value={tenantEmail}
                onChange={(event) => setTenantEmail(event.target.value)}
                placeholder="tenant@email.com"
                required
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Available unit (optional)
              {unitsTableMissing ? (
                <input
                  value={unitLabel}
                  onChange={(event) => setUnitLabel(event.target.value)}
                  placeholder="Unit 2B"
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              ) : (
                <select
                  value={unitLabel}
                  onChange={(event) => setUnitLabel(event.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                >
                  <option value="">No specific unit</option>
                  {availableUnitsForProperty.map((unit) => (
                    <option key={unit.id} value={unit.unit_number}>
                      {unit.unit_number}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {!unitsTableMissing && availableUnitsForProperty.length === 0 ? (
              <p className="text-xs text-amber-300">
                No available units found for this property. Add units from listing
                details, or send invite without unit selection.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || properties.length === 0}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Processing..." : "Send invite"}
            </button>

            {properties.length === 0 ? (
              <p className="text-xs text-slate-500">
                Create at least one listing before inviting tenants.
              </p>
            ) : null}
          </form>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live Stats</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatCard label="Active tenancies" value={`${activeTenancies.length}`} />
                <StatCard label="Pending invites" value={`${pendingInvites.length}`} />
                <StatCard label="Properties" value={`${properties.length}`} />
                <StatCard label="Total invites" value={`${invites.length}`} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Pending invitations
              </p>
              {pendingInvites.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No pending invites.</p>
              ) : (
                <ul className="mt-3 grid gap-2 text-sm">
                  {pendingInvites.slice(0, 8).map((invite) => {
                    const likelyHasAccount = likelyExistingTenantEmails.has(
                      invite.tenant_email.toLowerCase()
                    );

                    return (
                      <li
                        key={invite.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-slate-100">{invite.tenant_email}</p>
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                              likelyHasAccount
                                ? "border-emerald-600/70 text-emerald-200"
                                : "border-amber-600/70 text-amber-200"
                            }`}
                          >
                            {likelyHasAccount
                              ? "Likely account: use Force re-link"
                              : "Likely new: use Resend invite"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {invite.properties?.title || "Property"}
                          {invite.unit_label ? ` • ${invite.unit_label}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => repairInvite(invite.id, "resend")}
                            disabled={repairingInviteId === invite.id}
                            className="rounded-xl border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {repairingInviteId === invite.id && repairAction === "resend"
                              ? "Resending..."
                              : "Resend invite"}
                          </button>
                          <button
                            type="button"
                            onClick={() => repairInvite(invite.id, "force_relink")}
                            disabled={repairingInviteId === invite.id}
                            className="rounded-xl border border-emerald-600/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {repairingInviteId === invite.id &&
                            repairAction === "force_relink"
                              ? "Repairing..."
                              : "Force re-link"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active Tenancies" value={`${activeTenancies.length}`} />
            <StatCard label="Ended Tenancies" value={`${endedTenancies.length}`} />
            <StatCard label="Pending Invites" value={`${pendingInvites.length}`} />
            <StatCard label="Portfolio Properties" value={`${properties.length}`} />
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <label className="grid gap-2 text-sm text-slate-200">
              Search tenant, email, unit, or address
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by tenant or property"
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Status filter
              <select
                value={tenancyStatusFilter}
                onChange={(event) =>
                  setTenancyStatusFilter(event.target.value as TenancyStatusFilter)
                }
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Property filter
              <select
                value={tenancyPropertyFilter}
                onChange={(event) => setTenancyPropertyFilter(event.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              >
                <option value="all">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.title}>
                    {property.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Tenancy directory</h2>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.15em] text-slate-300">
                {filteredTenancies.length} result
                {filteredTenancies.length === 1 ? "" : "s"}
              </span>
            </div>

            {filteredTenancies.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No tenancies match your current filters.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {filteredTenancies.map((tenancy) => (
                  <article
                    key={tenancy.id}
                    className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-100">
                        {tenancy.tenant_profile?.full_name ||
                          tenancy.tenant_profile?.email ||
                          "Tenant"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {tenancy.tenant_profile?.email || "No email"}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        {tenancy.properties?.title || "Property"}
                        {tenancy.unit_label ? ` • ${tenancy.unit_label}` : " • Unit not set"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {tenancy.properties?.address || "Address unavailable"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                          tenancy.status === "active"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                            : "border-slate-600/60 bg-slate-700/20 text-slate-300"
                        }`}
                      >
                        {tenancy.status}
                      </span>

                      {tenancy.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => updateTenancyStatus(tenancy.id, "ended")}
                          disabled={updatingTenancyId === tenancy.id}
                          className="rounded-xl border border-amber-600/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingTenancyId === tenancy.id
                            ? "Updating..."
                            : "End tenancy"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateTenancyStatus(tenancy.id, "active")}
                          disabled={updatingTenancyId === tenancy.id}
                          className="rounded-xl border border-emerald-600/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingTenancyId === tenancy.id
                            ? "Updating..."
                            : "Re-activate"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
