"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type LandlordPayment = {
  id: string;
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

type PaymentFilter = "all" | "submitted" | "approved" | "rejected";

export default function LandlordPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [payments, setPayments] = useState<LandlordPayment[]>([]);
  const [filter, setFilter] = useState<PaymentFilter>("submitted");
  const [landlordId, setLandlordId] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesByPaymentId, setNotesByPaymentId] = useState<Record<string, string>>({});

  const loadPayments = async (userId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("rent_payments")
      .select(
        "id, amount, currency, payment_month, payment_period_start, payment_period_end, payment_method, reference_code, note, status, landlord_note, created_at, reviewed_at, tenant_profile:tenant_user_id(full_name, email), properties(title), tenancies:tenancy_id(unit_label)"
      )
      .eq("landlord_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setStatusMessage(error.message || "Failed to load payments.");
      setPayments([]);
      setLoading(false);
      return;
    }

    const rows = (data as LandlordPayment[] | null) ?? [];
    setPayments(rows);
    setNotesByPaymentId(
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
      await loadPayments(user.id);
    };

    init();

    return () => {
      active = false;
    };
  }, [router]);

  const visiblePayments = useMemo(() => {
    if (filter === "all") {
      return payments;
    }
    return payments.filter((item) => item.status === filter);
  }, [filter, payments]);

  const pendingCount = payments.filter((item) => item.status === "submitted").length;

  const reviewPayment = async (
    paymentId: string,
    nextStatus: "approved" | "rejected"
  ) => {
    setStatusMessage(null);
    setUpdatingId(paymentId);

    const { error } = await supabase
      .from("rent_payments")
      .update({
        status: nextStatus,
        landlord_note: notesByPaymentId[paymentId]?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: landlordId,
      })
      .eq("id", paymentId)
      .eq("landlord_id", landlordId)
      .eq("status", "submitted");

    if (error) {
      setStatusMessage(error.message || "Failed to update payment status.");
      setUpdatingId(null);
      return;
    }

    setStatusMessage(
      nextStatus === "approved" ? "Payment approved successfully." : "Payment rejected."
    );
    await loadPayments(landlordId);
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading payment approvals...
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-linear-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rent Collections</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Review Tenant Payments</h1>
        <p className="mt-2 text-sm text-slate-300">
          Tenants submit payment references and you approve or reject submissions.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total submissions" value={`${payments.length}`} />
        <StatCard label="Pending review" value={`${pendingCount}`} />
        <StatCard
          label="Approved"
          value={`${payments.filter((item) => item.status === "approved").length}`}
        />
        <StatCard
          label="Rejected"
          value={`${payments.filter((item) => item.status === "rejected").length}`}
        />
      </div>

      {statusMessage ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["submitted", "all", "approved", "rejected"] as PaymentFilter[]).map((item) => (
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
            {item}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        {visiblePayments.length === 0 ? (
          <p className="text-sm text-slate-400">No payments in this view yet.</p>
        ) : (
          <ul className="grid gap-4 text-sm">
            {visiblePayments.map((payment) => (
              <li
                key={payment.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">
                    {payment.tenant_profile?.full_name || payment.tenant_profile?.email || "Tenant"} - {payment.currency} {Number(payment.amount).toLocaleString()}
                  </p>
                  <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${statusClass(payment.status)}`}>
                    {payment.status}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  {payment.properties?.title || "Property"}
                  {payment.tenancies?.unit_label ? ` - ${payment.tenancies.unit_label}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatBillingPeriod(payment.payment_period_start, payment.payment_period_end)} - {payment.payment_method.replace("_", " ")}
                </p>
                <p className="mt-1 text-xs text-slate-400">Reference: {payment.reference_code}</p>

                {payment.note ? (
                  <p className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                    Tenant note: {payment.note}
                  </p>
                ) : null}

                {payment.status === "submitted" ? (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-2 text-xs text-slate-300">
                      Review note (optional)
                      <textarea
                        value={notesByPaymentId[payment.id] || ""}
                        onChange={(event) =>
                          setNotesByPaymentId((current) => ({
                            ...current,
                            [payment.id]: event.target.value,
                          }))
                        }
                        rows={2}
                        className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                        placeholder="Add reason, confirmation details, or next action"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => reviewPayment(payment.id, "approved")}
                        disabled={updatingId === payment.id}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {updatingId === payment.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewPayment(payment.id, "rejected")}
                        disabled={updatingId === payment.id}
                        className="rounded-xl border border-rose-500/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {updatingId === payment.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : payment.landlord_note ? (
                  <p className="mt-3 rounded-xl border border-cyan-700/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                    Review note: {payment.landlord_note}
                  </p>
                ) : null}
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

function statusClass(status: LandlordPayment["status"]) {
  switch (status) {
    case "approved":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
    case "rejected":
      return "border-rose-500/50 bg-rose-500/10 text-rose-100";
    default:
      return "border-amber-500/50 bg-amber-500/10 text-amber-100";
  }
}

function formatBillingPeriod(startDate: string, endDate: string) {
  const start = new Date(startDate).toLocaleDateString();
  const end = new Date(endDate).toLocaleDateString();
  return `${start} to ${end}`;
}
