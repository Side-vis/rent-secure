"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type TenantTenancy = {
  id: string;
  property_id: string;
  unit_label: string | null;
  status: "active" | "ended";
  start_date: string | null;
  properties: {
    title: string;
    address: string | null;
    city: string | null;
    country: string | null;
    monthly_rent: number | null;
    currency: string | null;
  } | null;
  landlord_profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type AssignedUnitDetails = {
  id: string;
  unit_number: string;
  unit_type: string;
  monthly_rent: number | null;
  bathrooms: number | null;
  furnished: boolean;
  is_available: boolean;
  notes: string | null;
};

type PendingInvite = {
  id: string;
  created_at: string;
  expires_at: string;
  unit_label: string | null;
  properties: {
    title: string;
    city: string | null;
    country: string | null;
  } | null;
};

type PaymentItem = {
  id: string;
  tenancy_id: string;
  amount: number;
  currency: string;
  payment_period_start: string;
  payment_period_end: string;
  reference_code: string;
  status: "submitted" | "approved" | "rejected";
};

type PaymentAllocationItem = {
  id: string;
  payment_id: string;
  tenancy_id: string;
  lease_month_key: string;
  allocated_amount: number;
  rent_payments: Array<{
    status: "submitted" | "approved" | "rejected";
    reference_code: string;
    payment_period_start: string;
    payment_period_end: string;
  }> | null;
};

type LeaseCycle = {
  start: Date;
  end: Date;
};

type BillingMonth = {
  key: string;
  start: Date;
  end: Date;
  label: string;
};

type TimelineStatus = "not_covered" | "paid" | "partial" | "unpaid";

type MonthContribution = {
  paymentId: string;
  referenceCode: string;
  splitAmount: number;
};

type TimelineMonth = BillingMonth & {
  paidAmount: number;
  expectedAmount: number | null;
  status: TimelineStatus;
  contributions: MonthContribution[];
};

function parseIsoDate(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(baseDate: Date, monthsToAdd: number) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() + monthsToAdd;
  const day = baseDate.getUTCDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

function monthValueFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildLeaseCycles(startDateIso: string, nowDate: Date) {
  const leaseStart = parseIsoDate(startDateIso);
  if (!leaseStart) {
    return [] as LeaseCycle[];
  }

  const cycles: LeaseCycle[] = [];
  for (let cycleIndex = 0; cycleIndex < 50; cycleIndex += 1) {
    const cycleStart = addMonthsClamped(leaseStart, cycleIndex * 12);
    if (cycleStart.getTime() > nowDate.getTime() && cycleIndex > 0) {
      break;
    }

    const cycleEnd = addDays(addMonthsClamped(leaseStart, (cycleIndex + 1) * 12), -1);
    cycles.push({ start: cycleStart, end: cycleEnd });
  }

  return cycles;
}

function buildBillingMonths(cycleStart: Date) {
  const months: BillingMonth[] = [];

  for (let index = 0; index < 12; index += 1) {
    const start = addMonthsClamped(cycleStart, index);
    const end = addDays(addMonthsClamped(cycleStart, index + 1), -1);
    months.push({
      key: `${monthValueFromDate(start)}-${index}`,
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "short" }),
    });
  }

  return months;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
}

