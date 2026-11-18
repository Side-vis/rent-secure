"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import ListingWizard from "@/components/landlord/ListingWizard";
import ListingUnitsManager from "@/components/landlord/ListingUnitsManager";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PropertySummary = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: string;
  property_type: string | null;
  monthly_rent: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_occupancy: number | null;
  furnished: boolean | null;
  parking: boolean | null;
  pet_policy: string | null;
  lease_duration_months: number | null;
  available_from: string | null;
  security_deposit: number | null;
  rejection_reason: string | null;
};

type ListingTab = "details" | "units";

function ListingEditorContent({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ListingTab>("details");
  const [isEditing, setIsEditing] = useState(false);

  const reloadProperty = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("properties")
      .select(
        "id, title, description, address, city, country, status, property_type, monthly_rent, currency, bedrooms, bathrooms, max_occupancy, furnished, parking, pet_policy, lease_duration_months, available_from, security_deposit, rejection_reason"
      )
      .eq("id", propertyId)
      .or(`owner_id.eq.${user.id},landlord_id.eq.${user.id}`)
      .maybeSingle();

    if (error || !data) {
      setProperty(null);
      return;
    }

    setProperty(data as PropertySummary);
  };

  useEffect(() => {
    let isActive = true;

    const loadProperty = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!isActive) {
        return;
      }

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, title, description, address, city, country, status, property_type, monthly_rent, currency, bedrooms, bathrooms, max_occupancy, furnished, parking, pet_policy, lease_duration_months, available_from, security_deposit, rejection_reason"
        )
        .eq("id", propertyId)
        .or(`owner_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (error || !data) {
        setProperty(null);
        setLoading(false);
        return;
      }

      setProperty(data as PropertySummary);
      setLoading(false);
    };

    loadProperty();

    return () => {
      isActive = false;
    };
  }, [propertyId, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading listing details...
      </div>
    );
  }

  if (!property) {
    return (
      <section className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <h1 className="text-2xl font-semibold text-white">Listing not found</h1>
        <p className="text-sm text-slate-300">
          The listing does not exist or you do not have access to it.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboards/landlord/listings")}
          className="w-fit rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/40"
        >
          Back to listings
        </button>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="text-xs uppercase tracking-[0.2em] text-slate-400 transition hover:text-slate-200"
            >
              ← Back
            </button>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {property.title}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Review listing details and manage room inventory.
            </p>
          </div>
          {activeTab === "details" && (
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              {isEditing ? "Close edit" : "Edit listing"}
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-2 rounded-3xl border border-slate-900 bg-slate-900/40 p-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("details");
          }}
          className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "details"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-300 hover:bg-slate-800/40"
          }`}
        >
          Listing Details
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("units");
            setIsEditing(false);
          }}
          className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "units"
              ? "bg-slate-100 text-slate-950"
              : "text-slate-300 hover:bg-slate-800/40"
          }`}
        >
          Rooms & Units
        </button>
      </div>

      {property.status === "rejected" ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <p className="font-semibold">This listing was not approved</p>
          {property.rejection_reason ? (
            <p className="mt-1 whitespace-pre-line text-rose-100/90">{property.rejection_reason}</p>
          ) : null}
          <p className="mt-2 text-xs text-rose-200/80">
            Edit the listing to fix the issue, then submit it for verification again.
          </p>
        </div>
      ) : null}

      {activeTab === "details" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold capitalize text-white">
                {property.status === "pending_verification"
                  ? "Pending verification"
                  : property.status === "rejected"
                    ? "Changes requested"
                    : property.status}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Monthly rent
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {property.monthly_rent == null
                  ? "Not set"
                  : `${property.currency ?? "USD"} ${property.monthly_rent.toLocaleString()}`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Property type
              </p>
              <p className="mt-2 text-lg font-semibold capitalize text-white">
                {property.property_type ?? "Not set"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Beds / Baths
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {property.bedrooms ?? 0} / {property.bathrooms ?? 0}
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Address
              </p>
              <p className="mt-2 text-slate-200">
                {property.address ? property.address : "Address not set"}
              </p>
              {(property.city || property.country) && (
                <p className="mt-1 text-slate-400">
                  {property.city ?? ""}
                  {property.city && property.country ? ", " : ""}
                  {property.country ?? ""}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Lease and amenities
              </p>
              <p>
                Deposit: {property.currency ?? "USD"}{" "}
                {property.security_deposit?.toLocaleString() ?? "Not set"}
              </p>
              <p>
                Lease: {property.lease_duration_months ?? "Not set"} months
              </p>
              <p>
                Available from: {property.available_from ?? "Not set"}
              </p>
              <p>
                Max occupancy: {property.max_occupancy ?? "Not set"}
              </p>
              <p>
                Furnished: {property.furnished ? "Yes" : "No"} | Parking:{" "}
                {property.parking ? "Yes" : "No"}
              </p>
              <p>Pets: {property.pet_policy ?? "Not set"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Description
            </p>
            <p className="mt-2 text-slate-200">
              {property.description?.trim()
                ? property.description
                : "No description provided."}
            </p>
          </div>

          {isEditing && (
            <ListingWizard
              propertyId={propertyId}
              onComplete={async () => {
                setIsEditing(false);
                await reloadProperty();
              }}
            />
          )}
        </>
      ) : (
        <ListingUnitsManager
          propertyId={propertyId}
          currency={property.currency ?? "USD"}
        />
      )}
    </section>
  );
}

export default async function ListingEditorPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">Loading...</div>}>
      <ListingEditorContent propertyId={id} />
    </Suspense>
  );
}
