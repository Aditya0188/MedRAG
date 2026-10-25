"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Save,
  Pencil,
  Eye,
  FileText
} from "lucide-react";
import { api, Analysis, ExtractedMedicine, Evidence, PatientDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PrescriptionReviewSkeleton } from "@/components/Skeleton";

interface Props {
  params: Promise<{ id: string }>;
}

export default function DoctorReviewPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"medications" | "evidence" | "review">("medications");

  // Pan & Zoom image states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Hover and selection synchronization between image boxes and medicine rows
  const [hoveredMedId, setHoveredMedId] = useState<string | null>(null);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  // Inline editing state: { [medId]: { isEditing, original_name, strength, dosage, frequency, food_instructions, savedStatus } }
  const [editForms, setEditForms] = useState<Record<string, any>>({});
  const [savedIndicators, setSavedIndicators] = useState<Record<string, boolean>>({});

  // Expanded evidence state
  const [expandedEvidences, setExpandedEvidences] = useState<Record<string, boolean>>({});

  // Review & Approval Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [confirmNoAmbiguities, setConfirmNoAmbiguities] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Review timer
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    async function loadAnalysis() {
      try {
        const data = await api.getAnalysis(id);
        setAnalysis(data);

        // Initialize inline edit forms
        const initialEdits: Record<string, any> = {};
        data.medicines.forEach((m) => {
          initialEdits[m.id] = {
            original_name: m.original_name,
            strength: m.strength || "",
            dosage: m.dosage || "",
            frequency: m.frequency || "",
            food_instructions: m.food_instructions || "",
          };
        });
        setEditForms(initialEdits);

        // Fetch patient profile if available to cross-reference allergies
        if (data.patient_id) {
          try {
            const p = await api.getPatient(data.patient_id);
            setPatientProfile(p);
          } catch {
            // patient profile optional
          }
        }
      } catch (err: any) {
        toastError(err.message || "Failed to load prescription review record.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalysis();
  }, [id, toastError]);

  // Check for allergy cross-reactions
  const allergyWarnings = React.useMemo(() => {
    if (!analysis || !patientProfile || !patientProfile.allergies?.length) return [];
    const warnings: Array<{ medName: string; allergyName: string }> = [];

    const allergyPatterns: Record<string, string[]> = {
      penicillin: ["amoxicillin", "amox", "augmentin", "ampicillin", "piperacillin", "clavam"],
      sulfa: ["bactrim", "sulfamethoxazole", "septra", "sulfadiazine"],
      aspirin: ["aspirin", "ibuprofen", "combiflam", "voveran", "diclofenac", "nsaid"],
    };

    analysis.medicines.forEach((m) => {
      const medLower = (m.normalized_name || m.original_name).toLowerCase();
      patientProfile.allergies.forEach((allergy) => {
        const alLower = allergy.toLowerCase();
        // Direct match
        if (medLower.includes(alLower) || alLower.includes(medLower)) {
          warnings.push({ medName: m.original_name, allergyName: allergy });
        } else {
          // Cross-reaction class check
          Object.entries(allergyPatterns).forEach(([patternKey, drugs]) => {
            if (alLower.includes(patternKey) && drugs.some((d) => medLower.includes(d))) {
              warnings.push({ medName: m.original_name, allergyName: allergy });
            }
          });
        }
      });
    });

    return warnings;
  }, [analysis, patientProfile]);

  // Pan and Zoom Controls
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPosition({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Inline editing save handler with optimistic feedback
  const handleSaveMedicineField = async (medId: string) => {
    const editData = editForms[medId];
    if (!editData) return;

    // Optimistic UI state
    setSavedIndicators((prev) => ({ ...prev, [medId]: false }));

    try {
      const updated = await api.updateMedicine(id, medId, {
        original_name: editData.original_name,
        strength: editData.strength,
        dosage: editData.dosage,
        frequency: editData.frequency,
        food_instructions: editData.food_instructions,
        reviewer_corrected: true,
      });

      // Update state
      setAnalysis((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          medicines: prev.medicines.map((m) => (m.id === medId ? updated : m)),
        };
      });

      setSavedIndicators((prev) => ({ ...prev, [medId]: true }));
      setTimeout(() => {
        setSavedIndicators((prev) => ({ ...prev, [medId]: false }));
      }, 2500);

      toastSuccess(`Saved updates to ${updated.original_name}`);
    } catch (err: any) {
      toastError(err.message || "Failed to update medication row.");
    }
  };

  // Decision Handlers
  const handleApprove = async () => {
    if (!confirmNoAmbiguities) {
      toastWarning("Please confirm you have resolved all critical dosage ambiguities.");
      return;
    }

    setIsSubmittingDecision(true);
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      await api.approveAnalysis(id, {
        reviewer_name: user?.name || "Attending Doctor",
        review_notes: reviewNotes || "Prescription verified and approved for patient medication guide.",
        confirmed_no_unresolved_critical_fields: true,
        review_duration_seconds: elapsedSeconds,
      });

      toastSuccess("Prescription approved. Patient summary is now live.");
      setShowApproveDialog(false);
      router.push("/doctor");
    } catch (err: any) {
      toastError(err.message || "Failed to approve prescription.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) {
      toastWarning("Rejection reason must be at least 10 characters explaining what clarification is required.");
      return;
    }

    setIsSubmittingDecision(true);
    const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      await api.rejectAnalysis(id, {
        reviewer_name: user?.name || "Attending Doctor",
        rejection_reason: rejectionReason.trim(),
        review_duration_seconds: elapsedSeconds,
      });

      toastSuccess("Prescription rejected. Patient has been notified to re-upload.");
      setShowRejectDialog(false);
      router.push("/doctor");
    } catch (err: any) {
      toastError(err.message || "Failed to reject prescription.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <PrescriptionReviewSkeleton />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-[#E5E3DC] rounded-lg text-center space-y-3">
        <AlertTriangle size={24} className="mx-auto text-[#A33F38]" />
        <h2 className="text-base font-semibold text-[#202722]">Prescription Record Not Found</h2>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] text-white rounded text-xs"
        >
          <ArrowLeft size={12} /> Back to Queue
        </Link>
      </div>
    );
  }

  // Sort medicines: low confidence rows sort to top
  const sortedMedicines = [...analysis.medicines].sort((a, b) => {
    const isALow = a.extraction_confidence < 0.6 || a.verification_status !== "verified_match";
    const isBLow = b.extraction_confidence < 0.6 || b.verification_status !== "verified_match";
    if (isALow && !isBLow) return -1;
    if (!isALow && isBLow) return 1;
    return a.extraction_confidence - b.extraction_confidence;
  });

  const imageUrl = api.getPrescriptionImageUrl(id);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E3DC]">
        <div className="flex items-center gap-2">
          <Link
            href="/doctor"
            className="p-1 rounded text-[#747D78] hover:text-[#202722] hover:bg-white border border-transparent hover:border-[#E5E3DC] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#202722] tracking-tight">
                Review: {analysis.patient_name_detected || "Prescription Record"}
              </h1>
              <span className="font-mono text-[10px] text-[#747D78] bg-white border border-[#E5E3DC] px-2 py-0.5 rounded">
                {analysis.original_filename}
              </span>
            </div>
            <div className="text-[11px] text-[#747D78] font-mono mt-0.5">
              Prescriber: {analysis.prescriber_name_detected || "Physician"} • Quality Score: {analysis.image_quality_score}
            </div>
          </div>
        </div>

        {/* Current Review Status Badge */}
        <div className="flex items-center gap-2">
          {analysis.review_status === "approved" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20 font-mono">
              <CheckCircle2 size={13} strokeWidth={2.5} /> Approved
            </span>
          )}
          {analysis.review_status === "rejected" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20 font-mono">
              <XCircle size={13} /> Rejected
            </span>
          )}
          {analysis.review_status === "pending_review" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20 font-mono">
              <Clock size={13} className="animate-pulse" /> Pending Review
            </span>
          )}
        </div>
      </div>

      {/* Prominent Allergy Alert Banner */}
      {allergyWarnings.length > 0 && (
        <div className="p-3 bg-[#FAEEEE] border-l-4 border-l-[#A33F38] border border-[#A33F38]/20 rounded-md text-xs flex items-start gap-2.5">
          <ShieldAlert size={18} className="text-[#A33F38] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-[#A33F38] uppercase font-mono text-[11px]">
              Critical Allergy Flag Detected
            </span>
            <p className="text-[#202722] leading-relaxed">
              Patient profile documents allergy to{" "}
              <strong className="text-[#A33F38] underline">
                {allergyWarnings.map((w) => w.allergyName).join(", ")}
              </strong>
              , which may directly interact with prescribed medication{" "}
              <strong>{allergyWarnings.map((w) => w.medName).join(", ")}</strong>. Verify alternative therapy before approval.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-Side Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Prescription Viewer with Pan/Zoom & Bounding Box Overlay */}
        <div className="lg:col-span-5 bg-white border border-[#E5E3DC] rounded-xl flex flex-col overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="p-3 border-b border-[#E5E3DC] bg-[#F7F6F2] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#202722] tracking-tight flex items-center gap-1.5">
              <Eye size={14} className="text-[#315C4C]" />
              <span>Original Prescription Image</span>
            </span>

            <div className="flex items-center gap-1 bg-white border border-[#E5E3DC] rounded p-0.5">
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-[#F1EFEA] rounded text-[#202722] cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-[#F1EFEA] rounded text-[#202722] cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1 hover:bg-[#F1EFEA] rounded text-[#202722] cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
              <span className="font-mono text-[10px] text-[#747D78] px-1 tabular-nums">
                {Math.round(scale * 100)}%
              </span>
            </div>
          </div>

          {/* Interactive Pan/Zoom Canvas */}
          <div
            className="flex-1 bg-[#202722]/5 relative overflow-hidden min-h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="relative transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              {/* Prescription Image */}
              <img
                src={imageUrl}
                alt="Uploaded Prescription"
                className="max-w-[480px] w-full h-auto object-contain pointer-events-none rounded shadow-xs"
              />

              {/* Bounding Box Overlays */}
              {analysis.medicines.map((med) => {
                const bbox = med.bounding_box;
                if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) return null;

                const [ymin, xmin, ymax, xmax] = bbox;
                const isHovered = hoveredMedId === med.id || selectedMedId === med.id;

                // Scale 0-1000 to percentages
                const topPct = (ymin / 1000) * 100;
                const leftPct = (xmin / 1000) * 100;
                const heightPct = Math.max(((ymax - ymin) / 1000) * 100, 2);
                const widthPct = Math.max(((xmax - xmin) / 1000) * 100, 5);

                return (
                  <div
                    key={med.id}
                    onMouseEnter={() => setHoveredMedId(med.id)}
                    onMouseLeave={() => setHoveredMedId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedId(med.id);
                      setActiveTab("medications");
                    }}
                    style={{
                      top: `${topPct}%`,
                      left: `${leftPct}%`,
                      height: `${heightPct}%`,
                      width: `${widthPct}%`,
                    }}
                    className={`absolute transition-all duration-150 cursor-pointer rounded-xs ${
                      isHovered
                        ? "border-2 border-[#315C4C] bg-[#315C4C]/20 ring-2 ring-[#315C4C]/30 z-20"
                        : "border border-[#315C4C]/40 bg-[#315C4C]/5 hover:bg-[#315C4C]/15 z-10"
                    }`}
                  >
                    {isHovered && (
                      <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[#315C4C] text-white text-[9px] font-mono font-medium truncate max-w-[160px] shadow-xs">
                        {med.original_name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Medications, Evidence & Doctor Decision Workspace */}
        <div className="lg:col-span-7 bg-white border border-[#E5E3DC] rounded-xl flex flex-col overflow-hidden">
          {/* Tab Navigation (Zero Layout Shift) */}
          <div className="border-b border-[#E5E3DC] bg-[#F7F6F2] flex items-center justify-between px-4 pt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("medications")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "medications"
                    ? "border-[#315C4C] text-[#315C4C] bg-white rounded-t-md"
                    : "border-transparent text-[#747D78] hover:text-[#202722]"
                }`}
              >
                Extracted Medications ({analysis.medicines.length})
              </button>

              <button
                onClick={() => setActiveTab("evidence")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "evidence"
                    ? "border-[#315C4C] text-[#315C4C] bg-white rounded-t-md"
                    : "border-transparent text-[#747D78] hover:text-[#202722]"
                }`}
              >
                Drug & Food Evidence ({analysis.evidences.length})
              </button>

              <button
                onClick={() => setActiveTab("review")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "review"
                    ? "border-[#315C4C] text-[#315C4C] bg-white rounded-t-md"
                    : "border-transparent text-[#747D78] hover:text-[#202722]"
                }`}
              >
                Clinician Decision
              </button>
            </div>

            <span className="font-mono text-[10px] text-[#747D78] pb-1">
              Double-click any box to inspect
            </span>
          </div>

          {/* Tab Contents Container */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[640px]">
            {/* TAB 1: MEDICATIONS */}
            {activeTab === "medications" && (
              <div className="space-y-3">
                <p className="text-xs text-[#747D78] leading-relaxed">
                  Hovering a row highlights its bounding box on the prescription image. Edit details inline;
                  changes automatically save with rollback protection.
                </p>

                {sortedMedicines.map((med) => {
                  const isLowConf = med.extraction_confidence < 0.6 || med.verification_status !== "verified_match";
                  const isHovered = hoveredMedId === med.id || selectedMedId === med.id;
                  const isSaved = savedIndicators[med.id];

                  return (
                    <div
                      key={med.id}
                      onMouseEnter={() => setHoveredMedId(med.id)}
                      onMouseLeave={() => setHoveredMedId(null)}
                      className={`p-4 rounded-lg border transition-all ${
                        isLowConf ? "border-l-3 border-l-[#A56A19] bg-[#FCF5EB]/30" : "bg-[#F7F6F2]/60"
                      } ${
                        isHovered
                          ? "border-[#315C4C] shadow-xs bg-white"
                          : "border-[#E5E3DC]"
                      }`}
                    >
                      {/* Row Header */}
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E5E3DC]">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editForms[med.id]?.original_name ?? med.original_name}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [med.id]: { ...editForms[med.id], original_name: e.target.value },
                              })
                            }
                            onBlur={() => handleSaveMedicineField(med.id)}
                            className="font-semibold text-xs text-[#202722] bg-transparent border-b border-dashed border-[#747D78]/40 focus:border-[#315C4C] focus:bg-white focus:outline-none px-1 py-0.5 rounded"
                          />

                          {/* Confidence Chip */}
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              med.extraction_confidence >= 0.85
                                ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                                : med.extraction_confidence >= 0.6
                                ? "bg-[#F1EFEA] text-[#747D78] border border-[#E5E3DC]"
                                : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
                            }`}
                          >
                            <span>{(med.extraction_confidence * 100).toFixed(0)}%</span>
                            <span>{med.extraction_confidence >= 0.85 ? "HIGH" : med.extraction_confidence >= 0.6 ? "MED" : "LOW"}</span>
                          </span>
                        </div>

                        {/* Saved Status Indicator */}
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          {isSaved && (
                            <span className="text-[#2E7D32] flex items-center gap-0.5">
                              <Check size={11} strokeWidth={2.5} /> Saved
                            </span>
                          )}
                          <span className="text-[#747D78]">
                            RxCUI: {med.rxcui || "Unassigned"}
                          </span>
                        </div>
                      </div>

                      {/* Row Inline Fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                        <div>
                          <label className="text-[10px] text-[#747D78] block font-mono">Strength</label>
                          <input
                            type="text"
                            value={editForms[med.id]?.strength ?? ""}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [med.id]: { ...editForms[med.id], strength: e.target.value },
                              })
                            }
                            onBlur={() => handleSaveMedicineField(med.id)}
                            placeholder="e.g. 500mg"
                            className="w-full text-xs font-mono bg-white border border-[#E5E3DC] rounded px-2 py-1 focus:outline-none focus:border-[#315C4C]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-[#747D78] block font-mono">Dosage Form</label>
                          <input
                            type="text"
                            value={editForms[med.id]?.dosage ?? ""}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [med.id]: { ...editForms[med.id], dosage: e.target.value },
                              })
                            }
                            onBlur={() => handleSaveMedicineField(med.id)}
                            placeholder="e.g. 1 tablet"
                            className="w-full text-xs bg-white border border-[#E5E3DC] rounded px-2 py-1 focus:outline-none focus:border-[#315C4C]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-[#747D78] block font-mono">Frequency</label>
                          <input
                            type="text"
                            value={editForms[med.id]?.frequency ?? ""}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [med.id]: { ...editForms[med.id], frequency: e.target.value },
                              })
                            }
                            onBlur={() => handleSaveMedicineField(med.id)}
                            placeholder="e.g. TDS"
                            className="w-full text-xs font-mono bg-white border border-[#E5E3DC] rounded px-2 py-1 focus:outline-none focus:border-[#315C4C]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-[#747D78] block font-mono">Timing / Food</label>
                          <input
                            type="text"
                            value={editForms[med.id]?.food_instructions ?? ""}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [med.id]: { ...editForms[med.id], food_instructions: e.target.value },
                              })
                            }
                            onBlur={() => handleSaveMedicineField(med.id)}
                            placeholder="e.g. After meals"
                            className="w-full text-xs bg-white border border-[#E5E3DC] rounded px-2 py-1 focus:outline-none focus:border-[#315C4C]"
                          />
                        </div>
                      </div>

                      {/* Normalized Ontology Match */}
                      {med.normalized_name && (
                        <div className="mt-2 text-[11px] text-[#747D78] font-mono flex items-center justify-between">
                          <span>Grounding: {med.normalized_name}</span>
                          <span className="capitalize">{med.verification_status.replace(/_/g, " ")}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: EVIDENCE */}
            {activeTab === "evidence" && (
              <div className="space-y-3">
                <p className="text-xs text-[#747D78] leading-relaxed">
                  Evidence quotes retrieved from official FDA Structured Product Labels (SPL) and openFDA index.
                </p>

                {analysis.evidences.map((ev) => {
                  const isExpanded = expandedEvidences[ev.id];
                  const isAvoid = ev.evidence_category === "avoid_contraindicated";

                  return (
                    <div
                      key={ev.id}
                      className={`p-4 rounded-lg border text-xs space-y-2 ${
                        isAvoid ? "bg-[#FAEEEE]/30 border-[#A33F38]/30" : "bg-[#F7F6F2] border-[#E5E3DC]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[#202722]">
                            {ev.medicine_name} + {ev.food_or_substance}
                          </span>
                          <span className="text-[10px] text-[#747D78] font-mono block">
                            Provider: {ev.source_provider} • Section: {ev.source_section || "Clinical Pharmacology"}
                          </span>
                        </div>

                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isAvoid ? "bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20" : "bg-white text-[#315C4C] border border-[#E5E3DC]"
                          }`}
                        >
                          {ev.evidence_category.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-[#202722] font-medium leading-relaxed">
                        {ev.plain_language_summary}
                      </p>

                      {/* Excerpt with Show More */}
                      <div className="p-2.5 bg-white border border-[#E5E3DC] rounded text-[11px] text-[#747D78] font-mono leading-relaxed">
                        <div className={isExpanded ? "" : "line-clamp-2"}>
                          "{ev.evidence_excerpt}"
                        </div>
                        <button
                          onClick={() =>
                            setExpandedEvidences((prev) => ({
                              ...prev,
                              [ev.id]: !prev[ev.id],
                            }))
                          }
                          className="mt-1 text-[#315C4C] hover:underline font-sans text-xs inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              Show less <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              Show full label excerpt <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-[#747D78]">
                        <span>Doc: {ev.source_document_title}</span>
                        {ev.official_source_url && (
                          <a
                            href={ev.official_source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#315C4C] hover:underline flex items-center gap-0.5"
                          >
                            Official Source <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: REVIEW DECISIONS */}
            {activeTab === "review" && (
              <div className="space-y-4">
                <div className="p-4 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg space-y-3">
                  <h3 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                    Physician Sign-Off Notes
                  </h3>
                  <textarea
                    rows={4}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter clinical review notes or specific patient precautions before approval..."
                    className="w-full text-xs p-3 bg-white border border-[#E5E3DC] rounded-md text-[#202722] focus:outline-none focus:border-[#315C4C] leading-relaxed"
                  />
                </div>

                <div className="p-4 bg-[#EDF7EE] border border-[#2E7D32]/20 rounded-lg text-xs space-y-2">
                  <span className="font-semibold text-[#2E7D32] flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Approval Checkpoint
                  </span>
                  <p className="text-[#202722] leading-relaxed">
                    Approving releases the verified medication guide and dietary schedule to the patient's portal.
                    All unverified rows will be locked for editing upon sign-off.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Action Bar at Bottom of Workspace */}
          <div className="p-4 border-t border-[#E5E3DC] bg-[#F7F6F2] flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-[#747D78]">
              {analysis.medicines.length} medications ready for sign-off
            </span>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowRejectDialog(true)}
                className="px-4 py-2 border border-[#A33F38]/40 hover:border-[#A33F38] text-[#A33F38] bg-white hover:bg-[#FAEEEE] rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                Reject & Request Re-Upload
              </button>

              <button
                onClick={() => setShowApproveDialog(true)}
                className="px-5 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white rounded-md text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Approve & Release Guide</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRM APPROVAL MODAL DIALOG */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E3DC] rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5E3DC]">
              <div className="w-8 h-8 rounded-full bg-[#EDF7EE] text-[#2E7D32] flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
              <h3 className="text-base font-semibold text-[#202722]">Confirm Prescription Approval</h3>
            </div>

            <p className="text-xs text-[#747D78] leading-relaxed">
              You are about to sign off on{" "}
              <strong className="text-[#202722]">{analysis.medicines.length} medications</strong> for patient{" "}
              <strong className="text-[#202722]">{analysis.patient_name_detected || "Patient"}</strong>.
              This will unlock the patient's schedule and food warnings.
            </p>

            <label className="flex items-start gap-2.5 p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmNoAmbiguities}
                onChange={(e) => setConfirmNoAmbiguities(e.target.checked)}
                className="mt-0.5 rounded border-[#E5E3DC] text-[#315C4C] focus:ring-[#315C4C]"
              />
              <span className="text-[#202722] font-medium leading-snug">
                I have clinically verified all drug names, strengths, and timings, and resolved any handwriting ambiguities.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveDialog(false)}
                disabled={isSubmittingDecision}
                className="px-3.5 py-2 border border-[#E5E3DC] text-[#747D78] hover:text-[#202722] rounded-md text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!confirmNoAmbiguities || isSubmittingDecision}
                className="px-4 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white rounded-md text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDecision ? "Signing off..." : "Confirm & Sign Off"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REJECT MODAL DIALOG */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E3DC] rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5E3DC]">
              <div className="w-8 h-8 rounded-full bg-[#FAEEEE] text-[#A33F38] flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-base font-semibold text-[#202722]">Reject Prescription</h3>
            </div>

            <p className="text-xs text-[#747D78] leading-relaxed">
              Please provide a clinical explanation for the rejection. This reason will be displayed directly
              to the patient so they know what clarification or photo re-upload is required.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#202722] mb-1">
                Reason for Rejection (min 10 characters)
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Handwriting for item #3 is illegible; please re-upload a sharper image showing clear dosage..."
                className="w-full text-xs p-2.5 bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] focus:bg-white focus:outline-none focus:border-[#A33F38]"
              />
              <span className="text-[10px] font-mono text-[#747D78] mt-1 block">
                {rejectionReason.length}/10 minimum characters
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectDialog(false)}
                disabled={isSubmittingDecision}
                className="px-3.5 py-2 border border-[#E5E3DC] text-[#747D78] hover:text-[#202722] rounded-md text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectionReason.trim().length < 10 || isSubmittingDecision}
                className="px-4 py-2 bg-[#A33F38] hover:bg-[#8F332C] text-white rounded-md text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDecision ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
