"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCw,
  RefreshCw
} from "lucide-react";
import { api, AnalysisListItem } from "@/lib/api";

export default function HistoryPage() {
  const [items, setItems] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnalyses({
        status: statusFilter === "all" ? undefined : statusFilter,
        review_status: reviewFilter === "all" ? undefined : reviewFilter,
        search: search.trim() ? search.trim() : undefined,
        limit: 50,
      });
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load prescription history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, reviewFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-semibold text-[#202722] tracking-tight">
            Prescription Analysis History
          </h1>
          <p className="text-xs text-[#747D78] mt-1">
            Persisted clinical records with extracted medicines, terminology grounding, and clinician triage status.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-md border border-[#E5E3DC] bg-white text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] flex items-center gap-1.5 text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747D78]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename, patient or doctor name..."
            className="w-full pl-9 pr-4 py-2 rounded-md border border-[#E5E3DC] text-xs bg-[#F7F6F2] text-[#202722] focus:outline-none focus:border-[#315C4C]"
          />
        </form>

        {/* Filters */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#747D78] font-mono text-[11px]">Doctor Review:</span>
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#E5E3DC] bg-white text-[#202722] text-xs"
            >
              <option value="all">All Reviews</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#747D78] font-mono text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#E5E3DC] bg-white text-[#202722] text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-lg bg-white border border-[#E5E3DC] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
            Loading historical records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-[#A33F38] bg-[#FAEEEE]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E8EEE8] text-[#315C4C] flex items-center justify-center mx-auto">
              <FileText size={24} />
            </div>
            <p className="text-sm font-semibold text-[#202722]">No Prescriptions Match the Filter</p>
            <p className="text-xs text-[#747D78]">
              Try adjusting your search criteria or create a new analysis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F6F2] border-b border-[#E5E3DC] text-[#747D78] font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Analysis ID</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4">Medicines</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E3DC]">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F1EFEA]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-[#202722]">
                      {item.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#202722] flex items-center gap-2">
                      <FileText size={14} className="text-[#747D78]" />
                      <span className="truncate max-w-[180px]">{item.original_filename}</span>
                      {item.is_demo && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20">
                          DEMO
                        </span>
                      )}
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
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
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
                        className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white border border-[#E5E3DC] text-xs font-medium text-[#202722] hover:bg-[#F1EFEA] hover:border-[#315C4C]"
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
