"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import FadeIn from "@/components/motion/FadeIn";
import RejectDialog from "@/components/admin/RejectDialog";

type PendingListing = {
  id: string;
  title: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  city: string;
  country: string;
  monthly_rent: number;
  currency: string;
  status: string;
  created_at: string;
  landlord_id: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
};

const FILTERS = ["pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

function parseFilter(value: string | null): Filter {
  return (FILTERS as readonly string[]).includes(value ?? "") ? (value as Filter) : "pending";
}

export default function ListingsVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300">
          Loading listings...
        </div>
      }
    >
      <ListingsVerification />
    </Suspense>
  );
}

function ListingsVerification() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get("status"));

  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingListing | null>(null);

  const setFilter = (next: Filter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "pending") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadListings = async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);

    let query = supabase
      .from("properties")
      .select(
        `id, 
         title, 
         property_type, 
         bedrooms, 
         bathrooms, 
         city, 
         country, 
         monthly_rent, 
         currency, 
         status, 
         created_at, 
         landlord_id,
         rejection_reason,
         reviewed_at,
         profiles:landlord_id(full_name, email)`
      );

    if (filter === "pending") {
      query = query.eq("status", "pending_verification");
    } else if (filter === "approved") {
      query = query.eq("status", "active");
    } else if (filter === "rejected") {
      query = query.eq("status", "rejected");
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Failed to load listings:", error);
      setLoadError("Could not load listings. Please try again.");
      setListings([]);
    } else {
      setListings((data as unknown as PendingListing[]) ?? []);
    }

    setLoading(false);
  };

  const updateListingStatus = async (
    listingId: string,
    update: { status: string; verified: boolean; rejection_reason: string | null }
  ) => {
    setProcessingId(listingId);
    setActionError(null);

    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("properties")
      .update({
        ...update,
        reviewed_at: new Date().toISOString(),
        reviewed_by: authData.user?.id ?? null,
      })
      .eq("id", listingId);

    if (error) {
      console.error("Failed to update listing:", error);
      setActionError(error.message);
    } else {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      setRejecting(null);
    }

    setProcessingId(null);
  };

  const handleApprove = (listingId: string) =>
    updateListingStatus(listingId, { status: "active", verified: true, rejection_reason: null });

  const handleReject = (listingId: string, reason: string) =>
    updateListingStatus(listingId, { status: "rejected", verified: false, rejection_reason: reason });

  return (
    <FadeIn>
      <section className="grid gap-6">
        <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Listing Verification
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Review and approve pending property listings.
          </p>
        </header>

        {/* Filter Tabs */}
        <div className="flex gap-2 rounded-3xl border border-slate-900 bg-slate-900/40 p-2">
          {FILTERS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                filter === tab
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              {tab === "pending"
                ? filter === "pending" && !loading
                  ? `Pending (${listings.length})`
                  : "Pending"
                : tab === "approved"
                  ? "Approved"
                  : "Rejected"}
            </button>
          ))}
        </div>

        {actionError ? (
          <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            Could not update listing: {actionError}
          </div>
        ) : null}

        {/* Listings Grid */}
        <div className="grid gap-4">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300">
              Loading listings...
            </div>
          ) : loadError ? (
            <div className="rounded-3xl border border-rose-900/60 bg-rose-950/30 px-6 py-8 text-center">
              <p className="text-sm text-rose-200">{loadError}</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-3xl border border-slate-900 bg-slate-900/40 px-6 py-8 text-center">
              <p className="text-sm text-slate-400">
                No listings to review in this category.
              </p>
            </div>
          ) : (
            listings.map((listing) => (
              <div
                key={listing.id}
                className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-6"
              >
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {listing.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {listing.city}, {listing.country}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                        listing.status === "active"
                          ? "border-emerald-600 text-emerald-300"
                          : listing.status === "rejected"
                            ? "border-rose-600 text-rose-300"
                            : "border-yellow-600 text-yellow-300"
                      }`}
                    >
                      {listing.status === "pending_verification"
                        ? "Pending"
                        : listing.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-xs text-slate-400">Property</p>
                      <p className="mt-1 capitalize text-slate-100">
                        {listing.property_type}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {listing.bedrooms} bed, {listing.bathrooms} bath
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-xs text-slate-400">Monthly Rent</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {listing.currency} {listing.monthly_rent.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/dashboards/admin/landlords/${listing.landlord_id}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm transition hover:border-slate-600"
                  >
                    <p className="text-xs text-slate-400">Landlord</p>
                    <p className="mt-1 font-semibold text-slate-100">
                      {listing.profiles?.full_name || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {listing.profiles?.email || "No email"}
                    </p>
                  </Link>

                  {listing.status === "rejected" && listing.rejection_reason ? (
                    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      <p className="text-xs uppercase tracking-[0.2em] text-rose-300">
                        Rejection reason
                        {listing.reviewed_at
                          ? ` · ${new Date(listing.reviewed_at).toLocaleDateString()}`
                          : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-line">{listing.rejection_reason}</p>
                    </div>
                  ) : null}
                </div>

                {/* Action Buttons */}
                {filter === "pending" && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleApprove(listing.id)}
                      disabled={processingId === listing.id}
                      className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {processingId === listing.id ? "Processing..." : "Approve"}
                    </button>

                    <button
                      onClick={() => setRejecting(listing)}
                      disabled={processingId === listing.id}
                      className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <RejectDialog
        open={rejecting !== null}
        subject={rejecting ? `"${rejecting.title}"` : "this listing"}
        submitting={rejecting !== null && processingId === rejecting.id}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && handleReject(rejecting.id, reason)}
      />
    </FadeIn>
  );
}
