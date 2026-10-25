"use client";

import React, { useEffect, useState } from "react";
import { User, AlertCircle, Plus, X, Save, HeartPulse, ShieldAlert } from "lucide-react";
import { api, PatientProfile } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Skeleton } from "@/components/Skeleton";

export default function PatientProfilePage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<string>("Unspecified");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  // Input tag fields
  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");

  useEffect(() => {
    api.getPatientProfile()
      .then((data) => {
        setProfile(data);
        setAge(data.age ?? "");
        setSex(data.sex || "Unspecified");
        setAllergies(data.allergies || []);
        setConditions(data.conditions || []);
        setNotes(data.notes || "");
      })
      .catch((err) => {
        toastError(err.message || "Failed to load patient profile.");
      })
      .finally(() => setLoading(false));
  }, [toastError]);

  const handleAddAllergy = () => {
    const val = newAllergy.trim();
    if (val && !allergies.includes(val)) {
      setAllergies([...allergies, val]);
      setNewAllergy("");
    }
  };

  const handleRemoveAllergy = (allergy: string) => {
    setAllergies(allergies.filter((a) => a !== allergy));
  };

  const handleAddCondition = () => {
    const val = newCondition.trim();
    if (val && !conditions.includes(val)) {
      setConditions([...conditions, val]);
      setNewCondition("");
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setConditions(conditions.filter((c) => c !== condition));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updated = await api.updatePatientProfile({
        age: age === "" ? null : Number(age),
        sex,
        allergies,
        conditions,
        notes: notes.trim() || null,
      });

      setProfile(updated);
      toastSuccess("Health profile updated. Clinicians will review these flags during triage.");
    } catch (err: any) {
      toastError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E5E3DC]">
        <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
          Health Profile & Allergies
        </h1>
        <p className="text-xs text-[#747D78] mt-0.5">
          Document your known drug allergies and medical conditions to assist attending clinicians during prescription triage.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-white border border-[#E5E3DC] rounded-xl p-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="age">
              Age (Years)
            </label>
            <input
              id="age"
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 42"
              className="w-full px-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="sex">
              Biological Sex
            </label>
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Unspecified">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Known Allergies */}
        <div className="space-y-2 pt-2 border-t border-[#E5E3DC]">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-[#202722]">
              Known Drug & Food Allergies
            </label>
            <span className="text-[10px] text-[#A33F38] font-mono">
              Highlighted to clinicians
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAllergy();
                }
              }}
              placeholder="e.g. Penicillin, Sulfa drugs, Peanuts..."
              className="flex-1 px-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
            />
            <button
              type="button"
              onClick={handleAddAllergy}
              className="px-3 py-2 bg-[#F1EFEA] hover:bg-[#E8EEE8] border border-[#E5E3DC] text-[#202722] rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {allergies.length === 0 ? (
              <span className="text-[11px] text-[#747D78] italic">No allergies recorded.</span>
            ) : (
              allergies.map((allergy) => (
                <span
                  key={allergy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 text-xs font-medium"
                >
                  <span>{allergy}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAllergy(allergy)}
                    className="hover:text-[#202722] p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Existing Medical Conditions */}
        <div className="space-y-2 pt-2 border-t border-[#E5E3DC]">
          <label className="block text-xs font-medium text-[#202722]">
            Pre-Existing Conditions
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCondition();
                }
              }}
              placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma..."
              className="flex-1 px-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
            />
            <button
              type="button"
              onClick={handleAddCondition}
              className="px-3 py-2 bg-[#F1EFEA] hover:bg-[#E8EEE8] border border-[#E5E3DC] text-[#202722] rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {conditions.length === 0 ? (
              <span className="text-[11px] text-[#747D78] italic">No conditions recorded.</span>
            ) : (
              conditions.map((condition) => (
                <span
                  key={condition}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20 text-xs font-medium"
                >
                  <span>{condition}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(condition)}
                    className="hover:text-[#202722] p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-1.5 pt-2 border-t border-[#E5E3DC]">
          <label className="block text-xs font-medium text-[#202722]" htmlFor="notes">
            Personal Medical Notes / Sensitivities
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. History of gastric ulcers with aspirin, difficulty swallowing large capsules..."
            className="w-full px-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all leading-relaxed"
          />
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-[#E5E3DC] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? "Saving Changes..." : "Save Health Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
