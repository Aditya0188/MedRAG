"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  HeartPulse,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { api, PatientDetail } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

interface Props {
  params: Promise<{ id: string }>;
}

export default function DoctorPatientDetailPage({ params }: Props) {
  const { id } = use(params);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPatient(id)
      .then((data) => setPatient(data))
      .catch((err) => console.error("Error loading patient detail:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-[#E5E3DC] rounded-lg text-center space-y-3">
        <h2 className="text-base font-semibold text-[#202722]">Patient Record Not Found</h2>
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] text-white rounded text-xs"
        >
          <ArrowLeft size={12} /> Back to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-[#E5E3DC]">
        <Link
          href="/doctor/patients"
          className="p-1 rounded text-[#747D78] hover:text-[#202722] hover:bg-white border border-transparent hover:border-[#E5E3DC] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">{patient.name}</h1>
          <p className="text-xs text-[#747D78] font-mono mt-0.5">{patient.email}</p>
        </div>
      </div>

      {/* Patient Profile Card */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#F7F6F2] rounded-lg font-mono text-xs">
          <div>
            <span className="text-[10px] text-[#747D78] uppercase block">Age</span>
            <span className="font-semibold text-[#202722]">{patient.age ? `${patient.age} years` : "Not specified"}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#747D78] uppercase block">Sex</span>
            <span className="font-semibold text-[#202722]">{patient.sex || "Not specified"}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#747D78] uppercase block">Total Prescriptions</span>
            <span className="font-semibold text-[#202722] tabular-nums">{patient.analysis_count}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#747D78] uppercase block">Patient ID</span>
            <span className="font-semibold text-[#202722] truncate block">{patient.id}</span>
          </div>
        </div>

        {/* Documented Allergies */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#A33F38] flex items-center gap-1.5 uppercase font-mono text-[11px]">
            <ShieldAlert size={14} /> Documented Drug Allergies
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {patient.allergies.length === 0 ? (
              <span className="text-xs text-[#747D78] italic">No allergies recorded in patient profile.</span>
            ) : (
              patient.allergies.map((allergy) => (
                <span
                  key={allergy}
                  className="px-2.5 py-1 rounded bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 text-xs font-medium"
                >
                  {allergy}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Medical Conditions */}
        <div className="space-y-1.5 pt-3 border-t border-[#E5E3DC]">
          <span className="text-xs font-semibold text-[#315C4C] flex items-center gap-1.5 uppercase font-mono text-[11px]">
            <HeartPulse size={14} /> Pre-Existing Clinical Conditions
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {patient.conditions.length === 0 ? (
              <span className="text-xs text-[#747D78] italic">No conditions recorded in patient profile.</span>
            ) : (
              patient.conditions.map((c) => (
                <span
                  key={c}
                  className="px-2.5 py-1 rounded bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20 text-xs font-medium"
                >
                  {c}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Clinical Notes */}
        {patient.notes && (
          <div className="space-y-1 pt-3 border-t border-[#E5E3DC]">
            <span className="text-[10px] text-[#747D78] uppercase font-mono block">Personal Notes</span>
            <p className="text-xs text-[#202722] bg-[#F7F6F2] p-3 rounded border border-[#E5E3DC] leading-relaxed">
              {patient.notes}
            </p>
          </div>
        )}
      </div>

      {/* Prescription History for this Patient */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E3DC] flex items-center justify-between">
          <h2 className="font-semibold text-sm text-[#202722]">Prescription History ({patient.analyses.length})</h2>
          <span className="text-xs text-[#747D78] font-mono">Doctors may view pending and approved records</span>
        </div>

        {patient.analyses.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#747D78]">
            No prescriptions recorded for this patient.
          </div>
        ) : (
          <div className="divide-y divide-[#E5E3DC]">
            {patient.analyses.map((item) => {
              const isApproved = item.review_status === "approved";
              const isRejected = item.review_status === "rejected";
              const isPending = !isApproved && !isRejected;

              const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F6F2] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-[#F1EFEA] border border-[#E5E3DC] flex items-center justify-center text-[#315C4C] shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#202722] truncate">{item.original_filename}</div>
                      <div className="text-[11px] text-[#747D78] font-mono mt-0.5">
                        {formattedDate} • {item.medicine_count} medications
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20 font-mono">
                        <CheckCircle2 size={12} strokeWidth={2.5} /> Approved
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20 font-mono">
                        <Clock size={12} className="animate-pulse" /> Pending
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 font-mono">
                        <AlertTriangle size={12} /> Rejected
                      </span>
                    )}

                    <Link
                      href={`/doctor/review/${item.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#E5E3DC] hover:border-[#315C4C] text-xs font-medium text-[#202722] hover:text-[#315C4C] bg-white transition-colors"
                    >
                      <span>Review Workspace</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
