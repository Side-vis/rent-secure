"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type UnitType =
  | "single"
  | "double"
  | "self_contained"
  | "studio"
  | "apartment"
  | "other";

type ListingUnit = {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: UnitType;
  monthly_rent: number | null;
  bathrooms: number | null;
  furnished: boolean;
  is_available: boolean;
  notes: string | null;
  created_at: string;
};

type UnitForm = {
  unit_number: string;
  unit_type: UnitType;
  monthly_rent: string;
  bathrooms: string;
  furnished: boolean;
  is_available: boolean;
  notes: string;
};

type ListingUnitsManagerProps = {
  propertyId: string;
  currency: string;
};

const INITIAL_FORM: UnitForm = {
  unit_number: "",
  unit_type: "single",
  monthly_rent: "",
  bathrooms: "",
  furnished: false,
  is_available: true,
  notes: "",
};

function toForm(unit: ListingUnit): UnitForm {
  return {
    unit_number: unit.unit_number,
    unit_type: unit.unit_type,
    monthly_rent:
      typeof unit.monthly_rent === "number" ? String(unit.monthly_rent) : "",
    bathrooms: typeof unit.bathrooms === "number" ? String(unit.bathrooms) : "",
    furnished: unit.furnished,
    is_available: unit.is_available,
    notes: unit.notes ?? "",
  };
}

