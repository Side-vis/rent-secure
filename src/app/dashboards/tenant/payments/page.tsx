"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TenantTenancy = {
  id: string;
  start_date: string | null;
  unit_label: string | null;
  landlord_id: string;
  property_id: string;
  properties: {
    title: string;
    currency: string | null;
    monthly_rent: number | null;
  } | null;
};

type PaymentItem = {
  id: string;
  tenancy_id: string;
  amount: number;
  currency: string;
  payment_month: string;
  payment_period_start: string;
  payment_period_end: string;
  payment_method: "mobile_money" | "bank_transfer" | "cash" | "card" | "other";
  reference_code: string;
  note: string | null;
  status: "submitted" | "approved" | "rejected";
  landlord_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  properties: {
    title: string;
  } | null;
};

type PaymentAllocationItem = {
  id: string;
  payment_id: string;
  tenancy_id: string;
  tenant_user_id: string;
  landlord_id: string;
  property_id: string;
  lease_month_key: string;
  allocated_amount: number;
  expected_amount_snapshot: number | null;
  allocation_method: "equal_split" | "sequential_fill";
  created_at: string;
  rent_payments: Array<{
    status: "submitted" | "approved" | "rejected";
    reference_code: string;
    payment_period_start: string;
    payment_period_end: string;
  }> | null;
};

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentItem["payment_method"]; label: string }> = [
  { value: "mobile_money", label: "Mobile money" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

type LeaseCycle = {
  start: Date;
  end: Date;
  id: string;
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
  periodStart: string;
  periodEnd: string;
};

type BillingMonthView = BillingMonth & {
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

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildLeaseCycles(startDateIso: string, nowDate: Date) {
  const leaseStart = parseIsoDate(startDateIso);
  if (!leaseStart) {
    return [] as LeaseCycle[];
  }

  const cycles: LeaseCycle[] = [];
  let cycleIndex = 0;

  while (cycleIndex < 50) {
    const cycleStart = addMonthsClamped(leaseStart, cycleIndex * 12);
    if (cycleStart.getTime() > nowDate.getTime() && cycleIndex > 0) {
      break;
    }

    const cycleEnd = addDays(addMonthsClamped(leaseStart, (cycleIndex + 1) * 12), -1);
    cycles.push({
      start: cycleStart,
      end: cycleEnd,
      id: formatIsoDate(cycleStart),
    });

    if (cycleStart.getTime() > nowDate.getTime()) {
      break;
    }

    cycleIndex += 1;
  }

  return cycles;
}

function buildBillingMonths(cycleStart: Date) {
  const months: BillingMonth[] = [];

  for (let index = 0; index < 12; index += 1) {
    const start = addMonthsClamped(cycleStart, index);
    const end = addDays(addMonthsClamped(cycleStart, index + 1), -1);
    months.push({
      key: `${monthKey(start)}-${index}`,
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

function getCurrentCycleIndex(cycles: LeaseCycle[], nowDate: Date) {
  const foundIndex = cycles.findIndex(
    (cycle) => nowDate.getTime() >= cycle.start.getTime() && nowDate.getTime() <= cycle.end.getTime()
  );

  if (foundIndex >= 0) {
    return foundIndex;
  }

  return Math.max(0, cycles.length - 1);
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

function monthValueFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: BillingMonth) {
  return `${month.start.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  })} - ${month.end.toLocaleDateString(undefined, { month: "short", day: "2-digit" })}`;
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

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.message?.includes("rent_payment_allocations") === true;
}

export default function TenantPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [tenancies, setTenancies] = useState<TenantTenancy[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocationItem[]>([]);

  const [tenancyId, setTenancyId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentItem["payment_method"]>("mobile_money");
  const [referenceCode, setReferenceCode] = useState("");
  const [note, setNote] = useState("");
  const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
  const [pinnedMonthKey, setPinnedMonthKey] = useState<string | null>(null);
  const [selectedCoverageMonthKeys, setSelectedCoverageMonthKeys] = useState<string[]>([]);

  const nowDate = useMemo(() => new Date(), []);

  const selectedTenancy = useMemo(
    () => tenancies.find((item) => item.id === tenancyId) ?? null,
    [tenancies, tenancyId]
  );

  const submittedPayments = payments.filter((item) => item.status === "submitted").length;

  const tenancyPayments = useMemo(
    () => payments.filter((item) => item.tenancy_id === tenancyId),
    [payments, tenancyId]
  );

  const tenancyAllocations = useMemo(
    () => paymentAllocations.filter((item) => item.tenancy_id === tenancyId),
    [paymentAllocations, tenancyId]
  );

  const fallbackExpectedAmount = useMemo(() => {
    const latestSubmitted = tenancyPayments.find((item) => item.status === "submitted");
    return latestSubmitted ? Number(latestSubmitted.amount) : null;
  }, [tenancyPayments]);

  const expectedMonthlyAmount = useMemo(() => {
    const monthlyRent = selectedTenancy?.properties?.monthly_rent;
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
  }, [fallbackExpectedAmount, selectedTenancy]);

  const leaseCycles = useMemo(() => {
    if (!selectedTenancy?.start_date) {
      return [] as LeaseCycle[];
    }

    return buildLeaseCycles(selectedTenancy.start_date, nowDate);
  }, [nowDate, selectedTenancy?.start_date]);

  useEffect(() => {
    if (leaseCycles.length === 0) {
      setSelectedCycleIndex(0);
      return;
    }

    setSelectedCycleIndex(getCurrentCycleIndex(leaseCycles, nowDate));
  }, [leaseCycles, nowDate, tenancyId]);

  useEffect(() => {
    setPinnedMonthKey(null);
  }, [tenancyId, selectedCycleIndex]);

  const selectedCycle =
    leaseCycles[Math.min(selectedCycleIndex, Math.max(0, leaseCycles.length - 1))] ?? null;

  const billingMonths = useMemo(() => {
    if (!selectedCycle) {
      return [] as BillingMonth[];
    }

    return buildBillingMonths(selectedCycle.start);
  }, [selectedCycle]);

  useEffect(() => {
    if (billingMonths.length === 0) {
      setSelectedCoverageMonthKeys([]);
      return;
    }

    const selectedSet = new Set(selectedCoverageMonthKeys);
    const filteredKeys = billingMonths
      .map((month) => month.key)
      .filter((key) => selectedSet.has(key));

    if (filteredKeys.length > 0 && filteredKeys.length === selectedCoverageMonthKeys.length) {
      return;
    }

    const currentMonth = billingMonths.find(
      (month) => nowDate.getTime() >= month.start.getTime() && nowDate.getTime() <= month.end.getTime()
    );

    if (filteredKeys.length > 0) {
      setSelectedCoverageMonthKeys(filteredKeys);
      return;
    }

    setSelectedCoverageMonthKeys(currentMonth ? [currentMonth.key] : [billingMonths[0].key]);
  }, [billingMonths, nowDate, selectedCoverageMonthKeys]);

  const selectedCoverageMonths = useMemo(() => {
    const monthMap = new Map(billingMonths.map((month) => [month.key, month]));
    return selectedCoverageMonthKeys
      .map((key) => monthMap.get(key) ?? null)
      .filter((month): month is BillingMonth => month != null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [billingMonths, selectedCoverageMonthKeys]);

  const selectedCoverageIndexes = useMemo(
    () =>
      selectedCoverageMonths
        .map((month) => billingMonths.findIndex((item) => item.key === month.key))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b),
    [billingMonths, selectedCoverageMonths]
  );

  const hasContiguousCoverage = useMemo(() => {
    if (selectedCoverageIndexes.length <= 1) {
      return true;
    }

    for (let index = 1; index < selectedCoverageIndexes.length; index += 1) {
      if (selectedCoverageIndexes[index] - selectedCoverageIndexes[index - 1] !== 1) {
        return false;
      }
    }

    return true;
  }, [selectedCoverageIndexes]);

  const derivedPeriodStart = selectedCoverageMonths[0] ? formatIsoDate(selectedCoverageMonths[0].start) : "";
  const derivedPeriodEnd =
    selectedCoverageMonths[selectedCoverageMonths.length - 1]
      ? formatIsoDate(selectedCoverageMonths[selectedCoverageMonths.length - 1].end)
      : "";
  const derivedPaymentMonth = selectedCoverageMonths[0]
    ? `${monthValueFromDate(selectedCoverageMonths[0].start)}-01`
    : "";

  const enteredAmount = Number(amount);

  const previewAllocations = useMemo(
    () =>
      allocateMonthAmounts(
        Number.isFinite(enteredAmount) && enteredAmount > 0 ? enteredAmount : 0,
        selectedCoverageMonths.length,
        expectedMonthlyAmount
      ),
    [enteredAmount, expectedMonthlyAmount, selectedCoverageMonths.length]
  );

  const timelineMonths = useMemo(() => {
    if (!selectedCycle || billingMonths.length === 0) {
      return [] as BillingMonthView[];
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
          periodStart:
            allocation.rent_payments?.[0]?.payment_period_start ?? formatIsoDate(matchedMonth.start),
          periodEnd:
            allocation.rent_payments?.[0]?.payment_period_end ?? formatIsoDate(matchedMonth.end),
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

      const allocations = allocateMonthAmounts(
        amountValue,
        overlappingMonths.length,
        expectedMonthlyAmount
      );

      for (let index = 0; index < overlappingMonths.length; index += 1) {
        const month = overlappingMonths[index];
        const splitAmount = allocations[index] ?? 0;
        monthPaidMap.set(month.key, (monthPaidMap.get(month.key) ?? 0) + splitAmount);

        const nextContribution: MonthContribution = {
          paymentId: payment.id,
          referenceCode: payment.reference_code,
          splitAmount,
          periodStart: payment.payment_period_start,
          periodEnd: payment.payment_period_end,
        };

        monthContributionMap.set(month.key, [
          ...(monthContributionMap.get(month.key) ?? []),
          nextContribution,
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

  const timelineCurrency = selectedTenancy?.properties?.currency || currency || "USD";

  const pinnedMonth = useMemo(
    () => timelineMonths.find((month) => month.key === pinnedMonthKey) ?? null,
    [pinnedMonthKey, timelineMonths]
  );

  const timelineLegend = [
    {
      key: "not_covered",
      label: "Not covered",
      className: "border-slate-700 bg-slate-800/70 text-slate-200",
    },
    {
      key: "paid",
      label: "Covered and paid",
      className: "border-emerald-500/60 bg-emerald-500/20 text-emerald-100",
    },
    {
      key: "partial",
      label: "Covered but partial",
      className: "border-amber-500/60 bg-amber-500/20 text-amber-100",
    },
    {
      key: "unpaid",
      label: "Covered but unpaid",
      className: "border-rose-500/60 bg-rose-500/20 text-rose-100",
    },
  ] as const;

  const loadData = useCallback(
    async (userId: string, preferredTenancyId = "") => {
      setLoading(true);

      const [tenanciesRes, paymentsRes, allocationsRes] = await Promise.all([
        supabase
          .from("tenancies")
          .select(
            "id, start_date, unit_label, landlord_id, property_id, properties(title, currency, monthly_rent)"
          )
          .eq("tenant_user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("rent_payments")
          .select(
            "id, tenancy_id, amount, currency, payment_month, payment_period_start, payment_period_end, payment_method, reference_code, note, status, landlord_note, created_at, reviewed_at, properties(title)"
          )
          .eq("tenant_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("rent_payment_allocations")
          .select(
            "id, payment_id, tenancy_id, tenant_user_id, landlord_id, property_id, lease_month_key, allocated_amount, expected_amount_snapshot, allocation_method, created_at, rent_payments(status, reference_code, payment_period_start, payment_period_end)"
          )
          .eq("tenant_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(600),
      ]);

      const activeTenancies = (tenanciesRes.data as TenantTenancy[] | null) ?? [];
      setTenancies(activeTenancies);
      setPayments((paymentsRes.data as PaymentItem[] | null) ?? []);

      if (allocationsRes.error) {
        if (!isMissingRelationError(allocationsRes.error)) {
          setStatus(allocationsRes.error.message || "Failed to load payment allocations.");
        }
        setPaymentAllocations([]);
      } else {
        const rawRows =
          (allocationsRes.data as Array<{
            id: string;
            payment_id: string;
            tenancy_id: string;
            tenant_user_id: string;
            landlord_id: string;
            property_id: string;
            lease_month_key: string;
            allocated_amount: number;
            expected_amount_snapshot: number | null;
            allocation_method: "equal_split" | "sequential_fill";
            created_at: string;
            rent_payments: Array<{
              status: "submitted" | "approved" | "rejected";
              reference_code: string;
              payment_period_start: string;
              payment_period_end: string;
            }> | null;
          }> | null) ?? [];

        setPaymentAllocations(rawRows.map((row) => ({ ...row })));
      }

      const nextTenancy =
        activeTenancies.find((item) => item.id === preferredTenancyId) ??
        activeTenancies[0] ??
        null;

      if (nextTenancy) {
        setTenancyId(nextTenancy.id);
        setCurrency(nextTenancy.properties?.currency || "USD");
        if (nextTenancy.properties?.monthly_rent != null) {
          setAmount(String(nextTenancy.properties.monthly_rent));
        }
      }

      setLoading(false);
    },
    []
  );

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

  const handleTenancyChange = (nextTenancyId: string) => {
    setTenancyId(nextTenancyId);
    const tenancy = tenancies.find((item) => item.id === nextTenancyId);
    if (!tenancy) {
      return;
    }

    setCurrency(tenancy.properties?.currency || "USD");
    if (!amount && tenancy.properties?.monthly_rent != null) {
      setAmount(String(tenancy.properties.monthly_rent));
    }
  };

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!selectedTenancy) {
      setStatus("Select an active tenancy before submitting payment.");
      return;
    }

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatus("Enter a valid payment amount greater than zero.");
      return;
    }

    if (!referenceCode.trim()) {
      setStatus("Reference code is required (receipt number or transaction ID).");
      return;
    }

    if (selectedCoverageMonths.length === 0) {
      setStatus("Select at least one lease month that this payment covers.");
      return;
    }

    if (!hasContiguousCoverage) {
      setStatus("Selected lease months must be contiguous with no gaps.");
      return;
    }

    if (!derivedPeriodStart || !derivedPeriodEnd || !derivedPaymentMonth) {
      setStatus("Unable to derive billing period from selected lease months.");
      return;
    }

    setSubmitting(true);

    const leaseMonthSummary = selectedCoverageMonths
      .map((month) => monthTitle(month))
      .join(" | ");
    const mergedNote = [note.trim(), `Lease months: ${leaseMonthSummary}`]
      .filter((item) => item.length > 0)
      .join("\n");

    const { data: insertedPayment, error } = await supabase
      .from("rent_payments")
      .insert({
        tenancy_id: selectedTenancy.id,
        tenant_user_id: tenantId,
        landlord_id: selectedTenancy.landlord_id,
        property_id: selectedTenancy.property_id,
        amount: amountValue,
        currency,
        payment_month: derivedPaymentMonth,
        payment_period_start: derivedPeriodStart,
        payment_period_end: derivedPeriodEnd,
        payment_method: paymentMethod,
        reference_code: referenceCode.trim(),
        note: mergedNote || null,
        status: "submitted",
      })
      .select("id")
      .single();

    if (error || !insertedPayment?.id) {
      setStatus(error?.message || "Failed to submit payment.");
      setSubmitting(false);
      return;
    }

    const allocationMethod =
      expectedMonthlyAmount != null && Number.isFinite(expectedMonthlyAmount) && expectedMonthlyAmount > 0
        ? "sequential_fill"
        : "equal_split";

    const allocationRows = selectedCoverageMonths.map((month, index) => ({
      payment_id: insertedPayment.id,
      tenancy_id: selectedTenancy.id,
      tenant_user_id: tenantId,
      landlord_id: selectedTenancy.landlord_id,
      property_id: selectedTenancy.property_id,
      lease_month_key: monthValueFromDate(month.start),
      allocated_amount: previewAllocations[index] ?? 0,
      expected_amount_snapshot: expectedMonthlyAmount,
      allocation_method: allocationMethod,
    }));

    if (allocationRows.length > 0) {
      const { error: allocationError } = await supabase
        .from("rent_payment_allocations")
        .insert(allocationRows);

      if (allocationError) {
        if (!isMissingRelationError(allocationError)) {
          await supabase
            .from("rent_payments")
            .delete()
            .eq("id", insertedPayment.id)
            .eq("tenant_user_id", tenantId);

          setStatus(allocationError.message || "Failed to save payment allocations.");
          setSubmitting(false);
          return;
        }
      }
    }

    setStatus("Payment submitted successfully. Your landlord can now review and approve it.");
    setReferenceCode("");
    setNote("");
    setSelectedCoverageMonthKeys((current) => current.slice(-1));
    await loadData(tenantId, tenancyId);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading rent payments...
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Payments</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Pay Rent</h1>
        <p className="mt-2 text-sm text-slate-300">
          Submit rent proof with a receipt number or mobile money transaction ID.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active tenancies" value={`${tenancies.length}`} />
        <StatCard label="Awaiting approval" value={`${submittedPayments}`} />
        <StatCard
          label="Approved payments"
          value={`${payments.filter((item) => item.status === "approved").length}`}
        />
      </div>

      {status ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {status}
        </p>
      ) : null}

      <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Lease payment timeline</h2>
            <p className="mt-1 text-xs text-slate-400">
              Month marks follow your tenancy cycle and each mark represents the month-end due date.
            </p>
          </div>

          {leaseCycles.length > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-2 py-1">
              <button
                type="button"
                onClick={() => setSelectedCycleIndex((value) => Math.max(0, value - 1))}
                disabled={selectedCycleIndex <= 0}
                className="rounded-xl border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-xs uppercase tracking-[0.15em] text-slate-300">
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
                className="rounded-xl border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        {!selectedTenancy ? (
          <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            Select an active tenancy to view the lease timeline.
          </p>
        ) : !selectedTenancy.start_date ? (
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

            {selectedTenancy.properties?.monthly_rent == null && fallbackExpectedAmount != null ? (
              <p className="mt-3 rounded-2xl border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Expected amount is currently using your latest submitted payment because property rent is not configured.
              </p>
            ) : null}

            {expectedMonthlyAmount == null ? (
              <p className="mt-3 rounded-2xl border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                Monthly expectation could not be resolved. Ask your landlord to set monthly rent or submit a payment amount.
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.15em]">
              {timelineLegend.map((item) => (
                <span
                  key={item.key}
                  className={`rounded-full border px-3 py-1 ${item.className}`}
                >
                  {item.label}
                </span>
              ))}
            </div>

            <div className="no-scrollbar mt-4 overflow-x-auto overflow-y-visible pb-2" onClick={() => setPinnedMonthKey(null)}>
              <div className="flex min-w-230 gap-2">
                {timelineMonths.map((month, monthIndex) => {
                  const segmentClass =
                    month.status === "paid"
                      ? "border-emerald-500/60 bg-emerald-500/20"
                      : month.status === "partial"
                        ? "border-amber-500/60 bg-amber-500/20"
                        : month.status === "unpaid"
                          ? "border-rose-500/60 bg-rose-500/20"
                          : "border-slate-700 bg-slate-800/70";

                  const monthRange = `${month.start.toLocaleDateString()} - ${month.end.toLocaleDateString()}`;
                  const isPinned = pinnedMonthKey === month.key;
                  const tooltipPositionClass =
                    monthIndex <= 1
                      ? "left-0 translate-x-0"
                      : monthIndex >= timelineMonths.length - 2
                        ? "left-auto right-0 translate-x-0"
                        : "left-1/2 -translate-x-1/2";

                  return (
                    <div key={month.key} className="group relative min-w-18 flex-1">
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

                      <div
                        className={`pointer-events-none absolute top-12 z-20 hidden w-64 rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-xl group-hover:block group-focus-within:block ${tooltipPositionClass}`}
                      >
                        <p className="font-semibold text-slate-100">{month.label} billing window</p>
                        <p className="mt-1 text-slate-400">{monthRange}</p>
                        <p className="mt-2 text-slate-300">
                          Paid: <span className="font-semibold text-slate-100">{formatMoney(month.paidAmount, timelineCurrency)}</span>
                        </p>
                        <p className="mt-1 text-slate-300">
                          Expected:{" "}
                          <span className="font-semibold text-slate-100">
                            {month.expectedAmount != null
                              ? formatMoney(month.expectedAmount, timelineCurrency)
                              : "Unavailable"}
                          </span>
                        </p>
                        {month.contributions.length > 0 ? (
                          <div className="mt-2 border-t border-slate-800 pt-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                              Contributing payment refs
                            </p>
                            <ul className="mt-1 grid gap-1">
                              {month.contributions.map((entry) => (
                                <li key={`${month.key}-${entry.paymentId}`} className="text-slate-300">
                                  <span className="font-medium text-slate-100">{entry.referenceCode}</span>{" "}
                                  <span className="text-slate-400">({formatMoney(entry.splitAmount, timelineCurrency)})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="mt-2 border-t border-slate-800 pt-2 text-slate-400">
                            No approved payments contributed to this month.
                          </p>
                        )}
                      </div>

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
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-xs text-slate-200">
                <div className="flex items-start justify-between gap-3">
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
                    className="rounded-md border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:bg-slate-800"
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form
          onSubmit={submitPayment}
          className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-6"
        >
          <h2 className="text-lg font-semibold text-white">Submit rent payment</h2>

          <label className="grid gap-2 text-sm text-slate-200">
            Tenancy
            <select
              value={tenancyId}
              onChange={(event) => handleTenancyChange(event.target.value)}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-200">
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                required
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Currency
              <input
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={8}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                required
              />
            </label>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <p>
                  Covered lease months <span className="text-xs text-slate-400">(tap all months this payment covers)</span>
                </p>
                <p className="text-xs text-slate-400">
                  {selectedCoverageMonths.length} month{selectedCoverageMonths.length === 1 ? "" : "s"} selected
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {billingMonths.map((month) => {
                  const selected = selectedCoverageMonthKeys.includes(month.key);
                  return (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => {
                        setSelectedCoverageMonthKeys((current) =>
                          current.includes(month.key)
                            ? current.filter((item) => item !== month.key)
                            : [...current, month.key]
                        );
                      }}
                      className={`rounded-2xl border px-3 py-2 text-left text-xs transition ${
                        selected
                          ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-100"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <p className="uppercase tracking-[0.16em]">{month.label}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{monthTitle(month)}</p>
                    </button>
                  );
                })}
              </div>

              {!hasContiguousCoverage && selectedCoverageMonths.length > 1 ? (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  Selected months are not contiguous. Remove gaps so the billing period is accurate.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-200">
                Billing period start
                <input
                  value={derivedPeriodStart}
                  readOnly
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-300 outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Billing period end
                <input
                  value={derivedPeriodEnd}
                  readOnly
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-300 outline-none"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
              <p className="uppercase tracking-[0.15em] text-slate-400">Allocation preview</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <p>Allocation mode: <span className="font-semibold text-slate-100">earliest months cleared first</span></p>
                <p>
                  Expected per month:{" "}
                  <span className="font-semibold text-slate-100">
                    {expectedMonthlyAmount != null
                      ? formatMoney(expectedMonthlyAmount, currency)
                      : "Unavailable"}
                  </span>
                </p>
              </div>
              {selectedCoverageMonths.length > 0 ? (
                <ul className="mt-3 grid gap-1 text-[11px] text-slate-400">
                  {selectedCoverageMonths.map((month) => {
                    const split = previewAllocations[selectedCoverageMonths.indexOf(month)] ?? 0;
                    const verdict =
                      expectedMonthlyAmount == null
                        ? split > 0
                          ? "partial"
                          : "unpaid"
                        : split >= expectedMonthlyAmount - 0.01
                          ? "paid"
                          : split > 0
                            ? "partial"
                            : "unpaid";
                    const verdictClass =
                      verdict === "paid"
                        ? "text-emerald-200"
                        : verdict === "partial"
                          ? "text-amber-200"
                          : "text-rose-200";

                    return (
                      <li key={`${month.key}-preview`} className="flex items-center justify-between gap-3">
                        <span>
                          {monthTitle(month)}{" "}
                          <span className="text-slate-500">({formatMoney(split, currency)})</span>
                        </span>
                        <span className={`font-semibold uppercase tracking-[0.13em] ${verdictClass}`}>
                          {verdict}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Method
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentItem["payment_method"])
                }
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm text-slate-200">
            Receipt / transaction reference
            <input
              value={referenceCode}
              onChange={(event) => setReferenceCode(event.target.value)}
              placeholder="e.g. MM-TRX-229190 or RCPT-3882"
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Note (optional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Add context for landlord review"
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || tenancies.length === 0}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Submitting..." : "Submit payment for approval"}
          </button>

          {tenancies.length === 0 ? (
            <p className="text-xs text-amber-300">
              You need an active tenancy before submitting rent payments.
            </p>
          ) : null}
        </form>

        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Payment history</h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No payments submitted yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3 text-sm">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">
                      {payment.currency} {Number(payment.amount).toLocaleString()} - {payment.properties?.title || "Rental"}
                    </p>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${statusClass(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatBillingPeriod(payment.payment_period_start, payment.payment_period_end)} - {formatMethod(payment.payment_method)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Ref: {payment.reference_code}</p>
                  {payment.note ? (
                    <p className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                      {payment.note}
                    </p>
                  ) : null}
                  {payment.landlord_note ? (
                    <p className="mt-2 rounded-xl border border-emerald-700/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      Landlord note: {payment.landlord_note}
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

function statusClass(status: PaymentItem["status"]) {
  switch (status) {
    case "approved":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
    case "rejected":
      return "border-rose-500/50 bg-rose-500/10 text-rose-100";
    default:
      return "border-amber-500/50 bg-amber-500/10 text-amber-100";
  }
}

function formatMethod(method: PaymentItem["payment_method"]) {
  return method.replace("_", " ");
}

function formatBillingPeriod(startDate: string, endDate: string) {
  const start = new Date(startDate).toLocaleDateString();
  const end = new Date(endDate).toLocaleDateString();
  return `${start} to ${end}`;
}
