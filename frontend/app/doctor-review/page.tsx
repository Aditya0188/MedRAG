"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCheck,
  Clock,
  ArrowRight,
  AlertCircle,
  FileText,
  ShieldAlert,
  RefreshCw
} from "lucide-react";
import { api, AnalysisListItem } from "@/lib/api";

export default function DoctorReviewGatewayPage() {
  const [pendingItems, setPendingItems] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnalyses({
        review_status: "pending_review",
        limit: 50,
      });
      setPendingItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load pending reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FCF5EB] text-[#A56A19] text-xs font-mono font-medium mb-2 border border-[#A56A19]/20">
            <UserCheck size={14} /> Clinician Triage Gateway
          </div>
          <h1 className="text-2xl font-semibold text-[#202722] tracking-tight">
            Pending Doctor Reviews
          </h1>
          <p className="text-xs text-[#747D78] mt-1">
            Prescriptions processed by AI requiring human verification, terminology check, and clinical approval.
          </p>
        </div>

        <button
          onClick={loadPending}
          className="p-2 rounded-md border border-[#E5E3DC] bg-white text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] flex items-center gap-1.5 text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh List
        </button>
      </div>

      {/* Target Notice */}
      <div className="p-4 rounded-lg bg-[#E8EEE8]/40 border border-[#315C4C]/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[#315C4C]" />
          <div>
            <span className="font-semibold text-[#202722]">Research Objective 3: </span>
            <span className="text-[#747D78]">
              Allows the attending clinician to inspect the original prescription image beside AI-extracted line items and give final approval within a 60-second target.
            </span>
          </div>
        </div>
      </div>

      {/* Pending Items List */}
      <div className="rounded-lg bg-white border border-[#E5E3DC] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
            Checking clinical queue for pending reviews...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-[#A33F38] bg-[#FAEEEE]">
            {error}
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EDF7EE] text-[#2E7D32] flex items-center justify-center mx-auto">
              <UserCheck size={24} />
            </div>
            <h3 className="text-sm font-semibold text-[#202722]">All Prescriptions Reviewed</h3>
            <p className="text-xs text-[#747D78] max-w-sm mx-auto">
              There are currently no prescriptions waiting in the doctor review triage queue.
            </p>
            <div className="pt-2">
              <Link
                href="/new-analysis"
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-medium"
              >
                Analyze a New Prescription
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E3DC]">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F7F6F2]/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#202722]">{item.original_filename}</span>
                    {item.is_demo && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20 font-bold">
                        DEMO
                      </span>
                    )}
                    <span className="text-xs font-mono text-[#747D78]">
                      (ID: {item.id.slice(0, 8)}...)
                    </span>
                  </div>

                  <p className="text-xs text-[#747D78] font-mono">
                    Uploaded: {new Date(item.created_at).toLocaleString()} • {item.medicine_count} extracted medicines • {item.total_processing_duration_sec}s pipeline duration
                  </p>
                </div>

                <Link
                  href={`/analysis/${item.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c] transition-colors shrink-0"
                >
                  <UserCheck size={14} /> Open Doctor Review Workspace <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
