"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import RejectDialog from "@/components/admin/RejectDialog";

type LandlordDetail = {
  profile: {
    full_name: string;
    phone: string;
    location: string;
    email?: string;
  };
  landlord: {
    ownership_type: string;
    verification_status: string;
    payout_method: string;
    payout_details: { details?: string } | null;
    created_at: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
  };
  documents: Array<{
    id: string;
    file_name: string;
    file_path: string;
    created_at: string;
  }>;
};

type LandlordDetailViewerProps = {
  userId: string;
};

export default function LandlordDetailViewer({ userId }: LandlordDetailViewerProps) {
  const [detail, setDetail] = useState<LandlordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  // undefined = no decision made yet; null = no other pending applications.
  const [nextPendingId, setNextPendingId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let isActive = true;

    const loadDetail = async () => {
      // Reset per-applicant state; "Review next" reuses this component with a new userId.
      setLoading(true);
      setStatus(null);
      setRejectOpen(false);
      setNextPendingId(undefined);

      const [profileRes, landlordRes, docsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, location, email")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("landlord_profiles")
          .select("ownership_type, verification_status, payout_method, payout_details, created_at, rejection_reason, reviewed_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("landlord_documents")
          .select("id, file_name, file_path, created_at")
          .eq("user_id", userId),
      ]);

      if (!isActive) {
        return;
      }

      const loadError = profileRes.error || landlordRes.error || docsRes.error;
      if (loadError) {
        console.error("Failed to load landlord details:", loadError);
        setStatus({
          tone: "error",
          text: `Failed to load landlord details: ${loadError.message}`,
        });
        setLoading(false);
        return;
      }

      setDetail({
        profile: profileRes.data || { full_name: "", phone: "", location: "", email: "" },
        landlord: landlordRes.data || {
          ownership_type: "",
          verification_status: "not_started",
          payout_method: "",
          payout_details: null,
          created_at: "",
          rejection_reason: null,
          reviewed_at: null,
        },
        documents: docsRes.data || [],
      });
      setLoading(false);
    };

    loadDetail();

    return () => {
      isActive = false;
    };
  }, [userId]);

  const decide = async (decision: "approved" | "rejected", reason?: string) => {
    setIsSubmitting(true);
    setStatus(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const reviewedAt = new Date().toISOString();
      const rejectionReason = decision === "rejected" ? reason ?? null : null;

      const { error } = await supabase
        .from("landlord_profiles")
        .update({
          verification_status: decision,
          rejection_reason: rejectionReason,
          reviewed_at: reviewedAt,
          reviewed_by: authData.user?.id ?? null,
        })
        .eq("user_id", userId);

      if (error) {
        setStatus({ tone: "error", text: error.message });
        return;
      }

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              landlord: {
                ...prev.landlord,
                verification_status: decision,
                rejection_reason: rejectionReason,
                reviewed_at: reviewedAt,
              },
            }
          : prev
      );
      setRejectOpen(false);
      setStatus({
        tone: "success",
        text:
          decision === "approved"
            ? "Landlord approved."
            : "Landlord rejected. They will see your reason.",
      });

      // Oldest remaining pending application, so the admin can keep working the queue.
      const { data: next } = await supabase
        .from("landlord_profiles")
        .select("user_id")
        .eq("verification_status", "pending")
        .neq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setNextPendingId(next?.user_id ?? null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading landlord details...
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        className={`rounded-3xl border p-8 text-center ${
          status?.tone === "error"
            ? "border-rose-900/60 bg-rose-950/30"
            : "border-slate-900 bg-slate-900/50"
        }`}
      >
        <p className={`text-sm ${status?.tone === "error" ? "text-rose-200" : "text-slate-300"}`}>
          {status?.tone === "error" ? status.text : "Landlord not found."}
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Landlord Review
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {detail.profile.full_name || "Unknown"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {detail.profile.email || "Email not provided"}
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] ${
            detail.landlord.verification_status === "approved"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : detail.landlord.verification_status === "pending"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                : "border-rose-500/40 bg-rose-500/10 text-rose-100"
          }`}>
            {detail.landlord.verification_status}
          </div>
        </div>
      </header>

      {status ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border border-rose-500/40 bg-rose-500/10 text-rose-100"
          }`}
        >
          <span>{status.text}</span>
          {status.tone === "success" && nextPendingId !== undefined ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboards/admin/landlords?status=pending"
                className="rounded-xl border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
              >
                Back to pending
              </Link>
              {nextPendingId ? (
                <Link
                  href={`/dashboards/admin/landlords/${nextPendingId}`}
                  className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Review next pending →
                </Link>
              ) : (
                <span className="text-xs text-emerald-200/80">Queue clear</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {detail.landlord.verification_status === "rejected" && detail.landlord.rejection_reason ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Rejection reason</p>
          <p className="mt-1 whitespace-pre-line">{detail.landlord.rejection_reason}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Profile Information</h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Full Name
              </dt>
              <dd className="mt-1 text-slate-100">
                {detail.profile.full_name || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Phone
              </dt>
              <dd className="mt-1 text-slate-100">
                {detail.profile.phone || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Location
              </dt>
              <dd className="mt-1 text-slate-100">
                {detail.profile.location || "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Ownership Verification */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">
            Ownership Information
          </h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Ownership Type
              </dt>
              <dd className="mt-1 capitalize text-slate-100">
                {detail.landlord.ownership_type || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Documents Uploaded
              </dt>
              <dd className="mt-1 text-slate-100">
                {detail.documents.length} file(s)
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Submitted
              </dt>
              <dd className="mt-1 text-slate-100">
                {new Date(detail.landlord.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Payout Information */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">Payout Details</h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Method
              </dt>
              <dd className="mt-1 capitalize text-slate-100">
                {detail.landlord.payout_method || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-slate-400">
                Account Info
              </dt>
              <dd className="mt-1 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                {detail.landlord.payout_details?.details
                  ? `${detail.landlord.payout_details.details.substring(0, 50)}...`
                  : "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Documents */}
        <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">
            Verification Documents
          </h2>
          {detail.documents.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {detail.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-slate-200">{doc.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`/api/landlord/documents/${doc.id}`}
                    className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 hover:text-slate-200"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No documents uploaded.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {detail.landlord.verification_status === "pending" ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => decide("approved")}
            disabled={isSubmitting}
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && !rejectOpen ? "Approving..." : "Approve Landlord"}
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={isSubmitting}
            className="rounded-2xl border border-rose-600 px-6 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          {detail.landlord.verification_status === "not_started"
            ? "This landlord has not submitted an application yet."
            : `This landlord has been ${detail.landlord.verification_status}${
                detail.landlord.reviewed_at
                  ? ` on ${new Date(detail.landlord.reviewed_at).toLocaleDateString()}`
                  : ""
              }.`}
        </div>
      )}

      <RejectDialog
        open={rejectOpen}
        subject={detail.profile.full_name || "this landlord"}
        submitting={isSubmitting}
        onCancel={() => setRejectOpen(false)}
        onConfirm={(reason) => decide("rejected", reason)}
      />
    </section>
  );
}
