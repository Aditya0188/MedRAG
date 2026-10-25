"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Sliders } from "lucide-react";
import { api, Analysis } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PipelineStepper from "@/components/PipelineStepper";

export default function PatientUploadPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [pipelineFinished, setPipelineFinished] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login?redirect=/patient");
    }
  }, [user, isLoading, router]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toastError(`Unsupported file format. Please upload JPEG, PNG, or PDF.`);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toastError("File size exceeds 15 MB limit.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!user) {
      toastError("Authentication required. Please log in or create an account to proceed.");
      router.push("/login?redirect=/patient");
      return;
    }
    if (!selectedFile) return;
    setIsUploading(true);
    setPipelineFinished(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("auto_process", "true");

      const res = await api.createAnalysis(formData);
      setActiveAnalysisId(res.id);
      toastSuccess("Prescription uploaded. Processing live pipeline...");
    } catch (err: any) {
      toastError(err.message || "Failed to upload prescription.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDemoScenario = async (scenarioId: string) => {
    if (!user) {
      toastError("Authentication required. Please log in or create an account to proceed.");
      router.push("/login?redirect=/patient");
      return;
    }
    setIsUploading(true);
    setPipelineFinished(false);
    try {
      const formData = new FormData();
      formData.append("demo_scenario_id", scenarioId);
      formData.append("auto_process", "true");

      const res = await api.createAnalysis(formData);
      setActiveAnalysisId(res.id);
      toastSuccess("Academic test prescription loaded into processing pipeline.");
    } catch (err: any) {
      toastError(err.message || "Failed to launch demo prescription.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      {/* Prototype Disclaimer Banner */}
      <div className="flex items-start gap-3 p-3.5 bg-white border border-[#E5E3DC] rounded-lg text-xs">
        <ShieldAlert size={16} className="text-[#315C4C] shrink-0 mt-0.5" />
        <div className="text-[#202722] leading-relaxed">
          <span className="font-semibold">Clinical Decision-Support Prototype:</span> This platform is designed
          for research and decision-support. Unapproved prescription summaries are never displayed directly to patients;
          all medication schedules and food guidance require verified clinician sign-off.
        </div>
      </div>

      {/* Main Upload Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Card */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#202722] tracking-tight">
                Upload Prescription
              </h2>
              <Link
                href="/developer/settings"
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#747D78] hover:text-[#315C4C] transition-colors px-2 py-1 rounded bg-[#F7F6F2] border border-[#E5E3DC] hover:border-[#315C4C]/40"
                title="Configure Gemini Vision API Key in Developer Settings"
              >
                <Sliders size={12} />
                <span>Developer Settings</span>
              </Link>
            </div>
            <p className="text-xs text-[#747D78] mt-1 leading-relaxed">
              Upload an outpatient prescription image (JPEG, PNG) or multi-page digital PDF for automated
              transcription, RxNorm grounding, and FDA drug-food interaction checks.
            </p>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-[#315C4C] bg-[#E8EEE8]/40"
                  : selectedFile
                  ? "border-[#315C4C]/50 bg-[#F7F6F2]"
                  : "border-[#E5E3DC] hover:border-[#315C4C]/50 hover:bg-[#F7F6F2]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              <div className="w-10 h-10 rounded-full bg-[#E8EEE8] text-[#315C4C] flex items-center justify-center mb-2.5">
                {selectedFile ? <FileText size={20} /> : <Upload size={20} />}
              </div>

              {selectedFile ? (
                <div>
                  <div className="font-medium text-xs text-[#202722]">{selectedFile.name}</div>
                  <div className="font-mono text-[11px] text-[#747D78] mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Click to choose different file
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-xs text-[#202722]">
                    Drag and drop prescription document here
                  </div>
                  <div className="text-[11px] text-[#747D78] mt-1">
                    Or click to browse from device (JPEG, PNG, PDF up to 15MB)
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-[#747D78] font-mono">
                Mandatory doctor review enforced
              </span>

              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isUploading ? "Uploading..." : "Start Analysis Pipeline"}
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Quick Demo Pre-load Options */}
            <div className="mt-6 pt-4 border-t border-[#E5E3DC]">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#747D78] uppercase tracking-wider mb-2.5">
                <Sparkles size={12} className="text-[#315C4C]" />
                <span>Or Select an Academic Test Scenario</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoScenario("scenario_1_clear")}
                  disabled={isUploading}
                  className="p-2 text-left border border-[#E5E3DC] hover:border-[#315C4C] rounded-md bg-[#F7F6F2] hover:bg-white text-xs transition-colors cursor-pointer group"
                >
                  <div className="font-medium text-[#202722] group-hover:text-[#315C4C]">
                    Scenario 1: Clear Outpatient Rx
                  </div>
                  <div className="text-[10px] text-[#747D78] font-mono">Amoxicillin + Ibuprofen</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoScenario("scenario_2_moderate")}
                  disabled={isUploading}
                  className="p-2 text-left border border-[#E5E3DC] hover:border-[#315C4C] rounded-md bg-[#F7F6F2] hover:bg-white text-xs transition-colors cursor-pointer group"
                >
                  <div className="font-medium text-[#202722] group-hover:text-[#315C4C]">
                    Scenario 2: Ambiguous Handwriting
                  </div>
                  <div className="text-[10px] text-[#747D78] font-mono">Ciprofloxacin warning</div>
                </button>
              </div>
            </div>
          </div>

          {/* Calm Review Timeline Card */}
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-5">
            <h3 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono mb-3">
              Verification Protocol
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-[#EDF7EE] border border-[#2E7D32]/20 rounded-md">
                <CheckCircle2 size={16} className="mx-auto text-[#2E7D32] mb-1" />
                <div className="font-medium text-[#202722]">1. Uploaded</div>
                <div className="text-[10px] text-[#747D78]">Extracted & grounded</div>
              </div>

              <div className="p-3 bg-[#FCF5EB] border border-[#A56A19]/20 rounded-md">
                <Clock size={16} className="mx-auto text-[#A56A19] mb-1 animate-pulse" />
                <div className="font-medium text-[#202722]">2. Doctor Review</div>
                <div className="text-[10px] text-[#747D78]">Triage verification</div>
              </div>

              <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-md">
                <CheckCircle2 size={16} className="mx-auto text-[#747D78] mb-1" />
                <div className="font-medium text-[#747D78]">3. Approved Guide</div>
                <div className="text-[10px] text-[#747D78]">Dosage & diet unlocked</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Stepper Feedback */}
        <div className="lg:col-span-5 space-y-4">
          {activeAnalysisId ? (
            <div className="space-y-4">
              <PipelineStepper
                analysisId={activeAnalysisId}
                onComplete={() => {
                  setPipelineFinished(true);
                }}
              />

              {pipelineFinished && (
                <div className="p-4 bg-[#EDF7EE] border border-[#2E7D32]/30 rounded-lg text-xs space-y-2">
                  <div className="font-semibold text-[#2E7D32] flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Pipeline Successfully Completed
                  </div>
                  <p className="text-[#202722] leading-relaxed">
                    Your prescription has been safely processed and is now queued for your clinician to review.
                    Once approved, your interactive daily schedule and dietary guidance will unlock automatically.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/patient/history"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] text-white rounded text-xs font-medium hover:bg-[#25463A] transition-colors"
                    >
                      <span>Check Prescription History</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#E5E3DC] rounded-lg p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#F1EFEA] border border-[#E5E3DC] flex items-center justify-center mx-auto text-[#747D78]">
                <Clock size={18} />
              </div>
              <h3 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                Pipeline Monitor
              </h3>
              <p className="text-xs text-[#747D78] leading-relaxed">
                When you upload a prescription or launch a test scenario, the real-time vertical stepper will
                stream live progress through each of the 8 clinical pipeline stages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