function parseNumeric(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ListingUnitsManager({
  propertyId,
  currency,
}: ListingUnitsManagerProps) {
  const [units, setUnits] = useState<ListingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [newUnitForm, setNewUnitForm] = useState<UnitForm>(INITIAL_FORM);
  const [editForm, setEditForm] = useState<UnitForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const availableCount = useMemo(
    () => units.filter((unit) => unit.is_available).length,
    [units]
  );

  const occupiedCount = useMemo(
    () => units.filter((unit) => !unit.is_available).length,
    [units]
  );

  const loadUnits = async () => {
    const { data, error: fetchError } = await supabase
      .from("property_units")
      .select(
        "id, property_id, unit_number, unit_type, monthly_rent, bathrooms, furnished, is_available, notes, created_at"
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      if (fetchError.message.toLowerCase().includes("property_units")) {
        setTableMissing(true);
      }
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setUnits((data as ListingUnit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setTableMissing(false);
    loadUnits();
  }, [propertyId]);

  const handleCreateUnit = async () => {
    if (!newUnitForm.unit_number.trim()) {
      setError("Room or unit number is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      property_id: propertyId,
      unit_number: newUnitForm.unit_number.trim(),
      unit_type: newUnitForm.unit_type,
      monthly_rent: parseNumeric(newUnitForm.monthly_rent),
      bathrooms: parseNumeric(newUnitForm.bathrooms),
      furnished: newUnitForm.furnished,
      is_available: newUnitForm.is_available,
      notes: newUnitForm.notes.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from("property_units")
      .insert(payload)
      .select(
        "id, property_id, unit_number, unit_type, monthly_rent, bathrooms, furnished, is_available, notes, created_at"
      )
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setUnits((prev) => [...prev, data as ListingUnit]);
    setNewUnitForm(INITIAL_FORM);
    setSaving(false);
  };

  const startEdit = (unit: ListingUnit) => {
    setEditingUnitId(unit.id);
    setEditForm(toForm(unit));
    setError(null);
  };

  const handleUpdateUnit = async (unitId: string) => {
    if (!editForm.unit_number.trim()) {
      setError("Room or unit number is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      unit_number: editForm.unit_number.trim(),
      unit_type: editForm.unit_type,
      monthly_rent: parseNumeric(editForm.monthly_rent),
      bathrooms: parseNumeric(editForm.bathrooms),
      furnished: editForm.furnished,
      is_available: editForm.is_available,
      notes: editForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("property_units")
      .update(payload)
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .select(
        "id, property_id, unit_number, unit_type, monthly_rent, bathrooms, furnished, is_available, notes, created_at"
      )
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setUnits((prev) =>
      prev.map((unit) => (unit.id === unitId ? (data as ListingUnit) : unit))
    );
    setEditingUnitId(null);
    setSaving(false);
  };

  const handleDeleteUnit = async (unitId: string) => {
    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("property_units")
      .delete()
      .eq("id", unitId)
      .eq("property_id", propertyId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setUnits((prev) => prev.filter((unit) => unit.id !== unitId));
    if (editingUnitId === unitId) {
      setEditingUnitId(null);
    }
    setSaving(false);
  };

  return (
    <section className="grid gap-6 rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Rooms and Units
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Unit Inventory
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Add each room or unit with number, type, rent, and occupancy status.
          </p>
        </div>
        <div className="flex gap-2 text-xs uppercase tracking-[0.2em] text-slate-300">
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Total: {units.length}
          </span>
          <span className="rounded-full border border-emerald-600/60 px-3 py-1 text-emerald-200">
            Available: {availableCount}
          </span>
          <span className="rounded-full border border-amber-600/60 px-3 py-1 text-amber-200">
            Occupied: {occupiedCount}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {tableMissing && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          The room inventory table is not in your database yet. Run the SQL in
          supabase/listing_units.sql, then refresh this page.
        </div>
      )}

      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
          Add Room or Unit
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-200">
            Unit number
            <input
              value={newUnitForm.unit_number}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  unit_number: event.target.value,
                }))
              }
              placeholder="Room 4A"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Unit type
            <select
              value={newUnitForm.unit_type}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  unit_type: event.target.value as UnitType,
                }))
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="self_contained">Self contained</option>
              <option value="studio">Studio</option>
              <option value="apartment">Apartment</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Monthly rent ({currency})
            <input
              type="number"
              min="0"
              value={newUnitForm.monthly_rent}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  monthly_rent: event.target.value,
                }))
              }
              placeholder="400000"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Bathrooms
            <input
              type="number"
              min="0"
              step="0.5"
              value={newUnitForm.bathrooms}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  bathrooms: event.target.value,
                }))
              }
              placeholder="1"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm text-slate-200">
          Notes
          <textarea
            value={newUnitForm.notes}
            onChange={(event) =>
              setNewUnitForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            placeholder="Balcony, separate meter, renovated flooring..."
            rows={3}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
          />
        </label>

        <div className="flex flex-wrap gap-6 text-sm text-slate-200">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={newUnitForm.furnished}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  furnished: event.target.checked,
                }))
              }
              className="rounded border-slate-600"
            />
            Furnished
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={newUnitForm.is_available}
              onChange={(event) =>
                setNewUnitForm((prev) => ({
                  ...prev,
                  is_available: event.target.checked,
                }))
              }
              className="rounded border-slate-600"
            />
            Available now
          </label>
        </div>

        <button
          type="button"
          onClick={handleCreateUnit}
          disabled={saving || tableMissing}
          className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving unit..." : "Add unit"}
        </button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-slate-400">Loading unit inventory...</p>
        ) : units.length === 0 ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            No rooms or units added yet.
          </p>
        ) : (
          units.map((unit) => {
            const isEditing = editingUnitId === unit.id;
            return (
              <article
                key={unit.id}
                className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
              >
                {isEditing ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2 text-sm text-slate-200">
                        Unit number
                        <input
                          value={editForm.unit_number}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              unit_number: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                        />
                      </label>

                      <label className="grid gap-2 text-sm text-slate-200">
                        Unit type
                        <select
                          value={editForm.unit_type}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              unit_type: event.target.value as UnitType,
                            }))
                          }
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                        >
                          <option value="single">Single</option>
                          <option value="double">Double</option>
                          <option value="self_contained">Self contained</option>
                          <option value="studio">Studio</option>
                          <option value="apartment">Apartment</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm text-slate-200">
                        Monthly rent ({currency})
                        <input
                          type="number"
                          min="0"
                          value={editForm.monthly_rent}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              monthly_rent: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                        />
                      </label>

                      <label className="grid gap-2 text-sm text-slate-200">
                        Bathrooms
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editForm.bathrooms}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              bathrooms: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                        />
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm text-slate-200">
                      Notes
                      <textarea
                        value={editForm.notes}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        rows={2}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-slate-600 focus:ring"
                      />
                    </label>

                    <div className="flex flex-wrap gap-6 text-sm text-slate-200">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.furnished}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              furnished: event.target.checked,
                            }))
                          }
                          className="rounded border-slate-600"
                        />
                        Furnished
                      </label>

                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.is_available}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              is_available: event.target.checked,
                            }))
                          }
                          className="rounded border-slate-600"
                        />
                        Available now
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateUnit(unit.id)}
                        disabled={saving}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUnitId(null)}
                        disabled={saving}
                        className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold text-white">
                          {unit.unit_number}
                        </h4>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                          {unit.unit_type.replace("_", " ")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                          unit.is_available
                            ? "border-emerald-600/60 text-emerald-200"
                            : "border-amber-600/60 text-amber-200"
                        }`}
                      >
                        {unit.is_available ? "Available" : "Occupied"}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-800 px-3 py-2">
                        <p className="text-xs text-slate-400">Rent</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {unit.monthly_rent == null
                            ? "Not set"
                            : `${currency} ${unit.monthly_rent.toLocaleString()}`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 px-3 py-2">
                        <p className="text-xs text-slate-400">Bathrooms</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {unit.bathrooms == null ? "Not set" : unit.bathrooms}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 px-3 py-2">
                        <p className="text-xs text-slate-400">Furnished</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {unit.furnished ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>

                    {unit.notes && (
                      <p className="text-sm text-slate-300">{unit.notes}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(unit)}
                        disabled={saving}
                        className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(unit.id)}
                        disabled={saving}
                        className="rounded-xl border border-rose-500/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}