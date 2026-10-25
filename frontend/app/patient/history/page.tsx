"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, Upload, Search } from "lucide-react";
import { api, AnalysisListItem } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

export default function PatientHistoryPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getAnalyses()
      .then((data) => setAnalyses(data))
      .catch(() => setAnalyses([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredAnalyses = analyses.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.original_filename.toLowerCase().includes(q) ||
      (item.patient_name && item.patient_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
            My Prescriptions
          </h1>
          <p className="text-xs text-[#747D78] mt-0.5">
            View verification status and approved medication schedules.
          </p>
        </div>

        <Link
          href="/patient"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md transition-colors shadow-xs shrink-0"
        >
          <Upload size={14} />
          <span>Upload New Prescription</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by filename..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
        />
      </div>

      {/* Prescriptions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#E5E3DC] rounded-lg p-4 space-y-2 animate-pulse">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Prescriptions Found"
          description={search ? "No records match your search criteria." : "You have not uploaded any prescriptions yet."}
          actionHref="/patient"
          actionLabel="Upload First Prescription"
        />
      ) : (
        <div className="bg-white border border-[#E5E3DC] rounded-lg divide-y divide-[#E5E3DC] overflow-hidden">
          {filteredAnalyses.map((item, idx) => {
            const isApproved = item.review_status === "approved";
            const isRejected = item.review_status === "rejected";
            const isPending = !isApproved && !isRejected;

            const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                onMouseEnter={() => {
                  router.prefetch(`/patient/summary/${item.id}`);
                }}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F6F2] transition-colors"
                style={{
                  animationDelay: `${Math.min(idx, 8) * 30}ms`,
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-[#F1EFEA] border border-[#E5E3DC] flex items-center justify-center text-[#315C4C] shrink-0 mt-0.5">
                    <FileText size={16} />
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[#202722] truncate">
                      {item.original_filename}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#747D78] font-mono mt-0.5">
                      <span>{formattedDate}</span>
                      <span>•</span>
                      <span className="tabular-nums">
                        {item.medicine_count} {item.medicine_count === 1 ? "medication" : "medications"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Link */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {isApproved && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20">
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      <span>Approved</span>
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20">
                      <Clock size={13} className="animate-pulse" />
                      <span>Under Review</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[#FAEEEE] text-[#A33F38] border border-[#A33F38]/20">
                      <AlertTriangle size={13} />
                      <span>Requires Re-Upload</span>
                    </span>
                  )}

                  <Link
                    href={`/patient/summary/${item.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#E5E3DC] hover:border-[#315C4C] text-xs font-medium text-[#202722] hover:text-[#315C4C] bg-white transition-colors cursor-pointer"
                  >
                    <span>{isApproved ? "View Guide" : isRejected ? "View Notice" : "Status"}</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
