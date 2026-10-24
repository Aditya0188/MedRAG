"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Edit3,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ArrowRight,
  UserCheck,
  X,
  Save,
  BookOpen
} from "lucide-react";
import { api, Analysis, ExtractedMedicine, Evidence } from "@/lib/api";

function AnalysisWorkspaceContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const analysisId = resolvedParams.id;
  const router = useRouter();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active workspace tab: "medicines" | "evidence" | "review" | "audit"
  const [activeTab, setActiveTab] = useState<"medicines" | "evidence" | "review" | "audit">("medicines");

  // Image viewer zoom
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showOcrBaseline, setShowOcrBaseline] = useState(false);

  // Row-level medicine editor modal state
  const [editingMed, setEditingMed] = useState<ExtractedMedicine | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ExtractedMedicine>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Doctor Review sign-off state
  const [reviewerName, setReviewerName] = useState("Dr. Clinician Reviewer");
  const [reviewerRole, setReviewerRole] = useState("Attending Clinician / Reviewer");
  const [reviewNotes, setReviewNotes] = useState("Verified prescription line items and confirmed dietary instructions.");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewDuration, setReviewDuration] = useState(0);

  // Track review timer
  useEffect(() => {
    const timer = setInterval(() => {
      setReviewDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnalysis(analysisId);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Failed to load analysis details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, [analysisId]);

  // Handle Medicine Edit Modal
  const openEditModal = (med: ExtractedMedicine) => {
    setEditingMed(med);
    setEditFormData({
      original_name: med.original_name,
      normalized_name: med.normalized_name || "",
      strength: med.strength || "",
      dosage: med.dosage || "",
      route: med.route || "oral",
      frequency: med.frequency || "",
      frequency_meaning: med.frequency_meaning || "",
      duration: med.duration || "",
      timing_instructions: med.timing_instructions || "",
      food_instructions: med.food_instructions || "",
      verification_status: med.verification_status,
      reviewer_notes: med.reviewer_notes || "",
    });
  };

  const handleSaveMedicineEdit = async () => {
    if (!editingMed || !analysis) return;
    setIsSavingEdit(true);
    try {
      await api.updateMedicine(analysis.id, editingMed.id, editFormData);
      await loadAnalysis();
      setEditingMed(null);
    } catch (err: any) {
      alert("Failed to update medicine record: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Doctor Approval
  const handleApprove = async () => {
    if (!analysis) return;
    setIsSubmittingReview(true);
    try {
      await api.approveAnalysis(analysis.id, {
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        review_notes: reviewNotes,
        confirmed_no_unresolved_critical_fields: true,
        review_duration_seconds: reviewDuration,
      });
      await loadAnalysis();
      alert("Prescription successfully approved! Patient summary is now unlocked.");
    } catch (err: any) {
      alert("Approval blocked: " + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Doctor Rejection
  const handleReject = async () => {
    if (!analysis) return;
    const reason = prompt("Enter reason for rejecting this prescription report:");
    if (!reason) return;

    setIsSubmittingReview(true);
    try {
      await api.rejectAnalysis(analysis.id, {
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        rejection_reason: reason,
        review_duration_seconds: reviewDuration,
      });
      await loadAnalysis();
      alert("Prescription analysis marked as REJECTED.");
    } catch (err: any) {
      alert("Rejection failed: " + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
        Loading prescription analysis workspace...
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-white border border-[#A33F38]/30 rounded-lg text-center space-y-4">
        <AlertCircle size={32} className="mx-auto text-[#A33F38]" />
        <h2 className="text-base font-semibold text-[#202722]">Error Loading Analysis</h2>
        <p className="text-xs text-[#747D78]">{error || "Analysis not found."}</p>
        <Link
          href="/history"
          className="inline-block px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-medium"
        >
          Return to History
        </Link>
      </div>
    );
  }

  // Check if any medicine has unresolved ambiguous handwriting
  const hasUnresolvedAmbiguity = analysis.medicines.some(
    (m) =>
      (m.uncertainty_flags.includes("unclear_handwriting") ||
        m.uncertainty_flags.includes("ambiguous_drug_identity")) &&
      !m.reviewer_corrected
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-medium text-[#747D78]">
              ID: {analysis.id.slice(0, 8)}...
            </span>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                analysis.review_status === "approved"
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/30"
                  : analysis.review_status === "rejected"
                  ? "bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/30"
                  : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
              }`}
            >
              {analysis.review_status.replace("_", " ")}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
            Patient: {analysis.patient_name_detected || "Not Detected"}
          </h1>
          <p className="text-xs text-[#747D78] mt-0.5 font-mono">
            Prescriber: {analysis.prescriber_name_detected || "Not Specified"} • Date:{" "}
            {analysis.prescription_date_detected || "N/A"} • Processed in{" "}
            {analysis.total_processing_duration_sec}s
          </p>
        </div>

        <div className="flex items-center gap-2">
          {analysis.review_status === "approved" ? (
            <Link
              href={`/analysis/${analysis.id}/patient-summary`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#2E7D32] text-white text-xs font-medium hover:bg-[#256829] shadow-xs"
            >
              <FileText size={14} /> View Approved Patient Summary
            </Link>
          ) : (
            <button
              onClick={() => setActiveTab("review")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c] shadow-xs"
            >
              <UserCheck size={14} /> Doctor Review Gateway
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Side-by-Side Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Prescription Image & Quality Assessment */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#202722] uppercase font-mono">
                Original Prescription
              </span>
              <div className="flex items-center gap-1 text-[#747D78]">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 rounded hover:bg-[#F1EFEA]"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="font-mono text-[10px] w-9 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 rounded hover:bg-[#F1EFEA]"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => setZoomLevel(1.0)}
                  className="p-1 rounded hover:bg-[#F1EFEA]"
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable Zoomable Image Canvas */}
            <div className="h-[460px] overflow-auto border border-[#E5E3DC] rounded bg-[#F1EFEA] flex items-center justify-center p-2 relative">
              <img
                src={api.getPrescriptionImageUrl(analysis.id)}
                alt="Original Medical Prescription"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
                className="max-h-full object-contain transition-transform duration-150"
              />
            </div>

            {/* Image Quality Assessment Card */}
            <div className="p-3 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[#747D78] uppercase text-[11px]">
                  Quality Score
                </span>
                <span className="font-mono font-bold text-[#315C4C]">
                  {Math.round(analysis.image_quality_score * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-[#747D78] leading-tight">
                {analysis.image_quality_feedback || "Adequate resolution and contrast."}
              </p>
            </div>

            {/* Tesseract OCR Baseline Drawer (Control 1 Comparison) */}
            <div className="border border-[#E5E3DC] rounded text-xs overflow-hidden">
              <button
                onClick={() => setShowOcrBaseline(!showOcrBaseline)}
                className="w-full p-2.5 bg-[#F7F6F2] text-left font-medium text-[#202722] flex items-center justify-between hover:bg-[#F1EFEA]"
              >
                <span className="font-mono text-[11px]">
                  Control 1: Tesseract OCR Baseline
                </span>
                {showOcrBaseline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showOcrBaseline && (
                <div className="p-3 bg-white text-[11px] font-mono text-[#747D78] whitespace-pre-wrap border-t border-[#E5E3DC]">
                  {analysis.raw_ocr_baseline || "Baseline OCR not available."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Extracted Medicines, Evidence & Doctor Triage */}
        <div className="lg:col-span-7 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-[#E5E3DC] bg-white p-1 rounded-t-lg">
            <button
              onClick={() => setActiveTab("medicines")}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === "medicines"
                  ? "bg-[#315C4C] text-white"
                  : "text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA]"
              }`}
            >
              Extracted Medicines ({analysis.medicines.length})
            </button>
            <button
              onClick={() => setActiveTab("evidence")}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === "evidence"
                  ? "bg-[#315C4C] text-white"
                  : "text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA]"
              }`}
            >
              Food & Drug Evidence ({analysis.evidences.length})
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "review"
                  ? "bg-[#315C4C] text-white"
                  : "text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA]"
              }`}
            >
              <UserCheck size={13} /> Doctor Review Sign-Off
              {hasUnresolvedAmbiguity && (
                <span className="w-2 h-2 rounded-full bg-[#A56A19]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === "audit"
                  ? "bg-[#315C4C] text-white"
                  : "text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA]"
              }`}
            >
              Audit Trail
            </button>
          </div>

          {/* TAB 1: EXTRACTED MEDICINES TABLE */}
          {activeTab === "medicines" && (
            <div className="p-4 rounded-b-lg bg-white border border-t-0 border-[#E5E3DC] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#202722] uppercase font-mono">
                    Prescription Transcription & RxNorm Grounding
                  </h3>
                  <p className="text-[11px] text-[#747D78]">
                    Click &quot;Edit&quot; on any row to correct handwriting misreadings before doctor sign-off.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await api.reverifyMedicines(analysis.id);
                    await loadAnalysis();
                  }}
                  className="px-2.5 py-1 rounded border border-[#E5E3DC] text-[11px] font-medium text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Re-verify RxNorm
                </button>
              </div>

              <div className="space-y-3">
                {analysis.medicines.map((med, idx) => {
                  const isAmbiguous =
                    med.uncertainty_flags.includes("unclear_handwriting") ||
                    med.uncertainty_flags.includes("ambiguous_drug_identity");

                  return (
                    <div
                      key={med.id}
                      className={`p-3.5 rounded-md border text-xs space-y-2 transition-colors ${
                        isAmbiguous && !med.reviewer_corrected
                          ? "border-[#A56A19] bg-[#FCF5EB]/40"
                          : "border-[#E5E3DC] hover:border-[#315C4C]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-xs text-[#747D78]">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-sm text-[#202722]">
                              {med.original_name}
                            </span>
                            {med.strength && (
                              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F1EFEA] text-[#202722]">
                                {med.strength}
                              </span>
                            )}
                            {med.dosage && (
                              <span className="text-xs text-[#747D78]">({med.dosage})</span>
                            )}
                          </div>

                          {/* Grounded Concept */}
                          <div className="mt-1 flex items-center gap-2 text-[11px]">
                            <span className="text-[#747D78]">RxNorm Concept:</span>
                            <span className="font-medium text-[#315C4C]">
                              {med.normalized_name || "Unverified terminology"}
                            </span>
                            {med.rxcui && (
                              <span className="font-mono text-[10px] px-1 rounded bg-[#E8EEE8] text-[#315C4C]">
                                RxCUI: {med.rxcui}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                              med.verification_status === "verified_match"
                                ? "bg-[#EDF7EE] text-[#2E7D32]"
                                : med.verification_status === "possible_match"
                                ? "bg-[#FCF5EB] text-[#A56A19]"
                                : "bg-[#FAEEEE] text-[#A33F38]"
                            }`}
                          >
                            {med.verification_status.replace("_", " ")}
                          </span>
                          <button
                            onClick={() => openEditModal(med)}
                            className="p-1 rounded text-[#747D78] hover:text-[#315C4C] hover:bg-[#E8EEE8]"
                            title="Edit row details"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Schedule & Timing Row */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#F1EFEA] text-[11px]">
                        <div>
                          <span className="text-[#747D78]">Frequency: </span>
                          <span className="font-medium text-[#202722]">
                            {med.frequency || "Unclear"}
                          </span>
                          {med.frequency_meaning && (
                            <span className="text-[#747D78] block text-[10px]">
                              {med.frequency_meaning}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[#747D78]">Duration: </span>
                          <span className="font-medium text-[#202722]">
                            {med.duration || "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#747D78]">Timing / Food: </span>
                          <span className="font-medium text-[#202722]">
                            {med.timing_instructions || med.food_instructions || "Standard"}
                          </span>
                        </div>
                      </div>

                      {/* Uncertainty Alert on row */}
                      {isAmbiguous && !med.reviewer_corrected && (
                        <div className="p-2 rounded bg-[#FCF5EB] border border-[#A56A19]/30 text-[#A56A19] text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle size={13} />
                            Ambiguous handwriting detected. Clinician verification required.
                          </span>
                          <button
                            onClick={() => openEditModal(med)}
                            className="underline font-bold text-[10px]"
                          >
                            Resolve Now
                          </button>
                        </div>
                      )}

                      {med.reviewer_corrected && (
                        <div className="text-[10px] text-[#2E7D32] font-mono flex items-center gap-1">
                          <CheckCircle2 size={11} /> Corrected by reviewer: {med.reviewer_notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FOOD & DRUG EVIDENCE */}
          {activeTab === "evidence" && (
            <div className="p-4 rounded-b-lg bg-white border border-t-0 border-[#E5E3DC] space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-[#202722] uppercase font-mono">
                  Official FDA Drug Label Evidence (Qdrant RAG)
                </h3>
                <p className="text-[11px] text-[#747D78]">
                  Retrieved from official FDA DailyMed Structured Product Labels (SPL) and openFDA drug label records.
                </p>
              </div>

              <div className="space-y-3">
                {analysis.evidences.map((ev) => {
                  const categoryBadge = {
                    avoid_contraindicated: {
                      bg: "bg-[#FAEEEE]",
                      text: "text-[#A33F38]",
                      label: "AVOID / CONTRAINDICATED",
                    },
                    limit_caution: {
                      bg: "bg-[#FCF5EB]",
                      text: "text-[#A56A19]",
                      label: "LIMIT / USE CAUTION",
                    },
                    timing_instruction: {
                      bg: "bg-[#E8EEE8]",
                      text: "text-[#315C4C]",
                      label: "TIMING INSTRUCTION",
                    },
                    no_relevant_warning: {
                      bg: "bg-[#EDF7EE]",
                      text: "text-[#2E7D32]",
                      label: "NO RELEVANT WARNING FOUND",
                    },
                    unavailable_insufficient: {
                      bg: "bg-[#F1EFEA]",
                      text: "text-[#747D78]",
                      label: "EVIDENCE UNAVAILABLE",
                    },
                  }[ev.evidence_category] || {
                    bg: "bg-[#F1EFEA]",
                    text: "text-[#747D78]",
                    label: ev.evidence_category,
                  };

                  return (
                    <div
                      key={ev.id}
                      className="p-4 rounded-md border border-[#E5E3DC] space-y-2 hover:border-[#315C4C] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-sm text-[#202722]">
                            {ev.medicine_name}
                          </span>
                          <span className="text-xs text-[#747D78] ml-2">
                            interacts with:{" "}
                            <span className="font-semibold text-[#202722]">
                              {ev.food_or_substance}
                            </span>
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${categoryBadge.bg} ${categoryBadge.text}`}
                        >
                          {categoryBadge.label}
                        </span>
                      </div>

                      {/* Plain-language summary */}
                      <p className="text-xs font-medium text-[#202722] bg-[#F7F6F2] p-2.5 rounded border border-[#E5E3DC]">
                        {ev.plain_language_summary}
                      </p>

                      {/* Official Excerpt */}
                      <div className="text-[11px] text-[#747D78] italic pl-2 border-l-2 border-[#315C4C]">
                        &quot;{ev.evidence_excerpt}&quot;
                      </div>

                      {/* Source Citation */}
                      <div className="pt-2 flex items-center justify-between text-[10px] text-[#747D78] font-mono border-t border-[#F1EFEA]">
                        <span className="truncate max-w-[340px]">
                          Source: {ev.source_provider} • {ev.source_document_title}
                        </span>
                        <a
                          href={ev.official_source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#315C4C] hover:underline flex items-center gap-1 font-bold shrink-0"
                        >
                          Official FDA Document <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DOCTOR REVIEW SIGN-OFF GATEWAY */}
          {activeTab === "review" && (
            <div className="p-5 rounded-b-lg bg-white border border-t-0 border-[#E5E3DC] space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[#202722] tracking-tight">
                  Clinician Triage & Approval Gateway
                </h3>
                <p className="text-xs text-[#747D78] mt-0.5">
                  Review original prescription image against the structured transcription. Verify medicine identities and sign off.
                </p>
              </div>

              {/* Review Time Tracker */}
              <div className="flex items-center justify-between p-3 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs">
                <span className="text-[#747D78]">Clinician Review Active Timer:</span>
                <span className="font-mono font-bold text-[#315C4C]">
                  {reviewDuration}s elapsed (Goal: &lt; 60s)
                </span>
              </div>

              {/* Blocked approval alert if unresolved ambiguity */}
              {hasUnresolvedAmbiguity && (
                <div className="p-3.5 rounded bg-[#FAEEEE] border border-[#A33F38]/30 text-xs text-[#A33F38] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} /> Approval Blocked: Ambiguous Medication Unresolved
                  </div>
                  <p>
                    One or more medicine entries has unclear handwriting that has not been disambiguated.
                    Under medical safety protocols, ambiguous doses or drugs cannot be released to a patient.
                    Please switch to the &quot;Extracted Medicines&quot; tab and edit the uncertain line item.
                  </p>
                </div>
              )}

              {/* Reviewer Details Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[#747D78] font-mono text-[11px] mb-1">
                      Reviewer Name
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-[#F7F6F2] text-[#202722]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#747D78] font-mono text-[11px] mb-1">
                      Reviewer Role
                    </label>
                    <input
                      type="text"
                      value={reviewerRole}
                      onChange={(e) => setReviewerRole(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-[#F7F6F2] text-[#202722]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#747D78] font-mono text-[11px] mb-1">
                    Clinician Review Notes
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-xs text-[#202722] focus:outline-none focus:border-[#315C4C]"
                    placeholder="Enter clinical observations, corrections, or patient instructions..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E5E3DC] flex items-center justify-between">
                <button
                  onClick={handleReject}
                  disabled={isSubmittingReview || analysis.review_status === "rejected"}
                  className="px-4 py-2 rounded bg-white border border-[#A33F38]/30 text-[#A33F38] text-xs font-medium hover:bg-[#FAEEEE]"
                >
                  Reject Prescription
                </button>

                <button
                  onClick={handleApprove}
                  disabled={isSubmittingReview || hasUnresolvedAmbiguity || analysis.review_status === "approved"}
                  className={`px-5 py-2.5 rounded text-xs font-semibold text-white flex items-center gap-2 transition-colors ${
                    hasUnresolvedAmbiguity || analysis.review_status === "approved"
                      ? "bg-[#315C4C]/40 cursor-not-allowed"
                      : "bg-[#2E7D32] hover:bg-[#256829] shadow-xs"
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {analysis.review_status === "approved"
                    ? "Prescription Approved"
                    : "Approve & Unlock Patient Summary"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="p-4 rounded-b-lg bg-white border border-t-0 border-[#E5E3DC] space-y-3">
              <h3 className="text-xs font-semibold text-[#202722] uppercase font-mono">
                Immutable Clinical Audit Events
              </h3>
              <div className="space-y-2">
                {analysis.audit_events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-[#202722]">
                        {ev.event_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-[#747D78] ml-2 font-mono">
                        by {ev.actor}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#747D78] font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row-Level Medicine Edit Modal */}
      {editingMed && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#E5E3DC] max-w-lg w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-3">
              <h3 className="text-sm font-semibold text-[#202722]">
                Correct Extracted Medicine Details
              </h3>
              <button
                onClick={() => setEditingMed(null)}
                className="text-[#747D78] hover:text-[#202722]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#747D78] font-mono mb-1">Medicine Name (As Written)</label>
                <input
                  type="text"
                  value={editFormData.original_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, original_name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                />
              </div>

              <div>
                <label className="block text-[#747D78] font-mono mb-1">Normalized Generic Name (RxNorm)</label>
                <input
                  type="text"
                  value={editFormData.normalized_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, normalized_name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#747D78] font-mono mb-1">Strength</label>
                  <input
                    type="text"
                    value={editFormData.strength || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, strength: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                  />
                </div>
                <div>
                  <label className="block text-[#747D78] font-mono mb-1">Dosage Form</label>
                  <input
                    type="text"
                    value={editFormData.dosage || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, dosage: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#747D78] font-mono mb-1">Frequency</label>
                  <input
                    type="text"
                    value={editFormData.frequency || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, frequency: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                  />
                </div>
                <div>
                  <label className="block text-[#747D78] font-mono mb-1">Duration</label>
                  <input
                    type="text"
                    value={editFormData.duration || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#747D78] font-mono mb-1">Clinician Correction Note</label>
                <input
                  type="text"
                  value={editFormData.reviewer_notes || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, reviewer_notes: e.target.value })}
                  placeholder="e.g. Corrected ambiguous cursive stroke to Ciprofloxacin 250mg"
                  className="w-full px-3 py-2 rounded border border-[#E5E3DC] bg-white text-[#202722]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E3DC]">
              <button
                onClick={() => setEditingMed(null)}
                className="px-4 py-2 rounded border border-[#E5E3DC] text-xs text-[#747D78] hover:text-[#202722]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMedicineEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c]"
              >
                {isSavingEdit ? "Saving..." : "Save Corrections"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
          Loading prescription analysis workspace...
        </div>
      }
    >
      <AnalysisWorkspaceContent params={params} />
    </Suspense>
  );
}
