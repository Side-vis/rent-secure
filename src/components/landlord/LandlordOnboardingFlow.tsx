"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getDashboardRoute, type Role } from "@/lib/roles";

const steps = [
  {
    id: 1,
    title: "Profile setup",
    description: "Tell us who manages the property and how to reach you.",
  },
  {
    id: 2,
    title: "Ownership verification",
    description: "Share proof of ownership so tenants can trust the listing.",
  },
  {
    id: 3,
    title: "Payout setup",
    description: "Add your preferred payout method for rent deposits.",
  },
  {
    id: 4,
    title: "First property",
    description: "Add your first property as a draft until verification clears.",
  },
];

type OwnershipType = "owner" | "agent";

type UploadedDoc = {
  name: string;
  path: string;
  created_at?: string;
};

export default function LandlordOnboardingFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("owner");
  const [verificationStatus, setVerificationStatus] = useState("not_started");
  const [selectedDocs, setSelectedDocs] = useState<File[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [propertyTitle, setPropertyTitle] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");

  const stepMeta = useMemo(
    () => steps.find((item) => item.id === step) ?? steps[0],
    [step]
  );

  const progressPercent = useMemo(() => {
    const safeStep = Math.min(step, steps.length);
    return Math.round(((safeStep - 1) / (steps.length - 1)) * 100);
  }, [step]);

  const canEditVerification = verificationStatus !== "approved";

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!isActive) {
        return;
      }

      if (!user) {
        router.replace("/auth/landlord");
        return;
      }

      const role = user.user_metadata?.role as Role | undefined;
      if (role && role !== "landlord") {
        router.replace(getDashboardRoute(role));
        return;
      }

      setUserId(user.id);

      // Ensure profile records exist
      const userEmail = user.email || "";
      const [profileCreateResult, landlordCreateResult] = await Promise.all([
        supabase.from("profiles").upsert({
          id: user.id,
          role: "landlord",
          email: userEmail,
        }),
        supabase.from("landlord_profiles").upsert({
          user_id: user.id,
          verification_status: "not_started",
          onboarding_step: 1,
        }),
      ]);

      if (profileCreateResult.error || landlordCreateResult.error) {
        console.error("Failed to create profile records:", {
          profileError: profileCreateResult.error,
          landlordError: landlordCreateResult.error,
        });
      }

      const [{ data: profile }, { data: landlordProfile }, { data: documents }, { data: property }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, location, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("landlord_profiles")
          .select(
            "ownership_type, verification_status, payout_method, payout_details, onboarding_step"
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("landlord_documents")
          .select("file_name, file_path, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("properties")
          .select("title, address, status, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!isActive) {
        return;
      }

      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setLocation(profile.location ?? "");
      }

      if (landlordProfile) {
        setOwnershipType(
          (landlordProfile.ownership_type as OwnershipType) ?? "owner"
        );
        setVerificationStatus(
          landlordProfile.verification_status ?? "not_started"
        );
        setPayoutMethod(landlordProfile.payout_method ?? "bank");
        if (landlordProfile.payout_details) {
          let detailsValue = "";

          if (typeof landlordProfile.payout_details === "string") {
            try {
              const parsed = JSON.parse(landlordProfile.payout_details);
              detailsValue =
                typeof parsed?.details === "string" ? parsed.details : "";
            } catch {
              detailsValue = landlordProfile.payout_details;
            }
          } else {
            detailsValue =
              typeof landlordProfile.payout_details?.details === "string"
                ? landlordProfile.payout_details.details
                : "";
          }

          setPayoutDetails(detailsValue);
        }
        if (landlordProfile.onboarding_step) {
          setStep(landlordProfile.onboarding_step);
        }
      }

      if (documents) {
        setUploadedDocs(
          documents.map((doc) => ({
            name: doc.file_name ?? "Document",
            path: doc.file_path,
            created_at: doc.created_at ?? undefined,
          }))
        );
      }

      if (property) {
        setPropertyTitle(property.title ?? "");
        setPropertyAddress(property.address ?? "");
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  const updateLandlordProfile = async (
    payload: Record<string, unknown>,
    nextStep: number
  ) => {
    if (!userId) {
      return false;
    }

    const { error } = await supabase.from("landlord_profiles").upsert({
      user_id: userId,
      onboarding_step: nextStep,
      ...payload,
    });

    if (error) {
      setStatus(error.message);
      return false;
    }

    setStep(nextStep);
    return true;
  };

  const handleProfileContinue = async () => {
    if (!userId) {
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        role: "landlord",
        full_name: fullName,
        phone,
        location,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      await updateLandlordProfile({}, 2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadDocuments = async () => {
    if (!userId || selectedDocs.length === 0 || !canEditVerification) {
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const uploads = await Promise.all(
        selectedDocs.map(async (file) => {
          const filePath = `${userId}/${Date.now()}-${file.name}`;
          const { error } = await supabase
            .storage
            .from("landlord-verifications")
            .upload(filePath, file, { upsert: true });

          if (error) {
            throw error;
          }

          const { error: recordError } = await supabase
            .from("landlord_documents")
            .insert({
              user_id: userId,
              file_path: filePath,
              file_name: file.name,
            });

          if (recordError) {
            throw recordError;
          }

          return { name: file.name, path: filePath };
        })
      );

      setUploadedDocs((prev) => [...prev, ...uploads]);
      setSelectedDocs([]);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOwnershipContinue = async () => {
    if (!canEditVerification) {
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const updated = await updateLandlordProfile(
        {
          ownership_type: ownershipType,
          verification_status: "pending",
        },
        3
      );

      if (updated) {
        setVerificationStatus("pending");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayoutContinue = async () => {
    setIsSaving(true);
    setStatus(null);

    try {
      await updateLandlordProfile(
        {
          payout_method: payoutMethod,
          payout_details: { details: payoutDetails },
        },
        4
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePropertyContinue = async () => {
    if (!userId) {
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const { error } = await supabase.from("properties").insert({
        owner_id: userId,
        title: propertyTitle,
        address: propertyAddress,
        status: "draft",
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      await updateLandlordProfile({}, 5);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Loading onboarding...
      </div>
    );
  }

  if (step > steps.length) {
    return (
      <section className="rounded-3xl border border-slate-900 bg-slate-900/50 p-8">
        <h2 className="text-2xl font-semibold text-white">
          You are ready to go
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Your onboarding is complete. We will review your ownership documents
          and notify you as soon as verification is approved.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/dashboards/landlord")}
          className="mt-6 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
        >
          Go to landlord dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Landlord onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {stepMeta.title}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {stepMeta.description}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-300">
            <p className="uppercase tracking-[0.2em] text-slate-500">
              Verification
            </p>
            <p className="mt-2 text-sm text-slate-100">
              {verificationStatus === "approved"
                ? "Approved"
                : verificationStatus === "pending"
                  ? "Pending review"
                  : "Not started"}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-4">
            {steps.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border px-3 py-2 text-center uppercase tracking-[0.2em] ${
                  item.id === step
                    ? "border-slate-500 text-slate-100"
                    : "border-slate-800"
                }`}
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>
      </header>

      {status ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {status}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <label className="grid gap-2 text-sm text-slate-200">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="Alex Johnson"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Phone number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="(555) 123-4567"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="Austin, TX"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              This helps tenants and support teams reach you quickly.
            </p>
            <button
              type="button"
              onClick={handleProfileContinue}
              disabled={!fullName || !phone || !location || isSaving}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <div>
            <p className="text-sm text-slate-300">
              Select the option that best describes your role.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(["owner", "agent"] as OwnershipType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOwnershipType(value)}
                  disabled={!canEditVerification}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                    ownershipType === value
                      ? "border-slate-500 bg-slate-950 text-white"
                      : "border-slate-800 text-slate-300 hover:border-slate-600"
                  } ${
                    !canEditVerification ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <p className="text-base font-semibold capitalize">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {value === "owner"
                      ? "You own the property and can verify directly."
                      : "You manage on behalf of the owner."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-200">Upload verification files</p>
            <p className="mt-1 text-xs text-slate-400">
              Deeds, management agreements, or recent tax statements work well.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                multiple
                disabled={!canEditVerification}
                onChange={(event) =>
                  setSelectedDocs(Array.from(event.target.files ?? []))
                }
                className="text-xs text-slate-300"
              />
              <button
                type="button"
                onClick={handleUploadDocuments}
                disabled={selectedDocs.length === 0 || isSaving || !canEditVerification}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Uploading..." : "Upload documents"}
              </button>
            </div>
            {uploadedDocs.length > 0 ? (
              <ul className="mt-4 grid gap-2 text-xs text-slate-300">
                {uploadedDocs.map((doc) => (
                  <li
                    key={doc.path}
                    className="rounded-2xl border border-slate-800 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{doc.name}</span>
                      {doc.created_at ? (
                        <span className="text-[11px] text-slate-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {!canEditVerification ? (
              <p className="mt-4 text-xs text-slate-500">
                Verification is approved, so documents are read-only.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Verification will remain pending until reviewed by an admin.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOwnershipContinue}
                disabled={isSaving || !canEditVerification}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <label className="grid gap-2 text-sm text-slate-200">
            Payout method
            <select
              value={payoutMethod}
              onChange={(event) => setPayoutMethod(event.target.value)}
              disabled={!canEditVerification}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
            >
              <option value="bank">Bank transfer</option>
              <option value="card">Debit card</option>
              <option value="paypal">PayPal</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Payout details
            <textarea
              value={payoutDetails}
              onChange={(event) => setPayoutDetails(event.target.value)}
              rows={4}
              disabled={!canEditVerification}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="Account holder, last four digits, payout email, or routing notes"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              We encrypt this data and only use it for payouts.
            </p>
            {!canEditVerification ? (
              <p className="text-xs text-slate-500">
                Approved profiles are read-only.
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePayoutContinue}
                disabled={!payoutDetails || isSaving || !canEditVerification}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-5 rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
          <label className="grid gap-2 text-sm text-slate-200">
            Property name
            <input
              value={propertyTitle}
              onChange={(event) => setPropertyTitle(event.target.value)}
              disabled={!canEditVerification}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="Riverstone Apartments"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Property address
            <input
              value={propertyAddress}
              onChange={(event) => setPropertyAddress(event.target.value)}
              disabled={!canEditVerification}
              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-slate-600 focus:ring"
              placeholder="123 Main St, Austin, TX"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              This property will stay in draft until verification is approved.
            </p>
            {!canEditVerification ? (
              <p className="text-xs text-slate-500">
                Approved profiles are read-only.
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePropertyContinue}
                disabled={!propertyTitle || !propertyAddress || isSaving || !canEditVerification}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Finish onboarding"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
