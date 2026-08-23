"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import FadeIn from "@/components/motion/FadeIn";

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
  profiles: {
    full_name: string;
    email: string;
  } | null;
};

export default function ListingsVerificationPage() {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );

  useEffect(() => {
    loadListings();
  }, [filter]);

  const loadListings = async () => {
    setLoading(true);

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
         profiles:landlord_id(full_name, email)`
      );

    if (filter === "pending") {
      query = query.eq("status", "pending_verification");
    } else if (filter === "approved") {
      query = query.eq("status", "active");
    } else if (filter === "rejected") {
      query = query.eq("status", "draft").gt("verified", false);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (!error) {
      setListings((data as unknown as PendingListing[]) ?? []);
    }

    setLoading(false);
  };

  const handleApprove = async (listingId: string) => {
    setProcessingId(listingId);

    const { error } = await supabase
      .from("properties")
      .update({ status: "active", verified: true })
      .eq("id", listingId);

    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    }

    setProcessingId(null);
  };

  const handleReject = async (listingId: string) => {
    setProcessingId(listingId);

    const { error } = await supabase
      .from("properties")
      .update({ status: "draft", verified: false })
      .eq("id", listingId);

    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    }

    setProcessingId(null);
  };

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
          {(["pending", "approved", "rejected"] as const).map((tab) => (
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
                ? `Pending (${listings.length})`
                : tab === "approved"
                  ? "Approved"
                  : "Rejected"}
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        <div className="grid gap-4">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300">
              Loading listings...
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
                    <span className="rounded-full border border-yellow-600 px-3 py-1 text-xs uppercase tracking-[0.2em] text-yellow-300">
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

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm">
                    <p className="text-xs text-slate-400">Landlord</p>
                    <p className="mt-1 font-semibold text-slate-100">
                      {listing.profiles?.full_name || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {listing.profiles?.email || "No email"}
                    </p>
                  </div>
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
                      onClick={() => handleReject(listing.id)}
                      disabled={processingId === listing.id}
                      className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {processingId === listing.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </FadeIn>
  );
}
