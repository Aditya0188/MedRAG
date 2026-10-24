"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  ExternalLink,
  ShieldAlert,
  Filter,
  RefreshCw,
  FileText,
  CheckCircle2,
  Database
} from "lucide-react";
import { api, Evidence } from "@/lib/api";

const QUICK_SEARCH_CHIPS = [
  "All",
  "Amoxicillin",
  "Augmentin",
  "Ciprofloxacin",
  "Azithromycin",
  "Ibuprofen",
  "Paracetamol",
  "Atorvastatin",
  "Metformin",
  "Pantoprazole",
  "Levothyroxine",
  "Warfarin",
  "Grapefruit",
  "Milk / Dairy",
  "Alcohol"
];

export default function EvidenceLibraryPage() {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeChip, setActiveChip] = useState("All");

  const loadEvidence = async (overrideQuery?: string) => {
    try {
      setLoading(true);
      setError(null);
      const queryToUse = overrideQuery !== undefined ? overrideQuery : search;
      const data = await api.searchEvidenceLibrary(
        queryToUse.trim() || undefined,
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
    setActiveChip("Custom");
    loadEvidence();
  };

  const handleChipClick = (chip: string) => {
    setActiveChip(chip);
    const query = chip === "All" ? "" : chip;
    setSearch(query);
    loadEvidence(query);
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-semibold text-[#202722] tracking-tight flex items-center gap-2">
            Official Drug Evidence Library
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20">
              {evidences.length} Passages Indexed
            </span>
          </h1>
          <p className="text-xs text-[#747D78] mt-1">
            Ground-truth drug labeling repository retrieved from official NLM DailyMed SPL and openFDA endpoints, indexed in Qdrant.
          </p>
        </div>

        <button
          onClick={() => loadEvidence()}
          className="p-2 rounded-md border border-[#E5E3DC] bg-white text-[#747D78] hover:text-[#202722] hover:bg-[#F1EFEA] flex items-center gap-1.5 text-xs font-medium self-start md:self-auto transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Library
        </button>
      </div>

      {/* Quick Search Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-[11px] font-mono text-[#747D78] uppercase mr-1 flex items-center gap-1">
          <Database size={12} /> Filter:
        </span>
        {QUICK_SEARCH_CHIPS.map((chip) => {
          const isActive = activeChip === chip;
          return (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-[#315C4C] text-white font-medium shadow-xs"
                  : "bg-white border border-[#E5E3DC] text-[#747D78] hover:text-[#202722] hover:border-[#315C4C]/40"
              }`}
            >
              {chip}
            </button>
          );
        })}
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
            className="px-2.5 py-1.5 rounded border border-[#E5E3DC] bg-white text-[#202722] text-xs focus:outline-none focus:border-[#315C4C]"
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
        <div className="p-8 text-center text-xs text-[#A33F38] bg-[#FAEEEE] rounded-lg border border-[#A33F38]/20">
          {error}
        </div>
      ) : evidences.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E5E3DC] rounded-lg space-y-2">
          <BookOpen size={28} className="mx-auto text-[#747D78]" />
          <h3 className="text-sm font-semibold text-[#202722]">No Matching Evidence Passages</h3>
          <p className="text-xs text-[#747D78]">
            No records matched &quot;{search}&quot;. Try selecting &quot;All&quot; or searching by active generic name.
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
                className="p-5 rounded-lg bg-white border border-[#E5E3DC] space-y-3 hover:border-[#315C4C] transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#202722]">{ev.medicine_name}</h3>
                      <p className="text-xs text-[#747D78] mt-0.5">
                        Substance / Factor: <span className="font-medium text-[#202722]">{ev.food_or_substance}</span>
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
                </div>

                <div className="pt-3 text-[10px] text-[#747D78] font-mono border-t border-[#F1EFEA] flex items-center justify-between mt-2">
                  <span className="truncate max-w-[260px]">
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
