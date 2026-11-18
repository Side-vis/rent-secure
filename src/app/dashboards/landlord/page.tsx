"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCurrencyTotals, sumByCurrency } from "@/lib/money";

type PropertyRow = {
  id: string;
  title: string;
  status: string;
  monthly_rent: number | null;
  currency: string | null;
  rejection_reason: string | null;
};

type Tone = "urgent" | "warning" | "info";

type AttentionItem = {
  id: string;
  tone: Tone;
  title: string;
  detail?: string;
  href: string;
  cta: string;
};

type DashboardData = {
  verificationStatus: string;
  rejectionReason: string | null;
  properties: PropertyRow[];
  occupiedUnits: number;
  totalUnits: number;
  activeTenancies: number;
  pendingInvites: number;
  expiringInvites: number;
  paymentsToReview: number;
  openMaintenance: number;
  urgentMaintenance: number;
  listingsWithoutUnits: PropertyRow[];
};

const INVITE_EXPIRY_WARNING_MS = 48 * 60 * 60 * 1000;

const TONE_STYLES: Record<Tone, string> = {
  urgent: "border-rose-500/40 bg-rose-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
  info: "border-slate-800 bg-slate-950/40",
};

const TONE_DOT: Record<Tone, string> = {
  urgent: "bg-rose-400",
  warning: "bg-amber-400",
  info: "bg-slate-500",
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function buildAttentionItems(data: DashboardData): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (data.paymentsToReview > 0) {
    items.push({
      id: "payments",
      tone: "urgent",
      title: `${plural(data.paymentsToReview, "rent payment")} waiting for your approval`,
      detail: "Tenants are waiting for confirmation that their payment was received.",
      href: "/dashboards/landlord/payments",
      cta: "Review payments",
    });
  }

  if (data.urgentMaintenance > 0) {
    items.push({
      id: "maintenance-urgent",
      tone: "urgent",
      title: `${plural(data.urgentMaintenance, "high-priority maintenance request")} open`,
      href: "/dashboards/landlord/maintenance",
      cta: "Open maintenance",
    });
  } else if (data.openMaintenance > 0) {
    items.push({
      id: "maintenance",
      tone: "warning",
      title: `${plural(data.openMaintenance, "maintenance request")} open`,
      href: "/dashboards/landlord/maintenance",
      cta: "Open maintenance",
    });
  }

  for (const property of data.properties.filter((p) => p.status === "rejected")) {
    items.push({
      id: `rejected-${property.id}`,
      tone: "urgent",
      title: `“${property.title}” needs changes before it can go live`,
      detail: property.rejection_reason ?? undefined,
      href: `/dashboards/landlord/listings/${property.id}`,
      cta: "Fix listing",
    });
  }

  if (data.expiringInvites > 0) {
    items.push({
      id: "invites-expiring",
      tone: "warning",
      title: `${plural(data.expiringInvites, "tenant invitation")} expire within 48 hours`,
      detail: "Resend them so tenants don't lose access.",
      href: "/dashboards/landlord/tenants",
      cta: "Manage invites",
    });
  }

  const drafts = data.properties.filter((p) => p.status === "draft");
  if (drafts.length > 0) {
    items.push({
      id: "drafts",
      tone: "warning",
      title: `${plural(drafts.length, "draft listing")} not yet submitted for review`,
      href: drafts.length === 1 ? `/dashboards/landlord/listings/${drafts[0].id}` : "/dashboards/landlord/listings",
      cta: drafts.length === 1 ? "Finish listing" : "View drafts",
    });
  }

  for (const property of data.listingsWithoutUnits) {
    items.push({
      id: `units-${property.id}`,
      tone: "info",
      title: `Add rooms or units to “${property.title}”`,
      detail: "Units let you invite tenants to a specific room and track occupancy.",
      href: `/dashboards/landlord/listings/${property.id}`,
      cta: "Add units",
    });
  }

  if (data.pendingInvites > 0 && data.expiringInvites === 0) {
    items.push({
      id: "invites",
      tone: "info",
      title: `${plural(data.pendingInvites, "tenant invitation")} waiting to be accepted`,
      href: "/dashboards/landlord/tenants",
      cta: "View invites",
    });
  }

  if (data.verificationStatus === "pending") {
    items.push({
      id: "verification-pending",
      tone: "info",
      title: "Your verification is being reviewed",
      detail: "Listings can be approved once your account is verified.",
      href: "/dashboards/landlord/onboarding",
      cta: "View submission",
    });
  }

  return items;
}

