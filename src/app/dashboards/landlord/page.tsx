"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import DashboardSection from "@/components/dashboards/DashboardSection";

type PropertyRow = {
  id: string;
  title: string;
  status: string;
  monthly_rent: number | null;
  max_occupancy: number | null;
};

type TenancyRow = {
  id: string;
  status: string;
};

type InvitationRow = {
  id: string;
  status: string;
  expires_at: string;
};

export default function LandlordDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) {
        return;
      }

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: landlordProfile } = await supabase
        .from("landlord_profiles")
        .select("onboarding_step, verification_status, rejection_reason")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (!landlordProfile || landlordProfile.onboarding_step < 5) {
        router.replace("/dashboards/landlord/onboarding");
        return;
      }

      setIsVerified(landlordProfile.verification_status === "approved");
      setVerificationStatus(landlordProfile.verification_status ?? null);
      setRejectionReason(landlordProfile.rejection_reason ?? null);

      const [propertiesResult, tenanciesResult, invitationsResult] =
        await Promise.all([
          supabase
            .from("properties")
            .select("id, title, status, monthly_rent, max_occupancy")
            .or(`owner_id.eq.${user.id},landlord_id.eq.${user.id}`)
            .order("created_at", { ascending: false }),
          supabase
            .from("tenancies")
            .select("id, status")
            .eq("landlord_id", user.id)
            .eq("status", "active"),
          supabase
            .from("tenant_invitations")
            .select("id, status, expires_at")
            .eq("landlord_id", user.id)
            .eq("status", "pending"),
        ]);

      if (!isActive) {
        return;
      }

      setProperties((propertiesResult.data as PropertyRow[]) ?? []);
      setTenancies((tenanciesResult.data as TenancyRow[]) ?? []);
      setInvitations((invitationsResult.data as InvitationRow[]) ?? []);
      setLoading(false);
    };

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [router]);

  const activeListings = useMemo(
    () => properties.filter((property) => property.status === "active").length,
    [properties]
  );

  const draftListings = useMemo(
    () => properties.filter((property) => property.status === "draft").length,
    [properties]
  );

  const totalRentPotential = useMemo(
    () =>
      properties
        .filter((property) => property.status === "active")
        .reduce((sum, property) => sum + (property.monthly_rent ?? 0), 0),
    [properties]
  );

  const totalCapacity = useMemo(
    () => properties.reduce((sum, property) => sum + (property.max_occupancy ?? 0), 0),
    [properties]
  );

  const occupancyRate = useMemo(() => {
    if (totalCapacity === 0) {
      return 0;
    }
    return Math.min(100, Math.round((tenancies.length / totalCapacity) * 100));
  }, [tenancies.length, totalCapacity]);

  const openInvitations = invitations.length;

  const urgentInvites = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 48 * 60 * 60 * 1000;

    return invitations.filter((invite) => {
      const expiry = new Date(invite.expires_at).getTime();
      return Number.isFinite(expiry) && expiry >= now && expiry <= cutoff;
    }).length;
  }, [invitations]);

  const actionItems = useMemo(() => {
    const items: string[] = [];
    if (!isVerified) {
      items.push("Complete verification to improve tenant trust and listing visibility.");
    }
    if (draftListings > 0) {
      items.push(
        `You have ${draftListings} draft listing${draftListings === 1 ? "" : "s"}; complete details and submit for review.`
      );
    }
    if (openInvitations > 0) {
      items.push(
        `${openInvitations} tenant invitation${openInvitations === 1 ? "" : "s"} waiting for acceptance.`
      );
    }
    if (urgentInvites > 0) {
      items.push(
        `${urgentInvites} invitation${urgentInvites === 1 ? "" : "s"} expire within 48 hours.`
      );
    }
    if (items.length === 0) {
      items.push("No urgent actions right now. Keep your listings updated with room-level details.");
    }
    return items;
  }, [draftListings, isVerified, openInvitations, urgentInvites]);

  const listingWorkflowItems = useMemo(() => {
    const items: string[] = [];

    if (properties.length === 0) {
      items.push("Create your first listing to start attracting tenant demand.");
      items.push("Add accurate address, rent, and occupancy details before publishing.");
      items.push("Upload room or unit inventory so invitations can target specific units.");
      items.push("Submit your first listing for review once all required fields are complete.");
      return items;
    }

    if (draftListings > 0) {
      items.push(
        `Complete ${draftListings} draft listing${draftListings === 1 ? "" : "s"} and submit for verification.`
      );
    } else {
      items.push("All listings are currently out of draft. Keep media and rent details up to date.");
    }

    items.push(
      activeListings > 0
        ? `You have ${activeListings} active listing${activeListings === 1 ? "" : "s"}; review pricing weekly for competitiveness.`
        : "No active listings yet; publish at least one listing to begin tenant onboarding."
    );
    items.push(
      `Portfolio visibility: ${properties.length} listing${properties.length === 1 ? "" : "s"} currently tracked.`
    );
    items.push(
      isVerified
        ? "Verification approved. Listings receive stronger trust signals in tenant-facing flows."
        : "Verification pending. Complete verification to improve listing credibility and conversion."
    );

    return items.slice(0, 4);
  }, [activeListings, draftListings, isVerified, properties.length]);

  const tenantPipelineItems = useMemo(() => {
    const items: string[] = [];

    items.push(
      openInvitations > 0
        ? `${openInvitations} invitation${openInvitations === 1 ? "" : "s"} awaiting acceptance; follow up with tenants today.`
        : "No pending invitations right now; send invites from Tenant Management as new units open."
    );
    items.push(
      urgentInvites > 0
        ? `${urgentInvites} invitation${urgentInvites === 1 ? "" : "s"} expire within 48 hours; resend or force re-link to avoid drop-off.`
        : "No invitations expiring in the next 48 hours."
    );
    items.push(
      tenancies.length > 0
        ? `${tenancies.length} active tenanc${tenancies.length === 1 ? "y" : "ies"}; keep status current for accurate occupancy reporting.`
        : "No active tenancies yet; prioritize converting pending invitations."
    );
    items.push(
      occupancyRate >= 85
        ? `Occupancy is ${occupancyRate}%; prioritize retention and renewal outreach.`
        : `Occupancy is ${occupancyRate}%; focus on filling available units to improve recurring income.`
    );

    return items;
  }, [occupancyRate, openInvitations, tenancies.length, urgentInvites]);

  const portfolioHealthItems = useMemo(() => {
    const items: string[] = [];

    items.push(
      totalRentPotential > 0
        ? `Current active rent potential is $${totalRentPotential.toLocaleString()} per month.`
        : "Rent potential is $0; publish active listings to begin generating monthly rent."
    );
    items.push(
      totalCapacity > 0
        ? `Configured capacity is ${totalCapacity} total occupant slot${totalCapacity === 1 ? "" : "s"}.`
        : "Capacity is not configured yet; add occupancy details on each listing."
    );
    items.push(
      properties.length > 0
        ? `Average active rent per listing: $${Math.round(totalRentPotential / Math.max(activeListings, 1)).toLocaleString()}.`
        : "No listing-level rent averages available until at least one listing is created."
    );
    items.push("Review listing-level performance weekly to catch pricing and vacancy trends early.");

    return items;
  }, [activeListings, properties.length, totalCapacity, totalRentPotential]);

  const complianceReadinessItems = useMemo(() => {
    const items: string[] = [];

    items.push(
      isVerified
        ? "Identity verification is complete; continue maintaining compliant listing data."
        : "Complete verification and profile checks to unlock stronger tenant trust signals."
    );
    items.push(
      draftListings > 0
        ? `Resolve ${draftListings} draft listing${draftListings === 1 ? "" : "s"} with missing details before publishing.`
        : "No draft backlog detected; keep required fields complete on any new listing."
    );
    items.push(
      openInvitations > 0
        ? "Monitor invitation status changes daily to prevent tenant onboarding delays."
        : "Invitation queue is clear; keep tenant communication templates ready for new openings."
    );
    items.push("Keep tenancy status and unit assignments current to support accurate audit trails.");

    return items;
  }, [draftListings, isVerified, openInvitations]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Portfolio
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Landlord Dashboard
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              Manage listings, tenants, and finances with clear, actionable
              signals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboards/landlord/listings"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Add listing
            </Link>
            <Link
              href="/dashboards/landlord/tenants"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Manage tenants
            </Link>
            <Link
              href="/dashboards/landlord/payments"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Review payments
            </Link>
            <Link
              href="/dashboards/landlord/maintenance"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Maintenance queue
            </Link>
            <div
              className={`rounded-2xl border px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] ${
                isVerified
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : verificationStatus === "rejected"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              {isVerified
                ? "Verified"
                : verificationStatus === "rejected"
                  ? "Changes requested"
                  : "Verification pending"}
            </div>
          </div>
        </div>
      </section>

      {verificationStatus === "rejected" ? (
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-semibold text-rose-100">
              Your verification was not approved
            </h3>
            {rejectionReason ? (
              <p className="mt-2 whitespace-pre-line text-sm text-rose-100/90">{rejectionReason}</p>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active listings",
            value: String(activeListings),
            trend: `${properties.length} total`,
          },
          {
            label: "Occupancy rate",
            value: `${occupancyRate}%`,
            trend: `${tenancies.length} active tenants`,
          },
          {
            label: "Pending invites",
            value: String(openInvitations),
            trend: urgentInvites > 0 ? `${urgentInvites} expiring soon` : "Stable",
          },
          {
            label: "Rent potential",
            value: `$${totalRentPotential.toLocaleString()}`,
            trend: "Monthly active listings",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {item.label}
            </p>
            <div className="mt-3 text-3xl font-semibold text-white">
              {item.value}
            </div>
            <p className="mt-2 text-xs text-slate-500">{item.trend}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Next Actions</h3>
          <p className="mt-2 text-sm text-slate-300">
            Live recommendations based on your listing and tenant activity.
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-slate-200">
            {actionItems.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6">
          <DashboardSection
            title="Listings + Verification"
            description="Prioritized listing actions based on current portfolio status."
            items={listingWorkflowItems}
          />
          <DashboardSection
            title="Tenant Pipeline"
            description="Invitation and tenancy signals that need attention now."
            items={tenantPipelineItems}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardSection
          title="Portfolio Health"
          description="Capacity and rent potential indicators for planning decisions."
          items={portfolioHealthItems}
        />
        <DashboardSection
          title="Compliance Readiness"
          description="Data hygiene checkpoints to keep listing and tenancy records reliable."
          items={complianceReadinessItems}
        />
      </div>
    </div>
  );
}
