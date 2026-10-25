"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  AlertCircle
} from "lucide-react";
import { api, DashboardMetrics, AnalysisListItem } from "@/lib/api";
import { MetricTilesSkeleton, TableRowSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

export default function DoctorDashboardPage() {
  const router = useRouter();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"pending" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, aRes] = await Promise.all([
          api.getMetrics(),
          api.getAnalyses({ limit: 100 }),
        ]);
        setMetrics(mRes);
        setAnalyses(aRes);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter queue: pending triage sorted oldest first
  const reviewQueue = analyses
    .filter((a) => {
      if (filterMode === "pending") {
        return a.review_status === "pending_review" || a.review_status === "unreviewed";
      }
      return true;
    })
    .filter((a) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.original_filename.toLowerCase().includes(q) ||
        (a.patient_name && a.patient_name.toLowerCase().includes(q))
      );
    })
    // Sort oldest first for triage FIFO
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Generate 7-day volume chart data
  const chartDays = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const count = analyses.filter((a) => a.created_at.startsWith(dateStr)).length;
    return { dateStr, dayLabel, count };
  });

  const maxChartCount = Math.max(...chartDays.map((d) => d.count), 5);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
            Clinician Verification Gateway
          </h1>
          <p className="text-xs text-[#747D78] mt-0.5">
            Outpatient prescription triage queue and verified evidence sign-off
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/doctor/patients"
            className="px-3 py-1.5 bg-white border border-[#E5E3DC] hover:border-[#315C4C] rounded-md text-xs font-medium text-[#202722] hover:text-[#315C4C] transition-colors"
          >
            Patient Directory
          </Link>
          <Link
            href="/doctor/settings"
            className="px-3 py-1.5 bg-white border border-[#E5E3DC] hover:border-[#315C4C] rounded-md text-xs font-medium text-[#202722] hover:text-[#315C4C] transition-colors"
          >
            AI Settings
          </Link>
        </div>
      </div>

      {/* 4 Compact Metric Tiles */}
      {loading ? (
        <MetricTilesSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tile 1: Pending Review */}
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-4">
            <div className="flex items-center justify-between text-[#747D78] text-xs">
              <span className="font-medium">Pending Triage</span>
              <Clock size={15} className="text-[#A56A19]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-[#202722] tabular-nums">
              {metrics?.pending_doctor_reviews ?? 0}
            </div>
            <p className="text-[11px] text-[#A56A19] font-medium mt-1">
              Awaiting clinical sign-off
            </p>
          </div>

          {/* Tile 2: Approved Reports */}
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-4">
            <div className="flex items-center justify-between text-[#747D78] text-xs">
              <span className="font-medium">Approved Today</span>
              <CheckCircle2 size={15} className="text-[#2E7D32]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-[#202722] tabular-nums">
              {metrics?.approved_reports ?? 0}
            </div>
            <p className="text-[11px] text-[#2E7D32] font-medium mt-1">
              Guides released to patients
            </p>
          </div>

          {/* Tile 3: Rejected Prescriptions */}
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-4">
            <div className="flex items-center justify-between text-[#747D78] text-xs">
              <span className="font-medium">Clarifications</span>
              <AlertTriangle size={15} className="text-[#A33F38]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-[#202722] tabular-nums">
              {metrics?.rejected_reports ?? 0}
            </div>
            <p className="text-[11px] text-[#A33F38] font-medium mt-1">
              Re-upload requested
            </p>
          </div>

          {/* Tile 4: Average Review Duration */}
          <div className="bg-white border border-[#E5E3DC] rounded-lg p-4">
            <div className="flex items-center justify-between text-[#747D78] text-xs">
              <span className="font-medium">Avg Review Time</span>
              <TrendingUp size={15} className="text-[#315C4C]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-[#202722] tabular-nums">
              {(metrics?.average_review_time_sec ?? 45).toFixed(0)}s
            </div>
            <p className="text-[11px] text-[#747D78] font-mono mt-1">
              Target: &lt; 60 seconds
            </p>
          </div>
        </div>
      )}

      {/* Clean 7-Day Ingestion Volume Chart (Plain SVG, no decorative fluff) */}
      <div className="bg-white border border-[#E5E3DC] rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
          <div>
            <h2 className="text-xs font-semibold text-[#202722] uppercase tracking-wider font-mono">
              Prescription Ingestion & Verification Volume
            </h2>
            <p className="text-[11px] text-[#747D78] mt-0.5">
              Daily outpatient prescription uploads across past 7 days
            </p>
          </div>
          <div className="font-mono text-xs text-[#747D78] tabular-nums">
            7-Day Total: {chartDays.reduce((acc, c) => acc + c.count, 0)}
          </div>
        </div>

        {/* Minimal SVG Bar / Line Graph */}
        <div className="mt-4 pt-2">
          <svg
            viewBox="0 0 700 120"
            className="w-full h-24 overflow-visible"
            aria-label="Daily analyses volume chart"
          >
            {/* Grid Lines */}
            <line x1="0" y1="20" x2="700" y2="20" stroke="#E5E3DC" strokeDasharray="3 3" />
            <line x1="0" y1="60" x2="700" y2="60" stroke="#E5E3DC" strokeDasharray="3 3" />
            <line x1="0" y1="100" x2="700" y2="100" stroke="#E5E3DC" />

            {/* Bars for Each Day */}
            {chartDays.map((day, i) => {
              const barWidth = 44;
              const x = 50 + i * 95;
              const barHeight = Math.max(12, (day.count / maxChartCount) * 80);
              const y = 100 - barHeight;

              return (
                <g key={day.dateStr} className="group cursor-pointer">
                  {/* Bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    fill="#315C4C"
                    className="opacity-90 hover:opacity-100 transition-opacity"
                  />
                  {/* Value on top of bar */}
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fill="#202722"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {day.count}
                  </text>
                  {/* Day Label below bar */}
                  <text
                    x={x + barWidth / 2}
                    y="118"
                    textAnchor="middle"
                    fill="#747D78"
                    fontSize="10"
                    fontFamily="sans-serif"
                  >
                    {day.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Review Queue Workspace */}
      <div className="bg-white border border-[#E5E3DC] rounded-lg overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-[#E5E3DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode("pending")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filterMode === "pending"
                  ? "bg-[#315C4C] text-white shadow-xs"
                  : "bg-[#F1EFEA] text-[#747D78] hover:text-[#202722]"
              }`}
            >
              Pending Triage Queue ({analyses.filter((a) => a.review_status === "pending_review" || a.review_status === "unreviewed").length})
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filterMode === "all"
                  ? "bg-[#315C4C] text-white shadow-xs"
                  : "bg-[#F1EFEA] text-[#747D78] hover:text-[#202722]"
              }`}
            >
              All Prescriptions ({analyses.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-2.5 text-[#747D78]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or filename..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#315C4C] transition-all"
            />
          </div>
        </div>

        {/* Queue Table */}
        {loading ? (
          <div className="divide-y divide-[#E5E3DC]">
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        ) : reviewQueue.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={filterMode === "pending" ? "Queue Clear — No Pending Prescriptions" : "No Prescriptions Found"}
            description={
              filterMode === "pending"
                ? "All uploaded prescriptions have been reviewed and approved by attending clinicians."
                : "No records matched your search query."
            }
          />
        ) : (
          <div className="divide-y divide-[#E5E3DC] overflow-x-auto">
            {reviewQueue.map((item, idx) => {
              const isApproved = item.review_status === "approved";
              const isRejected = item.review_status === "rejected";
              const isPending = !isApproved && !isRejected;

              const formattedTime = new Date(item.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              // Check if low confidence scenario or flags
              const isLowConfidence = item.original_filename.includes("ambiguous") || item.medicine_count > 3;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => {
                    router.prefetch(`/doctor/review/${item.id}`);
                  }}
                  className={`p-4 flex items-center justify-between gap-4 hover:bg-[#F7F6F2] transition-colors ${
                    isPending ? "bg-white" : "bg-[#F7F6F2]/40"
                  }`}
                  style={{
                    animationDelay: `${Math.min(idx, 8) * 30}ms`,
                  }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-[#E8EEE8] border border-[#315C4C]/20 flex items-center justify-center text-[#315C4C] shrink-0 font-mono text-xs font-bold">
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#202722] truncate">
                          {item.patient_name || "Patient Record"}
                        </span>
                        {isLowConfidence && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30">
                            <AlertCircle size={10} />
                            <span>Low Confidence</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#747D78] font-mono mt-0.5">
                        <span className="truncate">{item.original_filename}</span>
                        <span>•</span>
                        <span className="tabular-nums">
                          {item.medicine_count} {item.medicine_count === 1 ? "medication" : "medications"}
                        </span>
                        <span>•</span>
                        <span>{formattedDate} at {formattedTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      <span>{isPending ? "Start Review" : "Inspect Review"}</span>
                      <ArrowRight size={13} />
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
