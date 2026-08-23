"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
    payout_details: any;
    created_at: string;
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
  const router = useRouter();
  const [detail, setDetail] = useState<LandlordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadDetail = async () => {
      const [profileRes, landlordRes, docsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, location, email")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("landlord_profiles")
          .select("ownership_type, verification_status, payout_method, payout_details, created_at")
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

      if (profileRes.error || landlordRes.error || docsRes.error) {
        setStatus("Failed to load landlord details");
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

  const handleApprove = async () => {
    setIsSubmitting(true);
    setStatus(null);

    try {
      const { error } = await supabase.from("landlord_profiles").update({
        verification_status: "approved",
      }).eq("user_id", userId);

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Landlord approved successfully");
      setTimeout(() => {
        router.push("/dashboards/admin/landlords");
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setStatus(null);

    try {
      const { error } = await supabase.from("landlord_profiles").update({
        verification_status: "rejected",
      }).eq("user_id", userId);

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Landlord rejected");
      setTimeout(() => {
        router.push("/dashboards/admin/landlords");
      }, 1500);
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
      <div className="rounded-3xl border border-slate-900 bg-slate-900/50 p-8 text-center">
        <p className="text-sm text-slate-300">Landlord not found.</p>
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
        <div className={`rounded-2xl px-4 py-3 text-sm ${
          status.includes("successfully") || status.includes("rejected")
            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
            : "border border-rose-500/40 bg-rose-500/10 text-rose-100"
        }`}>
          {status}
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
            onClick={handleApprove}
            disabled={isSubmitting}
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Approving..." : "Approve Landlord"}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="rounded-2xl border border-rose-600 px-6 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Rejecting..." : "Reject"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          This landlord has already been {detail.landlord.verification_status}.
        </div>
      )}
    </section>
  );
}
