"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import {
  Printer,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
  Lock
} from "lucide-react";
import { api, PatientSummary } from "@/lib/api";

function PatientSummaryContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const analysisId = resolvedParams.id;

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getPatientSummary(analysisId)
      .then((data) => setSummary(data))
      .catch((err) => setError(err.message || "Failed to load patient summary."))
      .finally(() => setLoading(false));
  }, [analysisId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
        Retrieving physician-verified patient summary...
      </div>
    );
  }

  // Strict Access Control Guard
  if (error || !summary) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 bg-white border border-[#E5E3DC] rounded-xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#FCF5EB] text-[#A56A19] flex items-center justify-center mx-auto">
          <Lock size={24} />
        </div>
        <h2 className="text-base font-semibold text-[#202722]">
          Patient Summary Locked
        </h2>
        <p className="text-xs text-[#747D78] leading-relaxed max-w-md mx-auto">
          In compliance with medical safety rules, prescription patient summaries are strictly
          inaccessible until an attending physician reviews the extracted details and signs off.
        </p>
        <div className="pt-2">
          <Link
            href={`/analysis/${analysisId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c]"
          >
            <ArrowLeft size={14} /> Open Doctor Review Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full space-y-6">
      {/* Top Controls (Hidden on Print) */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E3DC] print:hidden">
        <Link
          href={`/analysis/${analysisId}`}
          className="text-xs text-[#747D78] hover:text-[#202722] flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back to Doctor Workspace
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E3DC] bg-white text-xs font-medium text-[#202722] hover:bg-[#F1EFEA]"
        >
          <Printer size={14} /> Print Patient Card
        </button>
      </div>

      {/* Main Printable Document Card */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-8 space-y-8 shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Clinic Header */}
        <div className="border-b border-[#E5E3DC] pb-6 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#E8EEE8] text-[#315C4C] text-[10px] font-mono font-bold uppercase mb-2">
              <ShieldCheck size={12} /> Clinician Verified & Approved
            </div>
            <h1 className="text-2xl font-bold text-[#202722] tracking-tight">
              Patient Medication & Diet Guide
            </h1>
            <p className="text-xs text-[#747D78] mt-1 font-mono">
              Clinical Outpatient Healthcare • Verified Patient Information
            </p>
          </div>

          <div className="text-right text-xs font-mono text-[#747D78]">
            <p>Date: {summary.prescription_date || new Date(summary.approval_date).toLocaleDateString()}</p>
            <p className="text-[11px] text-[#2E7D32] font-semibold mt-0.5">Status: Approved</p>
          </div>
        </div>

        {/* Patient & Doctor Details Box */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg bg-[#F7F6F2] border border-[#E5E3DC] text-xs">
          <div>
            <p className="text-[10px] font-mono uppercase text-[#747D78]">Patient Name</p>
            <p className="font-semibold text-sm text-[#202722] mt-0.5">{summary.patient_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-[#747D78]">Prescribing Physician</p>
            <p className="font-semibold text-[#202722] mt-0.5">{summary.prescriber_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-[#747D78]">Approved By</p>
            <p className="font-semibold text-[#315C4C] mt-0.5">{summary.approved_by}</p>
            <p className="text-[10px] text-[#747D78]">{summary.reviewer_role}</p>
          </div>
        </div>

        {/* Section 1: Medicine Intake Schedule */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#202722] tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#315C4C] text-white text-xs font-mono font-bold flex items-center justify-center">
              1
            </span>
            How to Take Your Medicines
          </h2>

          <div className="overflow-x-auto border border-[#E5E3DC] rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F6F2] border-b border-[#E5E3DC] text-[#747D78] font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Dose</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Meal Timing & Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E3DC]">
                {summary.medicines_schedule.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F6F2]/30">
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#202722] text-sm">{item.medicine_name}</p>
                      <p className="text-[11px] text-[#747D78]">{item.strength}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#202722]">{item.dosage}</td>
                    <td className="py-3 px-4 font-semibold text-[#315C4C]">{item.timing_schedule}</td>
                    <td className="py-3 px-4 text-[#202722]">
                      <p>{item.food_instruction}</p>
                      {item.caution_notes && (
                        <p className="text-[10px] text-[#A56A19] mt-0.5 font-mono">
                          Note: {item.caution_notes}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Color-Coded Food & Drink Warnings */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#202722] tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#A56A19] text-white text-xs font-mono font-bold flex items-center justify-center">
              2
            </span>
            Food & Drink Safety Instructions (FDA Verified)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.dietary_warnings.map((warn, idx) => {
              const style = {
                AVOID: {
                  border: "border-[#A33F38]",
                  bg: "bg-[#FAEEEE]",
                  badge: "bg-[#A33F38] text-white",
                  title: "COMPLETELY AVOID",
                },
                LIMIT: {
                  border: "border-[#A56A19]",
                  bg: "bg-[#FCF5EB]",
                  badge: "bg-[#A56A19] text-white",
                  title: "LIMIT / USE CAUTION",
                },
                TIMING: {
                  border: "border-[#315C4C]",
                  bg: "bg-[#E8EEE8]",
                  badge: "bg-[#315C4C] text-white",
                  title: "SPACE BY 2 HOURS",
                },
                SAFE: {
                  border: "border-[#2E7D32]",
                  bg: "bg-[#EDF7EE]",
                  badge: "bg-[#2E7D32] text-white",
                  title: "SAFE WITH FOOD",
                },
                UNKNOWN: {
                  border: "border-[#E5E3DC]",
                  bg: "bg-[#F7F6F2]",
                  badge: "bg-[#747D78] text-white",
                  title: "GENERAL CAUTION",
                },
              }[warn.warning_level] || {
                border: "border-[#E5E3DC]",
                bg: "bg-[#F7F6F2]",
                badge: "bg-[#747D78] text-white",
                title: warn.warning_level,
              };

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${style.border} ${style.bg} space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#202722]">
                      {warn.medicine_name}
                    </span>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${style.badge}`}>
                      {style.title}
                    </span>
                  </div>

                  <p className="font-semibold text-xs text-[#202722]">
                    Food / Beverage: {warn.food_or_substance}
                  </p>
                  <p className="text-xs text-[#202722] leading-snug">{warn.advice}</p>

                  <div className="pt-2 text-[10px] text-[#747D78] font-mono border-t border-black/5 flex items-center justify-between">
                    <span className="truncate max-w-[200px]">FDA Label: {warn.source_title}</span>
                    <a
                      href={warn.official_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#315C4C] hover:underline flex items-center gap-1 font-bold shrink-0 print:hidden"
                    >
                      Official Source <ExternalLink size={9} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Doctor Stamp & Signature Block */}
        <div className="pt-6 border-t border-[#E5E3DC] flex items-center justify-between text-xs">
          <div>
            <p className="font-semibold text-[#202722]">{summary.approved_by}</p>
            <p className="text-[11px] text-[#747D78] font-mono">{summary.reviewer_role}</p>
            <p className="text-[10px] text-[#747D78] mt-0.5 font-mono">
              Approved on: {new Date(summary.approval_date).toLocaleString()}
            </p>
          </div>

          <div className="text-center">
            <div className="w-32 border-b-2 border-dashed border-[#747D78] mb-1 pb-4">
              <span className="font-serif italic text-base text-[#315C4C]">Clinician</span>
            </div>
            <span className="text-[10px] font-mono text-[#747D78]">Clinician Signature</span>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div className="p-4 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-[11px] text-[#747D78] space-y-1">
          <p className="font-semibold text-[#202722]">IMPORTANT MEDICAL NOTICE</p>
          <p>{summary.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

export default function PatientSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
          Retrieving physician-verified patient summary...
        </div>
      }
    >
      <PatientSummaryContent params={params} />
    </Suspense>
  );
}
