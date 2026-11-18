"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import FadeIn from "@/components/motion/FadeIn";

type PropertyDraft = {
  id?: string;
  title: string;
  description: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  furnished: boolean;
  parking: boolean;
  pet_policy: string;
  country: string;
  city: string;
  area: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  monthly_rent: number;
  currency: string;
  security_deposit: number;
  lease_duration_months: number;
  available_from: string;
  max_occupancy: number;
};

type ListingWizardProps = {
  propertyId?: string;
  onComplete?: (propertyId: string) => void;
};

const INITIAL_DRAFT: PropertyDraft = {
  title: "",
  description: "",
  property_type: "apartment",
  bedrooms: 1,
  bathrooms: 1,
  furnished: false,
  parking: false,
  pet_policy: "not_allowed",
  country: "",
  city: "",
  area: "",
  address: "",
  latitude: null,
  longitude: null,
  monthly_rent: 0,
  currency: "USD",
  security_deposit: 0,
  lease_duration_months: 12,
  available_from: new Date().toISOString().split("T")[0],
  max_occupancy: 2,
};

export default function ListingWizard({
  propertyId,
  onComplete,
}: ListingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [draft, setDraft] = useState<PropertyDraft>(INITIAL_DRAFT);
  const [loading, setLoading] = useState(propertyId ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");

  // Load existing property if editing
  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);

        if (propertyId) {
          const { data: property, error: fetchError } = await supabase
            .from("properties")
            .select("*")
            .eq("id", propertyId)
            .eq("owner_id", data.user.id)
            .single();

          if (fetchError) {
            setError("Property not found");
            return;
          }

          if (property) {
            setDraft({
              id: property.id,
              title: property.title || "",
              description: property.description || "",
              property_type: property.property_type || "apartment",
              bedrooms: property.bedrooms || 1,
              bathrooms: property.bathrooms || 1,
              furnished: property.furnished || false,
              parking: property.parking || false,
              pet_policy: property.pet_policy || "not_allowed",
              country: property.country || "",
              city: property.city || "",
              area: property.area || "",
              address: property.address || "",
              latitude: property.latitude || null,
              longitude: property.longitude || null,
              monthly_rent: property.monthly_rent || 0,
              currency: property.currency || "USD",
              security_deposit: property.security_deposit || 0,
              lease_duration_months: property.lease_duration_months || 12,
              available_from: property.available_from || INITIAL_DRAFT.available_from,
              max_occupancy: property.max_occupancy || 2,
            });
          }
        }
      }
      setLoading(false);
    };

    loadData();
  }, [propertyId]);

  const updateDraft = (updates: Partial<PropertyDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!draft.title.trim()) {
        setError("Property name is required");
        setSaving(false);
        return;
      }

      if (draft.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            title: draft.title,
            description: draft.description,
            property_type: draft.property_type,
            bedrooms: draft.bedrooms,
            bathrooms: draft.bathrooms,
            furnished: draft.furnished,
            parking: draft.parking,
            pet_policy: draft.pet_policy,
            country: draft.country,
            city: draft.city,
            area: draft.area,
            address: draft.address,
            latitude: draft.latitude,
            longitude: draft.longitude,
            monthly_rent: draft.monthly_rent,
            currency: draft.currency,
            security_deposit: draft.security_deposit,
            lease_duration_months: draft.lease_duration_months,
            available_from: draft.available_from,
            max_occupancy: draft.max_occupancy,
            status: "draft",
          })
          .eq("id", draft.id)
          .eq("owner_id", userId);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { data: created, error: createError } = await supabase
          .from("properties")
          .insert({
            owner_id: userId,
            landlord_id: userId,
            title: draft.title,
            description: draft.description,
            property_type: draft.property_type,
            bedrooms: draft.bedrooms,
            bathrooms: draft.bathrooms,
            furnished: draft.furnished,
            parking: draft.parking,
            pet_policy: draft.pet_policy,
            country: draft.country,
            city: draft.city,
            area: draft.area,
            address: draft.address,
            latitude: draft.latitude,
            longitude: draft.longitude,
            monthly_rent: draft.monthly_rent,
            currency: draft.currency,
            security_deposit: draft.security_deposit,
            lease_duration_months: draft.lease_duration_months,
            available_from: draft.available_from,
            max_occupancy: draft.max_occupancy,
            status: "draft",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        if (created) {
          setDraft((prev) => ({ ...prev, id: created.id }));
        }
      }

      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  const handleSubmitForVerification = async () => {
    if (!draft.id) {
      setError("Please save draft first");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("properties")
        // Resubmitting after a rejection clears the previous reason.
        .update({ status: "pending_verification", rejection_reason: null })
        .eq("id", draft.id)
        .eq("owner_id", userId);

      if (updateError) throw updateError;

      if (onComplete) {
        onComplete(draft.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading listing...
      </div>
    );
  }

  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl">
        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition ${
                  step === currentStep
                    ? "bg-slate-100 text-slate-950"
                    : step < currentStep
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-700 text-slate-400"
                }`}
              >
                {step < currentStep ? "✓" : step}
              </div>
              {step < 5 && (
                <div
                  className={`mx-2 h-1 w-8 transition ${
                    step < currentStep ? "bg-emerald-600" : "bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Basic Information</h2>

            <label className="grid gap-2 text-sm text-slate-200">
              Property name *
              <input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                placeholder="Riverstone Apartments"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Description
              <textarea
                value={draft.description}
                onChange={(e) => updateDraft({ description: e.target.value })}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                placeholder="Describe your property..."
                rows={4}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Property type
                <select
                  value={draft.property_type}
                  onChange={(e) => updateDraft({ property_type: e.target.value })}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                >
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="studio">Studio</option>
                  <option value="villa">Villa</option>
                  <option value="townhouse">Townhouse</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Bedrooms
                <input
                  type="number"
                  min="0"
                  value={draft.bedrooms}
                  onChange={(e) =>
                    updateDraft({ bedrooms: parseInt(e.target.value) || 0 })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Bathrooms
                <input
                  type="number"
                  min="0"
                  value={draft.bathrooms}
                  onChange={(e) =>
                    updateDraft({ bathrooms: parseInt(e.target.value) || 0 })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Max occupancy
                <input
                  type="number"
                  min="1"
                  value={draft.max_occupancy}
                  onChange={(e) =>
                    updateDraft({ max_occupancy: parseInt(e.target.value) || 1 })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.furnished}
                  onChange={(e) => updateDraft({ furnished: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Furnished
              </label>

              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.parking}
                  onChange={(e) => updateDraft({ parking: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Parking available
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Pet policy
              <select
                value={draft.pet_policy}
                onChange={(e) => updateDraft({ pet_policy: e.target.value })}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              >
                <option value="not_allowed">Not allowed</option>
                <option value="cats">Cats only</option>
                <option value="dogs">Dogs only</option>
                <option value="all">Cats and dogs</option>
              </select>
            </label>
          </div>
        )}

        {/* Step 2: Location */}
        {currentStep === 2 && (
          <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Location</h2>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Country
                <input
                  value={draft.country}
                  onChange={(e) => updateDraft({ country: e.target.value })}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                  placeholder="Uganda"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                City
                <input
                  value={draft.city}
                  onChange={(e) => updateDraft({ city: e.target.value })}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                  placeholder="Kampala"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Area / District
              <input
                value={draft.area}
                onChange={(e) => updateDraft({ area: e.target.value })}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                placeholder="Kololo"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Full address
              <textarea
                value={draft.address}
                onChange={(e) => updateDraft({ address: e.target.value })}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                placeholder="123 Main Street, Kampala"
                rows={3}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Latitude (optional)
                <input
                  type="number"
                  step="0.0001"
                  value={draft.latitude || ""}
                  onChange={(e) =>
                    updateDraft({
                      latitude: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                  placeholder="0.3476"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Longitude (optional)
                <input
                  type="number"
                  step="0.0001"
                  value={draft.longitude || ""}
                  onChange={(e) =>
                    updateDraft({
                      longitude: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                  placeholder="32.5825"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {currentStep === 3 && (
          <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Pricing & Lease</h2>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Monthly rent
                <input
                  type="number"
                  min="0"
                  value={draft.monthly_rent}
                  onChange={(e) =>
                    updateDraft({ monthly_rent: parseInt(e.target.value) || 0 })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                  placeholder="500000"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Currency
                <select
                  value={draft.currency}
                  onChange={(e) => updateDraft({ currency: e.target.value })}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                >
                  <option value="USD">USD</option>
                  <option value="UGX">UGX</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Security deposit
              <input
                type="number"
                min="0"
                value={draft.security_deposit}
                onChange={(e) =>
                  updateDraft({ security_deposit: parseInt(e.target.value) || 0 })
                }
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                placeholder="500000"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Lease duration (months)
                <input
                  type="number"
                  min="1"
                  value={draft.lease_duration_months}
                  onChange={(e) =>
                    updateDraft({
                      lease_duration_months: parseInt(e.target.value) || 12,
                    })
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Available from
                <input
                  type="date"
                  value={draft.available_from}
                  onChange={(e) => updateDraft({ available_from: e.target.value })}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Photos */}
        {currentStep === 4 && (
          <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Photos</h2>

            <p className="text-sm text-slate-300">
              Prepare at least 5 clear photos that cover exterior, living spaces,
              bathrooms, and key amenities. Add and manage your gallery from the
              listing detail screen once this draft is saved.
            </p>

            <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/40 px-6 py-8 text-center">
              <p className="text-sm text-slate-300">Photo checklist</p>
              <p className="mt-1 text-xs text-slate-500">
                Exterior, entrance, bedroom, bathroom, and kitchen/common area
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Review & Submit</h2>

            <div className="grid gap-4 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Property
                </p>
                <p className="mt-2 font-semibold text-white">{draft.title}</p>
                <p className="mt-1 text-slate-400">{draft.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Type
                  </p>
                  <p className="mt-2 capitalize text-white">{draft.property_type}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {draft.bedrooms} bed, {draft.bathrooms} bath
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Location
                  </p>
                  <p className="mt-2 text-white">
                    {draft.city}, {draft.country}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{draft.area}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Pricing
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {draft.currency} {draft.monthly_rent.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Deposit: {draft.currency} {draft.security_deposit.toLocaleString()}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Once submitted, your listing will be reviewed by our team before going
              live. You'll be notified when it's approved.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !draft.title.trim()) {
                  setError("Property name is required");
                  return;
                }
                setCurrentStep(currentStep + 1);
              }}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitForVerification}
              disabled={saving || !draft.id}
              className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Submitting..." : "Submit for Verification"}
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/40"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>
    </FadeIn>
  );
}
