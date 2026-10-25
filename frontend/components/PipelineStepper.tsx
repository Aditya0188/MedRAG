"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Check, AlertTriangle, RotateCw, Clock, ArrowRight, Sliders } from "lucide-react";
import { api, StageItem, StageProgressEvent } from "@/lib/api";

const DEFAULT_STAGES: Array<{ key: string; label: string }> = [
  { key: "uploaded", label: "Prescription Uploaded" },
  { key: "quality_checked", label: "Image Quality Checked" },
  { key: "handwriting_analyzed", label: "Handwriting Analyzed" },
  { key: "extraction_complete", label: "Medicine Details Extracted" },
  { key: "verification_complete", label: "Drug Names Verified" },
  { key: "evidence_retrieved", label: "Official Drug Labels Retrieved" },
  { key: "evidence_complete", label: "Evidence Assembled" },
  { key: "pending_review", label: "Doctor Review Required" },
];

interface PipelineStepperProps {
  analysisId: string;
  onComplete?: (analysisId: string) => void;
  className?: string;
}

export default function PipelineStepper({ analysisId, onComplete, className = "" }: PipelineStepperProps) {
  const [stages, setStages] = useState<StageItem[]>(
    DEFAULT_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      status: "pending",
      duration_ms: 0,
    }))
  );
  const [overallStatus, setOverallStatus] = useState<"running" | "done" | "failed">("running");
  const [totalElapsedMs, setTotalElapsedMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const completedCalledRef = useRef<boolean>(false);

  const handleDone = useCallback(() => {
    if (completedCalledRef.current) return;
    completedCalledRef.current = true;
    if (onComplete) {
      setTimeout(() => {
        onComplete(analysisId);
      }, 900);
    }
  }, [analysisId, onComplete]);

  // Fallback Polling if EventSource is unavailable or disconnects
  const pollFallback = useCallback(async () => {
    try {
      const res = await api.getAnalysisStatus(analysisId);
      const isDone = res.status === "completed" || ["pending_review", "approved", "rejected"].includes(res.review_status);
      const isFailed = res.status === "failed";

      const elapsed = res.total_processing_duration_sec > 0
        ? Math.round(res.total_processing_duration_sec * 1000)
        : Date.now() - startTimeRef.current;

      setTotalElapsedMs(elapsed);

      setStages((prev) => {
        const activeIdx = prev.findIndex((s) => s.key === res.stage);
        return prev.map((s, idx) => {
          let st: "pending" | "running" | "done" | "failed" = "pending";
          if (isFailed && s.key === res.failed_stage) st = "failed";
          else if (idx < activeIdx || (isDone && idx <= activeIdx)) st = "done";
          else if (idx === activeIdx && !isDone) st = "running";
          return {
            ...s,
            status: st,
            duration_ms: st === "done" ? Math.round(elapsed / (activeIdx + 1)) : 0,
          };
        });
      });

      if (isDone) {
        setOverallStatus("done");
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        handleDone();
      } else if (isFailed) {
        setOverallStatus("failed");
        setErrorMessage(res.error_message || "Pipeline encountered a processing error.");
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    } catch {
      // ignore transient polling errors
    }
  }, [analysisId, handleDone]);

  // Connect to live SSE Stream
  useEffect(() => {
    startTimeRef.current = Date.now();
    completedCalledRef.current = false;

    const sseUrl = api.getEventsUrl(analysisId);
    let sse: EventSource | null = null;

    try {
      sse = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data: StageProgressEvent = JSON.parse(event.data);
          setTotalElapsedMs(data.elapsed_ms);

          if (data.stages && data.stages.length > 0) {
            setStages(data.stages);
          }

          if (data.status === "done") {
            setOverallStatus("done");
            if (sse) sse.close();
            handleDone();
          } else if (data.status === "failed") {
            setOverallStatus("failed");
            setErrorMessage(data.error_message || "Processing failed at stage: " + (data.failed_stage || "unknown"));
            if (sse) sse.close();
          } else {
            setOverallStatus("running");
          }
        } catch {
          // parse error
        }
      };

      sse.onerror = () => {
        // SSE disconnected: fallback to polling
        if (sse) sse.close();
        if (!pollIntervalRef.current && overallStatus === "running") {
          pollIntervalRef.current = setInterval(pollFallback, 1000);
        }
      };
    } catch {
      // If EventSource throws, initiate polling immediately
      pollIntervalRef.current = setInterval(pollFallback, 1000);
    }

    return () => {
      if (sse) sse.close();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [analysisId, pollFallback, handleDone, overallStatus]);

  // Live timer tick during running state
  useEffect(() => {
    if (overallStatus !== "running") return;
    const interval = setInterval(() => {
      setTotalElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [overallStatus]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorMessage(null);
    setOverallStatus("running");
    startTimeRef.current = Date.now();

    try {
      await api.retryAnalysis(analysisId);
      // Restart polling or let SSE reconnect
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(pollFallback, 800);
    } catch (err: any) {
      setErrorMessage(err.message || "Retry failed to initiate.");
      setOverallStatus("failed");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`bg-white border border-[#E5E3DC] rounded-lg p-5 ${className}`}>
      {/* Header with Title and Elapsed Timer */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E3DC]">
        <div>
          <h3 className="font-semibold text-sm text-[#202722] tracking-tight">
            Clinical Pipeline Progress
          </h3>
          <p className="text-xs text-[#747D78] mt-0.5">
            8-stage multimodal extraction & verification gateway
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#315C4C] bg-[#E8EEE8] px-2.5 py-1 rounded">
          <Clock size={12} className={overallStatus === "running" ? "animate-spin" : ""} />
          <span className="tabular-nums font-medium">
            {(totalElapsedMs / 1000).toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Stepper Body */}
      <div className="mt-5 space-y-0 relative">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const isDone = stage.status === "done";
          const isRunning = stage.status === "running";
          const isFailed = stage.status === "failed";
          const isPending = stage.status === "pending";

          return (
            <div key={stage.key} className="flex items-start gap-3 group relative">
              {/* Connecting Vertical Line */}
              {!isLast && (
                <div
                  className={`absolute left-[13px] top-[26px] bottom-0 w-[2px] transition-colors duration-300 ${
                    isDone ? "bg-[#315C4C]" : "bg-[#E5E3DC]"
                  }`}
                  style={{ height: "calc(100% - 10px)" }}
                />
              )}

              {/* Step Icon Badge */}
              <div
                className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-200 shrink-0 ${
                  isDone
                    ? "bg-[#315C4C] border-[#315C4C] text-white"
                    : isRunning
                    ? "bg-[#E8EEE8] border-[#315C4C] text-[#315C4C]"
                    : isFailed
                    ? "bg-[#FAEEEE] border-[#A33F38] text-[#A33F38]"
                    : "bg-[#F7F6F2] border-[#E5E3DC] text-[#747D78]"
                }`}
              >
                {isDone && <Check size={14} strokeWidth={2.5} />}
                {isRunning && (
                  <span className="w-2 h-2 rounded-full bg-[#315C4C] animate-pulse" />
                )}
                {isFailed && <AlertTriangle size={13} strokeWidth={2.5} />}
                {isPending && (
                  <span className="font-mono text-[10px] text-[#747D78] tabular-nums">
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Step Details */}
              <div className="flex-1 pb-4 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xs tracking-tight transition-colors ${
                      isRunning
                        ? "font-semibold text-[#202722]"
                        : isDone
                        ? "font-medium text-[#202722]"
                        : isFailed
                        ? "font-semibold text-[#A33F38]"
                        : "text-[#747D78]"
                    }`}
                  >
                    {stage.label}
                  </span>

                  {/* Stage Duration in IBM Plex Mono */}
                  {isDone && stage.duration_ms > 0 && (
                    <span className="font-mono text-[11px] text-[#747D78] tabular-nums shrink-0">
                      {stage.duration_ms}ms
                    </span>
                  )}
                  {isRunning && (
                    <span className="font-mono text-[11px] text-[#315C4C] tabular-nums animate-pulse shrink-0">
                      running
                    </span>
                  )}
                </div>

                {/* Inline Error & Retry on Failure */}
                {isFailed && (
                  <div className="mt-2 p-3 bg-[#FAEEEE] border border-[#A33F38]/20 rounded text-xs space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle size={14} className="text-[#A33F38] shrink-0 mt-0.5" />
                      <p className="text-[#A33F38] font-medium leading-relaxed">
                        {errorMessage || "Stage failed during execution."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(errorMessage?.toLowerCase().includes("api key") ||
                        errorMessage?.toLowerCase().includes("api_key") ||
                        errorMessage?.toLowerCase().includes("invalid_argument")) && (
                        <Link
                          href="/developer/settings"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] hover:bg-[#25463A] text-white rounded text-xs font-medium transition-colors shadow-xs"
                        >
                          <Sliders size={12} />
                          <span>Enter API Key in Developer Settings</span>
                        </Link>
                      )}

                      <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A33F38] hover:bg-[#8F332C] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <RotateCw size={12} className={isRetrying ? "animate-spin" : ""} />
                        {isRetrying ? "Retrying..." : "Retry Pipeline"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Transition Notice */}
      {overallStatus === "done" && (
        <div className="mt-4 pt-3 border-t border-[#E5E3DC] flex items-center justify-between text-xs text-[#315C4C]">
          <span className="font-medium flex items-center gap-1.5">
            <Check size={14} /> Pipeline completed successfully
          </span>
          <span className="font-mono text-[11px] text-[#747D78] flex items-center gap-1">
            Redirecting <ArrowRight size={12} />
          </span>
        </div>
      )}
    </div>
  );
}