function allocateMonthAmounts(
  totalAmount: number,
  monthCount: number,
  expectedPerMonth: number | null
) {
  if (monthCount <= 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return Array.from({ length: Math.max(0, monthCount) }, () => 0);
  }

  if (expectedPerMonth == null || !Number.isFinite(expectedPerMonth) || expectedPerMonth <= 0) {
    const equalSplit = totalAmount / monthCount;
    return Array.from({ length: monthCount }, () => equalSplit);
  }

  const allocations = Array.from({ length: monthCount }, () => 0);
  let remaining = totalAmount;

  for (let index = 0; index < monthCount; index += 1) {
    if (remaining <= 0) {
      break;
    }

    const nextAmount = Math.min(expectedPerMonth, remaining);
    allocations[index] = nextAmount;
    remaining -= nextAmount;
  }

  if (remaining > 0) {
    allocations[monthCount - 1] += remaining;
  }

  return allocations;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function getCurrentCycleIndex(cycles: LeaseCycle[], nowDate: Date) {
  const found = cycles.findIndex(
    (cycle) => nowDate.getTime() >= cycle.start.getTime() && nowDate.getTime() <= cycle.end.getTime()
  );
  return found >= 0 ? found : Math.max(0, cycles.length - 1);
}

export default function TenantDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [tenancies, setTenancies] = useState<TenantTenancy[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocationItem[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [assignedUnit, setAssignedUnit] = useState<AssignedUnitDetails | null>(null);
  const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
  const [pinnedMonthKey, setPinnedMonthKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? null);

      const tenantInviteQuery = supabase
        .from("tenant_invitations")
        .select("id, created_at, expires_at, unit_label, properties(title, city, country)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (user.email) {
        tenantInviteQuery.or(
          `tenant_user_id.eq.${user.id},tenant_email.eq.${user.email.toLowerCase()}`
        );
      } else {
        tenantInviteQuery.eq("tenant_user_id", user.id);
      }

      const [tenancyRes, inviteRes, paymentRes, allocationRes] = await Promise.all([
        supabase
          .from("tenancies")
          .select(
            "id, property_id, unit_label, status, start_date, properties(title, address, city, country, monthly_rent, currency), landlord_profile:landlord_id(full_name, email, phone)"
          )
          .eq("tenant_user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        tenantInviteQuery,
        supabase
          .from("rent_payments")
          .select(
            "id, tenancy_id, amount, currency, payment_period_start, payment_period_end, reference_code, status"
          )
          .eq("tenant_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("rent_payment_allocations")
          .select(
            "id, payment_id, tenancy_id, lease_month_key, allocated_amount, rent_payments(status, reference_code, payment_period_start, payment_period_end)"
          )
          .eq("tenant_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(800),
      ]);

      if (!active) {
        return;
      }

      setTenancies((tenancyRes.data as TenantTenancy[] | null) ?? []);
      setPendingInvites((inviteRes.data as PendingInvite[] | null) ?? []);
      setPayments((paymentRes.data as PaymentItem[] | null) ?? []);
      setAllocations(
        ((allocationRes.data as Array<{
          id: string;
          payment_id: string;
          tenancy_id: string;
          lease_month_key: string;
          allocated_amount: number;
          rent_payments: Array<{
            status: "submitted" | "approved" | "rejected";
            reference_code: string;
            payment_period_start: string;
            payment_period_end: string;
          }> | null;
        }> | null) ?? []) as PaymentAllocationItem[]
      );
      setLoading(false);
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const primaryTenancy = tenancies[0] ?? null;

  useEffect(() => {
    let active = true;

    const loadAssignedUnit = async () => {
      if (!primaryTenancy?.property_id || !primaryTenancy.unit_label) {
        if (active) {
          setAssignedUnit(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from("property_units")
        .select(
          "id, unit_number, unit_type, monthly_rent, bathrooms, furnished, is_available, notes"
        )
        .eq("property_id", primaryTenancy.property_id)
        .ilike("unit_number", primaryTenancy.unit_label)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error || !data) {
        setAssignedUnit(null);
        return;
      }

      setAssignedUnit(data as AssignedUnitDetails);
    };

    loadAssignedUnit();

    return () => {
      active = false;
    };
  }, [primaryTenancy?.property_id, primaryTenancy?.unit_label]);

  const monthlyRentLabel = useMemo(() => {
    const value = primaryTenancy?.properties?.monthly_rent;
    const currency = primaryTenancy?.properties?.currency || "USD";
    if (value === null || value === undefined) {
      return "TBD";
    }
    return `${currency} ${Number(value).toLocaleString()}`;
  }, [primaryTenancy]);

  const nowDate = useMemo(() => new Date(), []);

  const tenancyPayments = useMemo(
    () => payments.filter((item) => item.tenancy_id === primaryTenancy?.id),
    [payments, primaryTenancy?.id]
  );

  const tenancyAllocations = useMemo(
    () => allocations.filter((item) => item.tenancy_id === primaryTenancy?.id),
    [allocations, primaryTenancy?.id]
  );

  const fallbackExpectedAmount = useMemo(() => {
    const latestSubmitted = tenancyPayments.find((item) => item.status === "submitted");
    return latestSubmitted ? Number(latestSubmitted.amount) : null;
  }, [tenancyPayments]);

  const expectedMonthlyAmount = useMemo(() => {
    const monthlyRent = primaryTenancy?.properties?.monthly_rent;
    if (monthlyRent != null && Number.isFinite(Number(monthlyRent)) && Number(monthlyRent) > 0) {
      return Number(monthlyRent);
    }

    if (
      fallbackExpectedAmount != null &&
      Number.isFinite(fallbackExpectedAmount) &&
      fallbackExpectedAmount > 0
    ) {
      return fallbackExpectedAmount;
    }

    return null;
  }, [fallbackExpectedAmount, primaryTenancy?.properties?.monthly_rent]);

  const leaseCycles = useMemo(() => {
    if (!primaryTenancy?.start_date) {
      return [] as LeaseCycle[];
    }
    return buildLeaseCycles(primaryTenancy.start_date, nowDate);
  }, [nowDate, primaryTenancy?.start_date]);

  useEffect(() => {
    if (leaseCycles.length === 0) {
      setSelectedCycleIndex(0);
      return;
    }

    setSelectedCycleIndex(getCurrentCycleIndex(leaseCycles, nowDate));
  }, [leaseCycles, nowDate, primaryTenancy?.id]);

  useEffect(() => {
    setPinnedMonthKey(null);
  }, [primaryTenancy?.id, selectedCycleIndex]);

  const selectedCycle =
    leaseCycles[Math.min(selectedCycleIndex, Math.max(0, leaseCycles.length - 1))] ?? null;

  const billingMonths = useMemo(() => {
    if (!selectedCycle) {
      return [] as BillingMonth[];
    }
    return buildBillingMonths(selectedCycle.start);
  }, [selectedCycle]);

  const timelineMonths = useMemo(() => {
    if (!selectedCycle || billingMonths.length === 0) {
      return [] as TimelineMonth[];
    }

    const monthPaidMap = new Map<string, number>();
    const monthContributionMap = new Map<string, MonthContribution[]>();
    const cycleMonthLookup = new Map(
      billingMonths.map((month) => [monthValueFromDate(month.start), month])
    );

    const approvedAllocations = tenancyAllocations.filter(
      (item) => item.rent_payments?.[0]?.status === "approved"
    );

    for (const allocation of approvedAllocations) {
      const matchedMonth = cycleMonthLookup.get(allocation.lease_month_key);
      if (!matchedMonth) {
        continue;
      }

      const splitAmount = Number(allocation.allocated_amount);
      if (!Number.isFinite(splitAmount) || splitAmount <= 0) {
        continue;
      }

      monthPaidMap.set(matchedMonth.key, (monthPaidMap.get(matchedMonth.key) ?? 0) + splitAmount);
      monthContributionMap.set(matchedMonth.key, [
        ...(monthContributionMap.get(matchedMonth.key) ?? []),
        {
          paymentId: allocation.payment_id,
          referenceCode: allocation.rent_payments?.[0]?.reference_code ?? "Payment",
          splitAmount,
        },
      ]);
    }

    const approvedAllocationPaymentIds = new Set(
      approvedAllocations.map((item) => item.payment_id)
    );
    const approvedPayments = tenancyPayments.filter(
      (item) => item.status === "approved" && !approvedAllocationPaymentIds.has(item.id)
    );

    for (const payment of approvedPayments) {
      const paymentStart = parseIsoDate(payment.payment_period_start);
      const paymentEnd = parseIsoDate(payment.payment_period_end);
      const amountValue = Number(payment.amount);

      if (!paymentStart || !paymentEnd || !Number.isFinite(amountValue) || amountValue <= 0) {
        continue;
      }

      const overlappingMonths = billingMonths.filter((month) =>
        rangesOverlap(paymentStart, paymentEnd, month.start, month.end)
      );

      if (overlappingMonths.length === 0) {
        continue;
      }

      const allocationsPerMonth = allocateMonthAmounts(
        amountValue,
        overlappingMonths.length,
        expectedMonthlyAmount
      );

      for (let index = 0; index < overlappingMonths.length; index += 1) {
        const month = overlappingMonths[index];
        const splitAmount = allocationsPerMonth[index] ?? 0;
        monthPaidMap.set(month.key, (monthPaidMap.get(month.key) ?? 0) + splitAmount);
        monthContributionMap.set(month.key, [
          ...(monthContributionMap.get(month.key) ?? []),
          {
            paymentId: payment.id,
            referenceCode: payment.reference_code,
            splitAmount,
          },
        ]);
      }
    }

    return billingMonths.map((month) => {
      const paidAmount = monthPaidMap.get(month.key) ?? 0;
      const isCovered = month.end.getTime() <= nowDate.getTime();
      let status: TimelineStatus = "not_covered";

      if (expectedMonthlyAmount == null) {
        if (paidAmount > 0) {
          status = "partial";
        } else if (isCovered) {
          status = "unpaid";
        }
      } else if (paidAmount >= expectedMonthlyAmount - 0.01) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partial";
      } else if (isCovered) {
        status = "unpaid";
      }

      return {
        ...month,
        paidAmount,
        expectedAmount: expectedMonthlyAmount,
        status,
        contributions: monthContributionMap.get(month.key) ?? [],
      };
    });
  }, [
    billingMonths,
    expectedMonthlyAmount,
    nowDate,
    selectedCycle,
    tenancyAllocations,
    tenancyPayments,
  ]);

  const timelineCurrency = primaryTenancy?.properties?.currency || "USD";
  const pinnedMonth = useMemo(
    () => timelineMonths.find((month) => month.key === pinnedMonthKey) ?? null,
    [pinnedMonthKey, timelineMonths]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading your rental dashboard...
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900 via-slate-950 to-slate-900/70 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Tenant Space
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
              {primaryTenancy?.properties?.title || "Your home dashboard"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {primaryTenancy?.properties?.address ||
                "Assignments and rent details will appear here once active."}
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
              <MetricTile label="Rent" value={monthlyRentLabel} />
              <MetricTile
                label="Active homes"
                value={`${tenancies.filter((t) => t.status === "active").length}`}
              />
              <MetricTile label="Pending invites" value={`${pendingInvites.length}`} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Rent Rhythm
            </p>
            <div className="mt-4 flex items-center gap-3 sm:gap-4">
              <Ring value={82} />
              <div>
                <p className="text-lg font-semibold text-white">Stable</p>
                <p className="text-xs text-slate-400">
                  On-time trend is building.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-xs text-slate-400">
              <Bar label="Rent progress" width="82%" />
              <Bar label="Lease health" width="74%" />
              <Bar label="Profile complete" width="68%" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <InfoCard
          title="Assigned Unit"
          value={primaryTenancy?.unit_label || "Not set"}
          sub={primaryTenancy?.properties?.city || "Waiting assignment"}
        />
        <InfoCard
          title="Landlord"
          value={
            primaryTenancy?.landlord_profile?.full_name ||
            primaryTenancy?.landlord_profile?.email ||
            "Pending"
          }
          sub={primaryTenancy?.landlord_profile?.phone || "Contact pending"}
        />
        <InfoCard
          title="Lease Start"
          value={
            primaryTenancy?.start_date
              ? new Date(primaryTenancy.start_date).toLocaleDateString()
              : "TBD"
          }
          sub={primaryTenancy ? "Active" : "Not active"}
        />
      </section>

      <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Lease payment timeline</h2>
            <p className="mt-1 text-xs text-slate-400">
              Month marks follow your tenancy cycle and each mark represents the month-end due date.
            </p>
          </div>

          {leaseCycles.length > 0 ? (
            <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-2 py-1 sm:inline-flex sm:w-auto sm:justify-start">
              <button
                type="button"
                onClick={() => setSelectedCycleIndex((value) => Math.max(0, value - 1))}
                disabled={selectedCycleIndex <= 0}
                className="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
              >
                Previous
              </button>
              <span className="px-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 sm:px-2 sm:text-xs sm:tracking-[0.15em]">
                {selectedCycle
                  ? `${selectedCycle.start.toLocaleDateString()} - ${selectedCycle.end.toLocaleDateString()}`
                  : "No cycle"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedCycleIndex((value) => Math.min(leaseCycles.length - 1, value + 1))
                }
                disabled={selectedCycleIndex >= leaseCycles.length - 1}
                className="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        {!primaryTenancy ? (
          <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            You need an active tenancy to view the lease timeline.
          </p>
        ) : !primaryTenancy.start_date ? (
          <p className="mt-4 rounded-2xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Tenancy start date is missing, so the lease timeline cannot be generated yet.
          </p>
        ) : timelineMonths.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            No lease cycle data is available for this tenancy.
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
              <p>
                Expected monthly rent:{" "}
                <span className="font-semibold text-slate-100">
                  {expectedMonthlyAmount != null
                    ? formatMoney(expectedMonthlyAmount, timelineCurrency)
                    : "Unavailable"}
                </span>
              </p>
              <p>
                Cycle covered months:{" "}
                <span className="font-semibold text-slate-100">
                  {timelineMonths.filter((month) => month.status !== "not_covered").length}/12
                </span>
              </p>
              <p>
                Approved coverage:{" "}
                <span className="font-semibold text-slate-100">
                  {formatMoney(
                    timelineMonths.reduce((total, month) => total + month.paidAmount, 0),
                    timelineCurrency
                  )}
                </span>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.15em]">
              <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-slate-200 sm:px-3">
                Not covered
              </span>
              <span className="rounded-full border border-emerald-500/60 bg-emerald-500/20 px-2.5 py-1 text-emerald-100 sm:px-3">
                Covered and paid
              </span>
              <span className="rounded-full border border-amber-500/60 bg-amber-500/20 px-2.5 py-1 text-amber-100 sm:px-3">
                Covered but partial
              </span>
              <span className="rounded-full border border-rose-500/60 bg-rose-500/20 px-2.5 py-1 text-rose-100 sm:px-3">
                Covered but unpaid
              </span>
            </div>

            <div className="no-scrollbar mt-4 overflow-x-auto overflow-y-visible pb-2" onClick={() => setPinnedMonthKey(null)}>
              <div className="flex min-w-180 gap-2 sm:min-w-230">
                {timelineMonths.map((month) => {
                  const segmentClass =
                    month.status === "paid"
                      ? "border-emerald-500/60 bg-emerald-500/20"
                      : month.status === "partial"
                        ? "border-amber-500/60 bg-amber-500/20"
                        : month.status === "unpaid"
                          ? "border-rose-500/60 bg-rose-500/20"
                          : "border-slate-700 bg-slate-800/70";

                  return (
                    <div key={month.key} className="min-w-18 flex-1">
                      <p className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        {month.label}
                      </p>
                      <button
                        type="button"
                        className={`relative mt-2 h-8 w-full rounded-xl border ${segmentClass}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPinnedMonthKey((current) => (current === month.key ? null : month.key));
                        }}
                        aria-label={`${month.label} payment details`}
                      >
                        <span className="absolute -right-px top-0 h-8 w-px bg-slate-200/70" />
                      </button>
                      <p className="mt-2 text-center text-[11px] text-slate-300">
                        {month.end.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      </p>
                      <p className="mt-1 text-center text-[10px] text-slate-500">due</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {pinnedMonth ? (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">{pinnedMonth.label} billing window</p>
                    <p className="mt-1 text-slate-400">
                      {pinnedMonth.start.toLocaleDateString()} - {pinnedMonth.end.toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-slate-300">
                      Paid:{" "}
                      <span className="font-semibold text-slate-100">
                        {formatMoney(pinnedMonth.paidAmount, timelineCurrency)}
                      </span>
                    </p>
                    <p className="mt-1 text-slate-300">
                      Expected:{" "}
                      <span className="font-semibold text-slate-100">
                        {pinnedMonth.expectedAmount != null
                          ? formatMoney(pinnedMonth.expectedAmount, timelineCurrency)
                          : "Unavailable"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinnedMonthKey(null)}
                    className="self-start rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>

                {pinnedMonth.contributions.length > 0 ? (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                      Contributing payment refs
                    </p>
                    <ul className="mt-2 grid gap-1 text-[11px]">
                      {pinnedMonth.contributions.map((entry) => (
                        <li key={`${pinnedMonth.key}-${entry.paymentId}`} className="text-slate-300">
                          <span className="font-medium text-slate-100">{entry.referenceCode}</span>{" "}
                          <span className="text-slate-400">({formatMoney(entry.splitAmount, timelineCurrency)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 border-t border-slate-800 pt-3 text-slate-400">
                    No approved payments contributed to this month.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Room details</h2>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {assignedUnit ? "Linked" : "Not linked"}
          </span>
        </div>

        {!primaryTenancy?.unit_label ? (
          <p className="mt-3 text-sm text-slate-400">
            Your landlord has not attached a room or unit to this tenancy yet.
          </p>
        ) : !assignedUnit ? (
          <p className="mt-3 text-sm text-slate-400">
            Unit label is attached ({primaryTenancy.unit_label}), but full room
            metadata is not available yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              title="Room Type"
              value={assignedUnit.unit_type.replace("_", " ")}
              sub="Configured by landlord"
            />
            <InfoCard
              title="Room Rent"
              value={
                assignedUnit.monthly_rent == null
                  ? "Not set"
                  : `${primaryTenancy?.properties?.currency || "USD"} ${assignedUnit.monthly_rent.toLocaleString()}`
              }
              sub="Monthly"
            />
            <InfoCard
              title="Bathrooms"
              value={
                assignedUnit.bathrooms == null
                  ? "Not set"
                  : String(assignedUnit.bathrooms)
              }
              sub={assignedUnit.furnished ? "Furnished" : "Unfurnished"}
            />
            <InfoCard
              title="Availability"
              value={assignedUnit.is_available ? "Available" : "Occupied"}
              sub="Live unit status"
            />
          </div>
        )}

        {assignedUnit?.notes ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {assignedUnit.notes}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your rentals</h2>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              {tenancies.length}
            </span>
          </div>

          {tenancies.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No active rental yet. Once your landlord assigns a unit, it appears here.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 text-sm">
              {tenancies.map((tenancy) => (
                <li
                  key={tenancy.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                >
                  <p className="font-semibold text-slate-100">
                    {tenancy.properties?.title || "Rental"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {tenancy.properties?.address || "Address pending"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{tenancy.unit_label || "Unit not set"}</span>
                    <span>•</span>
                    <span>{tenancy.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Pending invites</h2>
            {pendingInvites.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">You are all caught up.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {pendingInvites.slice(0, 4).map((invite) => (
                  <li
                    key={invite.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-3"
                  >
                    <p className="text-sm text-slate-100">
                      {invite.properties?.title || "Rental invite"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {invite.unit_label || "Unit pending"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Quick actions</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Link
                href="/dashboards/profile"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-slate-200 transition hover:border-slate-600"
              >
                Update profile
              </Link>
              <Link
                href="/dashboards/tenant/maintenance"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-slate-200 transition hover:border-slate-600"
              >
                Request maintenance
              </Link>
              <Link
                href="/dashboards/tenant/payments"
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-slate-200 transition hover:border-slate-600"
              >
                Pay rent
              </Link>
            </div>
            {email ? (
              <p className="mt-4 text-xs text-slate-500">Signed in as {email}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3 sm:px-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{value}</p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const degrees = Math.max(0, Math.min(360, Math.round((value / 100) * 360)));
  return (
    <div className="relative h-16 w-16 sm:h-20 sm:w-20">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#22d3ee ${degrees}deg, #1e293b 0deg)` }}
      />
      <div className="absolute inset-1.75 rounded-full bg-slate-950" />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white sm:text-sm">
        {value}%
      </div>
    </div>
  );
}

function Bar({ label, width }: { label: string; width: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span>{width}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300" style={{ width }} />
      </div>
    </div>
  );
}
