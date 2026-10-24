"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FilePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  ArrowRight,
  Database,
  Search,
  Sparkles,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { api, DashboardMetrics } from "@/lib/api";

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5E3DC]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8EEE8] text-[#315C4C] text-xs font-mono font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-[#315C4C]" />
            Clinical Multimodal AI Platform
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-[#202722] tracking-tight">
            Medical Document Analysis & RAG
          </h1>
          <p className="text-sm text-[#747D78] mt-1 max-w-2xl leading-relaxed">
            AI-assisted handwritten prescription recognition, official RxNorm terminology verification,
            FDA drug-food interaction retrieval via Qdrant RAG, and physician verification triage gateway.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="p-2.5 rounded-md border border-[#E5E3DC] bg-white text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            href="/new-analysis"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#315C4C] text-white text-sm font-medium hover:bg-[#28493c] transition-colors shadow-xs"
          >
            <FilePlus size={16} />
            New Prescription Analysis
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Analyses */}
        <div className="p-4 rounded-lg bg-white border border-[#E5E3DC]">
          <p className="text-xs font-mono uppercase text-[#747D78]">Total Analyses</p>
          <p className="text-2xl font-semibold text-[#202722] mt-1 font-mono">
            {metrics?.total_analyses ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-[#747D78] mt-1">Prescriptions processed</p>
        </div>

        {/* Card 2: Pending Reviews */}
        <div className="p-4 rounded-lg bg-[#FCF5EB] border border-[#A56A19]/30">
          <p className="text-xs font-mono uppercase text-[#A56A19] font-medium">Pending Review</p>
          <p className="text-2xl font-semibold text-[#A56A19] mt-1 font-mono">
            {metrics?.pending_doctor_reviews ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-[#A56A19]/80 mt-1">Awaiting clinician sign-off</p>
        </div>

        {/* Card 3: Approved Reports */}
        <div className="p-4 rounded-lg bg-[#EDF7EE] border border-[#2E7D32]/30">
          <p className="text-xs font-mono uppercase text-[#2E7D32] font-medium">Approved Reports</p>
          <p className="text-2xl font-semibold text-[#2E7D32] mt-1 font-mono">
            {metrics?.approved_reports ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-[#2E7D32]/80 mt-1">Patient summaries unlocked</p>
        </div>

        {/* Card 4: Rejected Reports */}
        <div className="p-4 rounded-lg bg-white border border-[#E5E3DC]">
          <p className="text-xs font-mono uppercase text-[#747D78]">Rejected</p>
          <p className="text-2xl font-semibold text-[#A33F38] mt-1 font-mono">
            {metrics?.rejected_reports ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-[#747D78] mt-1">Declined by doctor</p>
        </div>

        {/* Card 5: Avg Processing Duration */}
        <div className="p-4 rounded-lg bg-white border border-[#E5E3DC]">
          <p className="text-xs font-mono uppercase text-[#747D78]">Avg Pipeline Time</p>
          <p className="text-2xl font-semibold text-[#202722] mt-1 font-mono">
            {metrics ? `${metrics.average_processing_time_sec}s` : (loading ? "..." : "0.0s")}
          </p>
          <p className="text-[11px] text-[#747D78] mt-1">End-to-end extraction</p>
        </div>

        {/* Card 6: Doctor Review Speed */}
        <div className="p-4 rounded-lg bg-white border border-[#E5E3DC]">
          <p className="text-xs font-mono uppercase text-[#747D78]">Doctor Triage</p>
          <p className="text-2xl font-semibold text-[#315C4C] mt-1 font-mono">
            {metrics ? `${metrics.average_review_time_sec}s` : (loading ? "..." : "0.0s")}
          </p>
          <p className="text-[11px] text-[#747D78] mt-1">Triage review duration</p>
        </div>
      </div>

      {/* 8-Stage Processing Architecture Walkthrough */}
      <div className="p-6 rounded-lg bg-white border border-[#E5E3DC] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#202722] tracking-tight">
              Clinical Investigation Pipeline Architecture
            </h2>
            <p className="text-xs text-[#747D78]">
              Multi-stage pipeline formulated to simultaneously resolve visual comprehension, terminology ontology, and dietary safety.
            </p>
          </div>
          <span className="text-xs font-mono text-[#315C4C] px-2 py-1 rounded bg-[#E8EEE8]">
            8 Verified Stages
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
          {[
            { step: "1", title: "Upload", desc: "JPEG / PNG / PDF" },
            { step: "2", title: "Quality", desc: "Laplacian Blur & Contrast" },
            { step: "3", title: "Vision AI", desc: "Multimodal Gemini + OCR" },
            { step: "4", title: "Extraction", desc: "Extract All Med Items" },
            { step: "5", title: "RxNorm", desc: "Ontological Grounding" },
            { step: "6", title: "FDA Labels", desc: "DailyMed & openFDA" },
            { step: "7", title: "Qdrant RAG", desc: "Dietary Interaction Chunks" },
            { step: "8", title: "Doctor Triage", desc: "Clinician Gateway Sign-off" },
          ].map((st) => (
            <div
              key={st.step}
              className="p-3 rounded-md bg-[#F7F6F2] border border-[#E5E3DC] text-center space-y-1 hover:border-[#315C4C] transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-[#315C4C] text-white text-[10px] font-mono font-bold flex items-center justify-center mx-auto">
                {st.step}
              </div>
              <p className="text-xs font-medium text-[#202722] leading-tight">{st.title}</p>
              <p className="text-[10px] text-[#747D78] font-mono leading-tight">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Prescription Analyses Table */}
      <div className="rounded-lg bg-white border border-[#E5E3DC] overflow-hidden">
        <div className="p-5 border-b border-[#E5E3DC] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#202722] tracking-tight">Recent Prescription Analyses</h2>
            <p className="text-xs text-[#747D78]">Live database records of processed clinical documents</p>
          </div>
          <Link
            href="/history"
            className="text-xs font-medium text-[#315C4C] hover:underline flex items-center gap-1"
          >
            View all history <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#747D78] font-mono animate-pulse">
            Loading database records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-[#A33F38] bg-[#FAEEEE]">
            {error}
          </div>
        ) : !metrics?.recent_analyses || metrics.recent_analyses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E8EEE8] text-[#315C4C] flex items-center justify-center mx-auto">
              <FileText size={24} />
            </div>
            <h3 className="text-sm font-semibold text-[#202722]">No Prescriptions Analyzed Yet</h3>
            <p className="text-xs text-[#747D78] max-w-sm mx-auto">
              Upload a prescription image or PDF to start extracting medications and official FDA drug-food warnings.
            </p>
            <div className="pt-2">
              <Link
                href="/new-analysis"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c]"
              >
                <FilePlus size={14} /> Upload First Prescription
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F6F2] border-b border-[#E5E3DC] text-[#747D78] font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Analysis ID</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4">Medicines</th>
                  <th className="py-3 px-4">Pipeline Stage</th>
                  <th className="py-3 px-4">Doctor Review</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E3DC]">
                {metrics.recent_analyses.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F1EFEA]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-[#202722]">
                      {item.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 text-[#202722] font-medium flex items-center gap-2">
                      <FileText size={14} className="text-[#747D78]" />
                      <span className="truncate max-w-[160px]">{item.original_filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#747D78] font-mono">
                      {new Date(item.created_at).toLocaleDateString()}{" "}
                      <span className="text-[10px] text-[#747D78]/70">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded bg-[#E8EEE8] text-[#315C4C] font-semibold">
                        {item.medicine_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize font-mono text-[11px] text-[#202722]">
                        {item.stage.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          item.review_status === "approved"
                            ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/30"
                            : item.review_status === "rejected"
                            ? "bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/30"
                            : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
                        }`}
                      >
                        {item.review_status === "approved" && <CheckCircle2 size={10} />}
                        {item.review_status === "pending_review" && <Clock size={10} />}
                        {item.review_status === "rejected" && <AlertCircle size={10} />}
                        {item.review_status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#747D78]">
                      {item.total_processing_duration_sec}s
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/analysis/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#E5E3DC] text-xs font-medium text-[#202722] hover:bg-[#F1EFEA] hover:border-[#315C4C]"
                      >
                        Open Workspace <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
