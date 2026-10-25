"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Search, ArrowRight, ShieldAlert, HeartPulse, FileText } from "lucide-react";
import { api, PatientListItem } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getPatients(search)
      .then((data) => setPatients(data))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
            Patient Directory
          </h1>
          <p className="text-xs text-[#747D78] mt-0.5">
            Search patient health profiles, documented allergies, and outpatient prescription records.
          </p>
        </div>

        <Link
          href="/doctor"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E3DC] hover:border-[#315C4C] rounded-md text-xs font-medium text-[#202722] hover:text-[#315C4C] transition-colors"
        >
          <span>Triage Queue</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-2.5 text-[#747D78]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient name, email, or allergy..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
        />
      </div>

      {/* Patient Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-[#E5E3DC] rounded-lg p-5 space-y-3 animate-pulse">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Patients Found"
          description={search ? "No records match your query." : "No patients have been registered yet."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((pat) => (
            <div
              key={pat.id}
              className="bg-white border border-[#E5E3DC] hover:border-[#315C4C]/40 rounded-xl p-5 space-y-4 transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-[#202722]">{pat.name}</h3>
                    <p className="text-xs text-[#747D78] font-mono mt-0.5">{pat.email}</p>
                  </div>
                  <span className="font-mono text-[10px] text-[#747D78] bg-[#F7F6F2] border border-[#E5E3DC] px-2 py-0.5 rounded">
                    {pat.age ? `${pat.age}y` : "Age N/A"} • {pat.sex || "Unknown"}
                  </span>
                </div>

                {/* Allergies Chips */}
                <div>
                  <span className="text-[10px] font-mono text-[#747D78] uppercase block mb-1">
                    Known Allergies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pat.allergies.length === 0 ? (
                      <span className="text-[11px] text-[#747D78] italic">No allergies recorded</span>
                    ) : (
                      pat.allergies.map((allergy) => (
                        <span
                          key={allergy}
                          className="px-2 py-0.5 rounded bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 text-[10px] font-medium"
                        >
                          {allergy}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Conditions Chips */}
                <div>
                  <span className="text-[10px] font-mono text-[#747D78] uppercase block mb-1">
                    Documented Conditions
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pat.conditions.length === 0 ? (
                      <span className="text-[11px] text-[#747D78] italic">No conditions recorded</span>
                    ) : (
                      pat.conditions.map((condition) => (
                        <span
                          key={condition}
                          className="px-2 py-0.5 rounded bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20 text-[10px] font-medium"
                        >
                          {condition}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-[#E5E3DC] flex items-center justify-between text-xs">
                <span className="text-[#747D78] font-mono text-[11px] tabular-nums">
                  {pat.analysis_count} {pat.analysis_count === 1 ? "prescription" : "prescriptions"}
                </span>

                <Link
                  href={`/doctor/patients/${pat.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#315C4C] hover:underline"
                >
                  <span>View Full Record</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
