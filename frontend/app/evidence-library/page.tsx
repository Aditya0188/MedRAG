"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  ExternalLink,
  ShieldAlert,
  Filter,
  RefreshCw,
  FileText
} from "lucide-react";
import { api, Evidence } from "@/lib/api";

export default function EvidenceLibraryPage() {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const loadEvidence = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.searchEvidenceLibrary(
        search.trim() || undefined,
        selectedCategory === "all" ? undefined : selectedCategory
      );
      setEvidences(data);
    } catch (err: any) {
      setError(err.message || "Failed to load evidence library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvidence();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-semibold text-[#202722] tracking-tight">
            Official Drug Evidence Library
          </h1>
          <p className="text-xs text-[#747D78] mt-1">
            Ground-truth drug labeling repository retrieved from official NLM DailyMed SPL and openFDA endpoints, indexed in Qdrant.
          </p>
        </div>

        <button
          onClick={loadEvidence}
          className="p-2 rounded-md border border-[#E5E3DC] bg-white text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] flex items-center gap-1.5 text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Library
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747D78]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by drug name (e.g. Amoxicillin, Metformin) or food (milk, grapefruit)..."
            className="w-full pl-9 pr-4 py-2 rounded-md border border-[#E5E3DC] text-xs bg-[#F7F6F2] text-[#202722] focus:outline-none focus:border-[#315C4C]"
          />
        </form>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#747D78] font-mono text-[11px]">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-[#E5E3DC] bg-white text-[#202722] text-xs"
          >
            <option value="all">All Evidence Categories</option>
            <option value="avoid_contraindicated">Avoid / Contraindicated</option>
            <option value="limit_caution">Limit / Caution</option>
            <option value="timing_instruction">Timing / Food Instructions</option>
            <option value="no_relevant_warning">No Relevant Warning</option>
          </select>
        </div>
      </div>

      {/* Evidence Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm font-mono text-[#747D78] animate-pulse">
          Searching official FDA drug labeling passages in Qdrant...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-[#A33F38] bg-[#FAEEEE]">
          {error}
        </div>
      ) : evidences.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E5E3DC] rounded-lg space-y-2">
          <BookOpen size={28} className="mx-auto text-[#747D78]" />
          <h3 className="text-sm font-semibold text-[#202722]">No Matching Evidence Passages</h3>
          <p className="text-xs text-[#747D78]">
            Process a prescription in New Analysis to automatically fetch and index new drug labeling documents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidences.map((ev) => {
            const badge = {
              avoid_contraindicated: { bg: "bg-[#FAEEEE]", text: "text-[#A33F38]", label: "AVOID" },
              limit_caution: { bg: "bg-[#FCF5EB]", text: "text-[#A56A19]", label: "LIMIT / CAUTION" },
              timing_instruction: { bg: "bg-[#E8EEE8]", text: "text-[#315C4C]", label: "TIMING" },
              no_relevant_warning: { bg: "bg-[#EDF7EE]", text: "text-[#2E7D32]", label: "NO WARNING" },
              unavailable_insufficient: { bg: "bg-[#F1EFEA]", text: "text-[#747D78]", label: "UNAVAILABLE" },
            }[ev.evidence_category] || { bg: "bg-[#F1EFEA]", text: "text-[#747D78]", label: ev.evidence_category };

            return (
              <div
                key={ev.id}
                className="p-5 rounded-lg bg-white border border-[#E5E3DC] space-y-3 hover:border-[#315C4C] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#202722]">{ev.medicine_name}</h3>
                    <p className="text-xs text-[#747D78] mt-0.5">
                      Substance: <span className="font-medium text-[#202722]">{ev.food_or_substance}</span>
                    </p>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="p-3 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs text-[#202722] leading-snug">
                  {ev.plain_language_summary}
                </div>

                <div className="text-[11px] text-[#747D78] italic pl-2 border-l-2 border-[#315C4C]">
                  &quot;{ev.evidence_excerpt}&quot;
                </div>

                <div className="pt-2 text-[10px] text-[#747D78] font-mono border-t border-[#F1EFEA] flex items-center justify-between">
                  <span className="truncate max-w-[240px]">
                    {ev.source_provider} • {ev.source_document_title}
                  </span>
                  <a
                    href={ev.official_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#315C4C] hover:underline flex items-center gap-1 font-bold shrink-0"
                  >
                    Official Document <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
