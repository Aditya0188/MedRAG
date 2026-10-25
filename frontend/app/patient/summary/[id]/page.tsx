"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Languages,
  ArrowLeft,
  XCircle,
  ExternalLink,
  ShieldAlert,
  Calendar,
  User,
  Stethoscope,
  Info
} from "lucide-react";
import { api, PatientSummary, Analysis } from "@/lib/api";
import { PatientSummarySkeleton } from "@/components/Skeleton";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PatientSummaryPage({ params }: Props) {
  const { id } = use(params);

  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Load summary or analysis meta
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Attempt to fetch approved patient summary
        const sum = await api.getPatientSummary(id);
        setSummary(sum);
      } catch (err: any) {
        // If not approved (403), fetch redacted analysis metadata to show calm pending/rejected state
        try {
          const meta = await api.getAnalysis(id);
          setAnalysisMeta(meta);
        } catch {
          setAccessDenied(true);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Handle English / Hindi Toggle
  const handleLanguageToggle = async (targetLang: "en" | "hi") => {
    if (targetLang === language) return;
    setLanguage(targetLang);

    if (targetLang === "hi") {
      setIsTranslating(true);
      try {
        const trans = await api.getTranslatedSummary(id, "hi");
        setSummary(trans);
      } catch {
        // Fallback to base English if translation service is unavailable
        setLanguage("en");
      } finally {
        setIsTranslating(false);
      }
    } else {
      // Re-fetch English base summary
      setIsTranslating(true);
      try {
        const base = await api.getPatientSummary(id);
        setSummary(base);
      } finally {
        setIsTranslating(false);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <PatientSummarySkeleton />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-white border border-[#E5E3DC] rounded-lg text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-[#FAEEEE] text-[#A33F38] flex items-center justify-center mx-auto">
          <XCircle size={20} />
        </div>
        <h2 className="text-base font-semibold text-[#202722]">Access Restricted</h2>
        <p className="text-xs text-[#747D78] leading-relaxed">
          You do not have permission to view this prescription summary, or it does not exist.
        </p>
        <div className="pt-2">
          <Link
            href="/patient/history"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] text-white text-xs font-medium rounded-md hover:bg-[#25463A]"
          >
            <ArrowLeft size={13} />
            <span>Return to Prescriptions</span>
          </Link>
        </div>
      </div>
    );
  }

  // REJECTED STATE: Display clinician reason and upload again button (NEVER rejected content)
  if (analysisMeta && analysisMeta.review_status === "rejected") {
    return (
      <div className="max-w-xl mx-auto my-8 p-4 md:p-0">
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E5E3DC]">
            <div className="w-10 h-10 rounded-full bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202722] tracking-tight">
                Prescription Clarification Required
              </h2>
              <p className="text-xs text-[#747D78] mt-0.5">
                Reviewed by your attending clinician
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-[#202722] leading-relaxed">
              Your reviewing clinician was unable to verify this prescription and has requested a new upload or clarification.
            </p>

            <div className="p-4 bg-[#FCF5EB] border border-[#A56A19]/30 rounded-lg">
              <span className="font-mono text-[10px] font-semibold text-[#A56A19] uppercase tracking-wider block mb-1">
                Doctor's Clinical Reason:
              </span>
              <p className="text-xs text-[#202722] font-medium leading-relaxed italic">
                "{analysisMeta.rejection_reason || "Handwriting ambiguity or dosage requires verification."}"
              </p>
            </div>

            <p className="text-[#747D78] leading-relaxed">
              Please take a clearer, well-lit photo of the physical prescription slip or contact your clinic directly.
            </p>
          </div>

          <div className="pt-4 border-t border-[#E5E3DC] flex items-center justify-between">
            <Link
              href="/patient/history"
              className="text-xs font-medium text-[#747D78] hover:text-[#202722] flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Back to Prescriptions</span>
            </Link>

            <Link
              href="/patient"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md shadow-xs transition-colors"
            >
              <span>Upload Again</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // PENDING REVIEW STATE: Calm waiting screen
  if (!summary && analysisMeta && analysisMeta.review_status !== "approved") {
    return (
      <div className="max-w-xl mx-auto my-8 p-4 md:p-0">
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E5E3DC]">
            <div className="w-10 h-10 rounded-full bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20 flex items-center justify-center shrink-0">
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202722] tracking-tight">
                Prescription Under Clinician Review
              </h2>
              <p className="text-xs text-[#747D78] mt-0.5">
                Clinical safety protocol in progress
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-[#202722]">
            <p>
              Your uploaded prescription (<span className="font-mono text-[#315C4C]">{analysisMeta.original_filename}</span>)
              has successfully passed the multi-stage AI extraction and FDA drug interaction grounding.
            </p>
            <p>
              In accordance with outpatient safety standards, your interactive medication schedule and dietary warnings
              will be released to you <span className="font-semibold">immediately after verification and sign-off</span> by
              a licensed clinician.
            </p>
          </div>

          {/* Calm Stepper Timeline */}
          <div className="p-4 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-[#2E7D32]">
                <CheckCircle2 size={14} /> Uploaded & Verified
              </span>
              <span className="flex items-center gap-1.5 text-[#A56A19] animate-pulse">
                <Clock size={14} /> Doctor Triage Queue
              </span>
              <span className="text-[#747D78]">
                Schedule Unlocked
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E3DC] flex items-center justify-between">
            <Link
              href="/patient/history"
              className="text-xs font-medium text-[#747D78] hover:text-[#202722] flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Back to Prescriptions</span>
            </Link>

            <Link
              href="/patient"
              className="text-xs font-medium text-[#315C4C] hover:underline"
            >
              Upload another document
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  // APPROVED SUMMARY VIEW
  const formattedApprovalDate = new Date(summary.approval_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Group food guidance by semantic safety tier
  const avoidWarnings = summary.dietary_warnings.filter((w) => w.warning_level === "AVOID");
  const limitWarnings = summary.dietary_warnings.filter((w) => w.warning_level === "LIMIT" || w.warning_level === "TIMING");
  const safeWarnings = summary.dietary_warnings.filter((w) => w.warning_level === "SAFE");

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 print:p-0 print:max-w-none">
      {/* Top Controls Bar (hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <Link
          href="/patient/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#747D78] hover:text-[#202722] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Prescriptions</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Language Toggle: English / Hindi */}
          <div className="inline-flex items-center p-0.5 rounded-md bg-[#F1EFEA] border border-[#E5E3DC] text-xs">
            <button
              onClick={() => handleLanguageToggle("en")}
              disabled={isTranslating}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                language === "en"
                  ? "bg-white text-[#202722] shadow-xs"
                  : "text-[#747D78] hover:text-[#202722]"
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageToggle("hi")}
              disabled={isTranslating}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                language === "hi"
                  ? "bg-white text-[#202722] shadow-xs"
                  : "text-[#747D78] hover:text-[#202722]"
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E3DC] hover:border-[#315C4C] rounded-md text-xs font-medium text-[#202722] hover:text-[#315C4C] transition-colors cursor-pointer shadow-xs"
          >
            <Printer size={13} />
            <span>Print Guide</span>
          </button>
        </div>
      </div>

      {/* AI Translation Note */}
      {language === "hi" && (
        <div className="p-2.5 bg-[#FCF5EB] border border-[#A56A19]/30 rounded-md text-[11px] text-[#A56A19] flex items-center gap-2 print:hidden">
          <Info size={14} className="shrink-0" />
          <span>AI द्वारा अनुवादित: खुराक और आहार निर्देशों की आधिकारिक पुष्टि अपने चिकित्सक से अवश्य करें।</span>
        </div>
      )}

      {/* Verified Clinical Header */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 print:border-none print:p-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20 mb-2">
              <CheckCircle2 size={11} strokeWidth={2.5} />
              <span>Verified & Approved Guide</span>
            </div>
            <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
              {language === "hi" ? "दवा और आहार मार्गदर्शिका" : "Medication & Dietary Guide"}
            </h1>
            <p className="text-xs text-[#747D78] mt-0.5">
              {language === "hi" ? "सत्यापित पर्चे के आधार पर व्यक्तिगत समय सारिणी" : "Personalized daily regimen generated from your verified prescription"}
            </p>
          </div>

          <div className="text-left sm:text-right font-mono text-xs text-[#747D78] space-y-1">
            <div>
              <span className="font-semibold text-[#202722]">Patient:</span> {summary.patient_name}
            </div>
            <div>
              <span className="font-semibold text-[#202722]">Prescriber:</span> {summary.prescriber_name}
            </div>
          </div>
        </div>

        {/* Verification Metadata Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#F7F6F2] rounded-lg text-xs font-mono">
          <div>
            <span className="text-[#747D78] block text-[10px] uppercase">Approved By</span>
            <span className="font-medium text-[#202722]">{summary.approved_by}</span>
          </div>
          <div>
            <span className="text-[#747D78] block text-[10px] uppercase">Clinical Role</span>
            <span className="font-medium text-[#202722]">{summary.reviewer_role}</span>
          </div>
          <div>
            <span className="text-[#747D78] block text-[10px] uppercase">Approval Timestamp</span>
            <span className="font-medium text-[#202722]">{formattedApprovalDate}</span>
          </div>
        </div>
      </div>

      {/* Daily Medication Schedule Grid */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 print:border-none print:p-0 space-y-4">
        <h2 className="text-sm font-semibold text-[#202722] tracking-tight flex items-center gap-2">
          <Calendar size={16} className="text-[#315C4C]" />
          <span>{language === "hi" ? "दैनिक दवा सारिणी" : "Daily Medication Schedule"}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.medicines_schedule.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg space-y-2 hover:border-[#315C4C]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-xs text-[#202722]">{item.medicine_name}</h3>
                  <div className="text-[11px] text-[#747D78] font-mono mt-0.5">
                    {item.strength} • {item.dosage} ({item.route})
                  </div>
                </div>

                <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-[#E5E3DC] text-[#315C4C] shrink-0">
                  {item.timing_schedule}
                </span>
              </div>

              <div className="pt-2 border-t border-[#E5E3DC] text-xs">
                <div className="text-[#202722] font-medium leading-relaxed">
                  <span className="text-[#747D78]">{language === "hi" ? "निर्देश: " : "Instructions: "}</span>
                  {item.food_instruction}
                </div>
                {item.caution_notes && (
                  <div className="mt-1 text-[11px] text-[#A56A19] italic">
                    Note: {item.caution_notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dietary & Drug Interactions (Color + Icon + Label) */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 print:border-none print:p-0 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-[#202722] tracking-tight">
            {language === "hi" ? "खाद्य एवं आहार संबंधी सावधानियां" : "Food & Substance Guidance"}
          </h2>
          <p className="text-xs text-[#747D78] mt-0.5">
            {language === "hi" ? "आधिकारिक FDA लेबलिंग के अनुसार भोजन के साथ सावधानियां" : "Strictly backed by official FDA DailyMed & openFDA product labeling"}
          </p>
        </div>

        {/* Tier 1: Avoid / Contraindicated */}
        {avoidWarnings.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#A33F38]">
              <XCircle size={15} />
              <span>{language === "hi" ? "पूर्णतः वर्जित (Avoid Completely)" : "Avoid / Contraindicated"}</span>
            </div>

            <div className="space-y-2">
              {avoidWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#FAEEEE] border-l-3 border-l-[#A33F38] border border-[#A33F38]/20 rounded-md text-xs space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[#202722]">
                      {w.medicine_name} + {w.food_or_substance}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#A33F38] bg-white px-1.5 py-0.5 rounded border border-[#A33F38]/20">
                      AVOID
                    </span>
                  </div>
                  <p className="text-[#202722] leading-relaxed">{w.advice}</p>
                  <div className="text-[10px] text-[#747D78] flex items-center gap-1 pt-1">
                    <span>Source: {w.source_title}</span>
                    {w.official_source_url && (
                      <a
                        href={w.official_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#315C4C] hover:underline inline-flex items-center gap-0.5 print:hidden"
                      >
                        FDA Link <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 2: Space by 2h / Limit */}
        {limitWarnings.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#A56A19]">
              <Clock size={15} />
              <span>{language === "hi" ? "भोजन से 2 घंटे का अंतर रखें (Space by 2 Hours)" : "Limit / Space by 2 Hours"}</span>
            </div>

            <div className="space-y-2">
              {limitWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#FCF5EB] border-l-3 border-l-[#A56A19] border border-[#A56A19]/20 rounded-md text-xs space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[#202722]">
                      {w.medicine_name} + {w.food_or_substance}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#A56A19] bg-white px-1.5 py-0.5 rounded border border-[#A56A19]/20">
                      SPACE BY 2H
                    </span>
                  </div>
                  <p className="text-[#202722] leading-relaxed">{w.advice}</p>
                  <div className="text-[10px] text-[#747D78] flex items-center gap-1 pt-1">
                    <span>Source: {w.source_title}</span>
                    {w.official_source_url && (
                      <a
                        href={w.official_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#315C4C] hover:underline inline-flex items-center gap-0.5 print:hidden"
                      >
                        FDA Link <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 3: Safe / With Meals */}
        {safeWarnings.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2E7D32]">
              <CheckCircle2 size={15} />
              <span>{language === "hi" ? "भोजन के साथ सुरक्षित (Safe with Meals)" : "Safe / Take with Food"}</span>
            </div>

            <div className="space-y-2">
              {safeWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#EDF7EE] border-l-3 border-l-[#2E7D32] border border-[#2E7D32]/20 rounded-md text-xs space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[#202722]">
                      {w.medicine_name} + {w.food_or_substance}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#2E7D32] bg-white px-1.5 py-0.5 rounded border border-[#2E7D32]/20">
                      SAFE
                    </span>
                  </div>
                  <p className="text-[#202722] leading-relaxed">{w.advice}</p>
                  <div className="text-[10px] text-[#747D78] flex items-center gap-1 pt-1">
                    <span>Source: {w.source_title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <div className="p-4 bg-white border border-[#E5E3DC] rounded-xl text-xs text-[#747D78] leading-relaxed">
        <p className="font-medium text-[#202722] mb-1">
          {language === "hi" ? "महत्वपूर्ण कानूनी सूचना:" : "Clinical Notice:"}
        </p>
        <p>{summary.disclaimer}</p>
      </div>
    </div>
  );
}
