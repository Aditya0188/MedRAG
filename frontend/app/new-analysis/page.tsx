"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  Info,
  X,
  Key
} from "lucide-react";
import { api } from "@/lib/api";

const STAGES = [
  { id: "uploaded", label: "Prescription Uploaded", desc: "File format and checksum verified" },
  { id: "quality_checked", label: "Image Quality Checked", desc: "Laplacian sharpness & contrast computed" },
  { id: "handwriting_analyzed", label: "Handwriting Analyzed", desc: "Multimodal Gemini Vision reading" },
  { id: "extraction_complete", label: "All Medicine Details Extracted", desc: "Dosage, strength, route & timing structured" },
  { id: "verification_complete", label: "Drug Names Verified", desc: "RxNorm API ontological concept grounding" },
  { id: "evidence_complete", label: "Official Drug Labels Retrieved", desc: "FDA DailyMed & openFDA records queried" },
  { id: "qdrant_assembled", label: "Evidence Assembled", desc: "Qdrant vector similarity & passage matching" },
  { id: "pending_review", label: "Doctor Review Required", desc: "Ready for clinician triage verification" },
];

export default function NewAnalysisPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [hasApiKey, setHasApiKey] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStageIndex, setActiveStageIndex] = useState<number>(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Zoom controls for preview
  const [zoomLevel, setZoomLevel] = useState(1.0);

  useEffect(() => {
    api.getKeyStatus()
      .then((res) => {
        setHasApiKey(res.has_key);
      })
      .catch(() => setHasApiKey(false));
  }, []);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setIsSavingKey(true);
    setKeySaveMessage(null);
    try {
      const res = await api.updateApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setKeySaveMessage(res.message);
      setApiKeyInput("");
    } catch (err: any) {
      alert("Failed to save key: " + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);

    // Check format
    const validExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      setErrorMessage(`Unsupported format '${ext}'. Please upload a JPEG, PNG, or PDF.`);
      return;
    }

    // Check size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds 15 MB limit. Please select a smaller file.");
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a prescription image or document to analyze.");
      return;
    }

    if (!hasApiKey) {
      setErrorMessage("Please enter your Gemini API Key below so the vision model can analyze your prescription.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setActiveStageIndex(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("auto_process", "true");

      // Step 1: Create Analysis & begin processing
      setActiveStageIndex(0);
      const analysis = await api.createAnalysis(formData);

      // Poll actual status until completed or failed
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getAnalysisStatus(analysis.id);
          
          if (status.stage === "quality_checked") setActiveStageIndex(1);
          else if (status.stage === "handwriting_analyzed") setActiveStageIndex(2);
          else if (status.stage === "extraction_complete") setActiveStageIndex(3);
          else if (status.stage === "verification_complete") setActiveStageIndex(4);
          else if (status.stage === "evidence_complete") setActiveStageIndex(6);
          else if (status.stage === "pending_review" || status.status === "completed") {
            setActiveStageIndex(7);
            clearInterval(pollInterval);
            setIsProcessing(false);
            // Navigate to Analysis Workspace
            setTimeout(() => {
              router.push(`/analysis/${analysis.id}`);
            }, 600);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorMessage(status.error_message || "Prescription processing encountered an error.");
          }
        } catch {
          // continue polling
        }
      }, 700);

    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || "Failed to initiate prescription analysis.");
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E5E3DC]">
        <h1 className="text-2xl font-semibold text-[#202722] tracking-tight">
          New Prescription Analysis
        </h1>
        <p className="text-xs text-[#747D78] mt-1">
          Upload any medical prescription image or PDF. The multimodal AI pipeline will transcribe all prescribed medications, ground each in RxNorm, and retrieve official FDA dietary interaction warnings.
        </p>
      </div>

      {/* API Key Banner if Missing */}
      {!hasApiKey && (
        <div className="p-5 rounded-lg bg-[#FCF5EB] border border-[#A56A19]/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#A56A19]">
            <Key size={18} />
            <span>Gemini API Key Required for Prescription Vision Analysis</span>
          </div>
          <p className="text-xs text-[#202722] leading-relaxed">
            To read handwritten prescriptions and extract medicine line items using Google Gen AI, please enter your Gemini API Key below. (You can generate a free key from{" "}
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold text-[#315C4C]"
            >
              Google AI Studio
            </a>
            ).
          </p>

          <form onSubmit={handleSaveApiKey} className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste your Gemini API Key (e.g. AIzaSy...)"
              className="w-full sm:flex-1 px-3 py-2 rounded border border-[#E5E3DC] bg-white text-xs text-[#202722] focus:outline-none focus:border-[#315C4C]"
            />
            <button
              type="submit"
              disabled={isSavingKey || !apiKeyInput.trim()}
              className="w-full sm:w-auto px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-semibold hover:bg-[#28493c] transition-colors shadow-xs"
            >
              {isSavingKey ? "Activating..." : "Save & Activate Key"}
            </button>
          </form>

          {keySaveMessage && (
            <p className="text-xs font-mono text-[#2E7D32] flex items-center gap-1">
              <CheckCircle2 size={12} /> {keySaveMessage}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-md bg-[#FAEEEE] border border-[#A33F38]/30 text-[#A33F38] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-[#A33F38] hover:text-[#7d2e28]">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Document Zone */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-lg bg-white border border-[#E5E3DC] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#202722] uppercase font-mono">
                Upload Prescription Image or Document
              </span>
              <span className="text-[11px] text-[#747D78] font-mono">JPG, PNG, WEBP, PDF (Max 15MB)</span>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                selectedFile
                  ? "border-[#315C4C] bg-[#E8EEE8]/20"
                  : "border-[#E5E3DC] hover:border-[#315C4C] hover:bg-[#F7F6F2]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud size={40} className="mx-auto text-[#747D78] mb-3" />
              <p className="text-sm font-medium text-[#202722]">
                {selectedFile ? selectedFile.name : "Drag and drop your prescription file here, or click to browse"}
              </p>
              <p className="text-xs text-[#747D78] mt-1.5 font-mono">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • ${selectedFile.type || "Document"}`
                  : "Supports smartphone photos, scanned OPD prescription slips, and hospital PDF charts"}
              </p>
            </div>

            {/* Selected File Card & Actions */}
            {selectedFile && (
              <div className="p-3 rounded bg-[#F7F6F2] border border-[#E5E3DC] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={16} className="text-[#315C4C] shrink-0" />
                  <span className="font-semibold text-[#202722] truncate">{selectedFile.name}</span>
                  <span className="font-mono text-[#747D78] shrink-0">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="text-[#A33F38] hover:underline font-mono text-[11px] shrink-0"
                >
                  Remove file
                </button>
              </div>
            )}

            {/* Image Preview with Zoom */}
            {filePreview && (
              <div className="space-y-2 pt-2 border-t border-[#E5E3DC]">
                <div className="flex items-center justify-between text-xs text-[#747D78]">
                  <span className="font-medium text-[#202722]">High-Resolution Preview</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
                      className="p-1 rounded hover:bg-[#F1EFEA]"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="font-mono text-[10px] w-10 text-center">
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
                      title="Reset Zoom"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="h-72 overflow-auto border border-[#E5E3DC] rounded bg-[#F1EFEA] flex items-center justify-center p-2">
                  <img
                    src={filePreview}
                    alt="Prescription Preview"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
                    className="max-h-full object-contain transition-transform duration-150"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Details & Pipeline Progress */}
        <div className="lg:col-span-5 space-y-6">
          {/* Action Trigger Card */}
          <div className="p-5 rounded-lg bg-white border border-[#E5E3DC] space-y-4">
            <h3 className="text-sm font-semibold text-[#202722]">Ready to Process</h3>
            <p className="text-xs text-[#747D78] leading-relaxed">
              The AI multimodal pipeline reads your uploaded prescription image, transcribes <strong>all medications</strong> without omission, grounds each medicine in NLM RxNorm, and retrieves official FDA DailyMed & openFDA drug-food interaction evidence.
            </p>

            <button
              onClick={handleStartAnalysis}
              disabled={isProcessing || !selectedFile}
              className={`w-full py-3 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-xs ${
                isProcessing || !selectedFile
                  ? "bg-[#315C4C]/50 cursor-not-allowed"
                  : "bg-[#315C4C] hover:bg-[#28493c]"
              }`}
            >
              {isProcessing ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  Running Pipeline Stage {activeStageIndex + 1} of 8...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analyze Prescription
                </>
              )}
            </button>
          </div>

          {/* Real-Time Processing Pipeline Tracker */}
          <div className="p-5 rounded-lg bg-white border border-[#E5E3DC] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#202722] uppercase font-mono">
                Pipeline Stages
              </h3>
              {isProcessing && (
                <span className="text-[10px] font-mono text-[#315C4C] animate-pulse">
                  ● Processing
                </span>
              )}
            </div>

            <div className="space-y-3">
              {STAGES.map((st, idx) => {
                const isCompleted = activeStageIndex > idx;
                const isCurrent = activeStageIndex === idx && isProcessing;

                return (
                  <div key={st.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 size={16} className="text-[#2E7D32]" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-[#315C4C] border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[#E5E3DC] bg-[#F7F6F2] flex items-center justify-center text-[9px] font-mono text-[#747D78]">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          isCompleted
                            ? "text-[#2E7D32]"
                            : isCurrent
                            ? "text-[#315C4C] font-semibold"
                            : "text-[#747D78]"
                        }`}
                      >
                        {st.label}
                      </p>
                      <p className="text-[10px] text-[#747D78] font-mono leading-tight">
                        {st.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
