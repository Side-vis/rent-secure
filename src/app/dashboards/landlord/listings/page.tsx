"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ListingWizard from "@/components/landlord/ListingWizard";

type Property = {
  id: string;
  title: string;
  address: string | null;
  status: string;
  created_at: string;
};

export default function LandlordListingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isActive) {
        return;
      }

      const user = data.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      setUserId(user.id);

      const { data: list, error } = await supabase
        .from("properties")
        .select("id, title, address, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!isActive) {
        return;
      }

      if (error) {
        setLoading(false);
        return;
      }

      setProperties(list ?? []);
      setLoading(false);
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleWizardComplete = (propertyId: string) => {
    setShowWizard(false);
    // Reload properties list
    loadPropertiesList();
  };

  const loadPropertiesList = async () => {
    const { data: list, error } = await supabase
      .from("properties")
      .select("id, title, address, status, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (!error) {
      setProperties(list ?? []);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "border-slate-600 text-slate-300";
      case "pending_verification":
        return "border-yellow-600 text-yellow-300";
      case "active":
        return "border-emerald-600 text-emerald-300";
      case "rejected":
        return "border-rose-600 text-rose-300";
      case "paused":
        return "border-orange-600 text-orange-300";
      case "archived":
        return "border-slate-700 text-slate-400";
      default:
        return "border-slate-700 text-slate-300";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading listings...
      </div>
    );
  }

  if (showWizard) {
    return (
      <section className="grid gap-6">
        <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <button
            onClick={() => setShowWizard(false)}
            className="text-xs uppercase tracking-[0.2em] text-slate-400 transition hover:text-slate-200"
          >
            ← Back to listings
          </button>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Create New Listing
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Complete the wizard to add a new property to your portfolio.
          </p>
        </header>

        <ListingWizard onComplete={handleWizardComplete} />
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Listings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Manage Listings
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Create and manage your property listings.
        </p>
      </header>

      <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            {properties.length === 0
              ? "No listings yet. Create your first one."
              : `You have ${properties.length} listing${properties.length === 1 ? "" : "s"}`}
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            + Create listing
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Your listings</h2>
        {properties.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No listings yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 text-sm">
            {properties.map((property) => (
              <li
                key={property.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3"
              >
                <div className="flex-1">
                  <p className="font-semibold text-slate-100">
                    {property.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {property.address || "Address not set"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${getStatusColor(
                      property.status
                    )}`}
                  >
                    {property.status === "pending_verification"
                      ? "Pending"
                      : property.status}
                  </span>
                  <Link
                    href={`/dashboards/landlord/listings/${property.id}`}
                    className="text-xs font-semibold text-slate-300 transition hover:text-white"
                  >
                    View details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