export default function LandlordDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: landlordProfile, error: profileError } = await supabase
        .from("landlord_profiles")
        .select("onboarding_step, verification_status, rejection_reason")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isActive) return;

      if (profileError) {
        console.error("Failed to load landlord profile:", profileError);
        setLoadError("Could not load your dashboard. Please refresh the page.");
        setLoading(false);
        return;
      }

      if (!landlordProfile || landlordProfile.onboarding_step < 5) {
        router.replace("/dashboards/landlord/onboarding");
        return;
      }

      const count = { count: "exact" as const, head: true };
      const [propertiesRes, tenanciesRes, invitationsRes, paymentsRes, maintenanceRes] = await Promise.all([
        supabase
          .from("properties")
          .select("id, title, status, monthly_rent, currency, rejection_reason")
          .or(`owner_id.eq.${user.id},landlord_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase.from("tenancies").select("id, property_id").eq("landlord_id", user.id).eq("status", "active"),
        supabase.from("tenant_invitations").select("id, expires_at").eq("landlord_id", user.id).eq("status", "pending"),
        supabase.from("rent_payments").select("id", count).eq("landlord_id", user.id).eq("status", "submitted"),
        supabase
          .from("maintenance_requests")
          .select("id, priority")
          .eq("landlord_id", user.id)
          .in("status", ["open", "in_progress"]),
      ]);

      if (!isActive) return;

      const failed = [propertiesRes, tenanciesRes, invitationsRes, paymentsRes, maintenanceRes].find((r) => r.error);
      if (failed?.error) {
        console.error("Failed to load landlord dashboard:", failed.error);
        setLoadError("Some of your dashboard could not be loaded. Figures may be incomplete.");
      }

      const properties = (propertiesRes.data as PropertyRow[] | null) ?? [];
      const tenancies = (tenanciesRes.data as Array<{ id: string; property_id: string }> | null) ?? [];

      // Units per property; a listing without units counts as a single rentable unit.
      const unitCounts = new Map<string, number>();
      if (properties.length > 0) {
        const { data: units } = await supabase
          .from("property_units")
          .select("property_id")
          .in(
            "property_id",
            properties.map((p) => p.id)
          );
        for (const unit of units ?? []) {
          unitCounts.set(unit.property_id, (unitCounts.get(unit.property_id) ?? 0) + 1);
        }
      }

      if (!isActive) return;

      const tenanciesByProperty = new Map<string, number>();
      for (const tenancy of tenancies) {
        tenanciesByProperty.set(tenancy.property_id, (tenanciesByProperty.get(tenancy.property_id) ?? 0) + 1);
      }

      const activeProperties = properties.filter((p) => p.status === "active");
      let totalUnits = 0;
      let occupiedUnits = 0;
      for (const property of activeProperties) {
        const units = Math.max(unitCounts.get(property.id) ?? 0, 1);
        totalUnits += units;
        occupiedUnits += Math.min(tenanciesByProperty.get(property.id) ?? 0, units);
      }

      const now = Date.now();
      const invitations = (invitationsRes.data as Array<{ id: string; expires_at: string }> | null) ?? [];
      const expiringInvites = invitations.filter((invite) => {
        const expiry = new Date(invite.expires_at).getTime();
        return Number.isFinite(expiry) && expiry >= now && expiry <= now + INVITE_EXPIRY_WARNING_MS;
      }).length;

      const maintenance = (maintenanceRes.data as Array<{ id: string; priority: string }> | null) ?? [];

      setData({
        verificationStatus: landlordProfile.verification_status ?? "not_started",
        rejectionReason: landlordProfile.rejection_reason ?? null,
        properties,
        occupiedUnits,
        totalUnits,
        activeTenancies: tenancies.length,
        pendingInvites: invitations.length,
        expiringInvites,
        paymentsToReview: paymentsRes.count ?? 0,
        openMaintenance: maintenance.length,
        urgentMaintenance: maintenance.filter((m) => m.priority === "urgent" || m.priority === "high").length,
        listingsWithoutUnits: activeProperties.filter((p) => !unitCounts.has(p.id)),
      });
      setLoading(false);
    };

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-rose-900/60 bg-rose-950/30 p-8 text-center text-sm text-rose-200">
        {loadError ?? "Could not load your dashboard."}
      </div>
    );
  }

  const isVerified = data.verificationStatus === "approved";
  const isRejected = data.verificationStatus === "rejected";
  const activeListings = data.properties.filter((p) => p.status === "active");
  const rentTotals = sumByCurrency(activeListings.map((p) => ({ amount: p.monthly_rent, currency: p.currency })));
  const occupancyRate = data.totalUnits > 0 ? Math.round((data.occupiedUnits / data.totalUnits) * 100) : 0;
  const attention = buildAttentionItems(data);

  const stats = [
    {
      label: "Payments to review",
      value: String(data.paymentsToReview),
      hint: data.paymentsToReview > 0 ? "Waiting for your approval" : "All caught up",
      href: "/dashboards/landlord/payments",
      highlight: data.paymentsToReview > 0,
    },
    {
      label: "Open maintenance",
      value: String(data.openMaintenance),
      hint: data.urgentMaintenance > 0 ? `${data.urgentMaintenance} high priority` : "Open or in progress",
      href: "/dashboards/landlord/maintenance",
      highlight: data.urgentMaintenance > 0,
    },
    {
      label: "Occupancy",
      value: data.totalUnits > 0 ? `${occupancyRate}%` : "—",
      hint:
        data.totalUnits > 0
          ? `${data.occupiedUnits} of ${plural(data.totalUnits, "unit")} occupied`
          : "No live listings yet",
      href: "/dashboards/landlord/tenants",
      highlight: false,
    },
    {
      label: "Monthly rent (live listings)",
      value: formatCurrencyTotals(rentTotals),
      hint: `${plural(activeListings.length, "live listing")} of ${data.properties.length}`,
      href: "/dashboards/landlord/listings",
      highlight: false,
    },
  ];

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Portfolio</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Landlord Dashboard</h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              What needs your attention across listings, tenants and payments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-2xl border px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] ${
                isVerified
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : isRejected
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              {isVerified ? "Verified" : isRejected ? "Changes requested" : "Verification pending"}
            </div>
            <Link
              href="/dashboards/landlord/listings"
              className="rounded-2xl bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-white"
            >
              + Add listing
            </Link>
          </div>
        </div>
      </section>

      {isRejected ? (
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-semibold text-rose-100">Your verification was not approved</h3>
            {data.rejectionReason ? (
              <p className="mt-2 whitespace-pre-line text-sm text-rose-100/90">{data.rejectionReason}</p>
            ) : null}
            <p className="mt-2 text-xs text-rose-200/80">
              Fix the issue in your onboarding details and resubmit for review.
            </p>
          </div>
          <Link
            href="/dashboards/landlord/onboarding"
            className="rounded-2xl bg-rose-500 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-rose-400"
          >
            Update &amp; resubmit
          </Link>
        </section>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-3xl border p-5 transition hover:border-slate-600 ${
              item.highlight ? "border-amber-500/40 bg-amber-500/5" : "border-slate-900 bg-slate-900/40"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <div className="mt-3 break-words text-2xl font-semibold text-white md:text-3xl">{item.value}</div>
            <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
          </Link>
        ))}
      </div>

      {data.properties.length === 0 ? (
        <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Get your first tenant in</h3>
          <ol className="mt-5 grid gap-3 text-sm">
            {[
              { done: isVerified, label: "Get verified", href: "/dashboards/landlord/onboarding" },
              { done: false, label: "Create a listing and submit it for review", href: "/dashboards/landlord/listings" },
              { done: false, label: "Add rooms or units to the listing", href: "/dashboards/landlord/listings" },
              { done: false, label: "Invite a tenant to a unit", href: "/dashboards/landlord/tenants" },
            ].map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 transition hover:border-slate-600"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.done ? "bg-emerald-500 text-slate-950" : "border border-slate-600 text-slate-300"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <span className={step.done ? "text-slate-400 line-through" : "text-slate-100"}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Needs your attention</h3>
          {attention.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
              You&apos;re all caught up. Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition hover:border-slate-500 ${TONE_STYLES[item.tone]}`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                        {item.detail ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{item.detail}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-200">{item.cta} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
