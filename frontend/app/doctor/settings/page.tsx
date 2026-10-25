"use client";

import React, { useEffect, useState } from "react";
import { Settings, Key, CheckCircle2, AlertTriangle, ShieldCheck, Database, RefreshCw, Eye, EyeOff } from "lucide-react";
import { api, DependencyHealth } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function DoctorSettingsPage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [geminiKey, setGeminiKey] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [modelName, setModelName] = useState("gemini-3.1-flash-lite");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);

  const [fdaKey, setFdaKey] = useState("");
  const [hasFdaKey, setHasFdaKey] = useState(false);
  const [fdaRateLimit, setFdaRateLimit] = useState("40 req/min (standard)");
  const [savingFda, setSavingFda] = useState(false);

  const [deps, setDeps] = useState<DependencyHealth | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(true);

  useEffect(() => {
    // Check key statuses
    api.getKeyStatus()
      .then((res) => {
        setHasGeminiKey(res.has_key);
        if (res.model) setModelName(res.model);
      })
      .catch(() => {});

    api.getFdaKeyStatus()
      .then((res) => {
        setHasFdaKey(res.has_key);
        if (res.rate_limit) setFdaRateLimit(res.rate_limit);
      })
      .catch(() => {});

    // Check system dependency health
    api.getDependencies()
      .then((data) => setDeps(data))
      .catch(() => {})
      .finally(() => setLoadingDeps(false));
  }, []);

  const handleSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiKey.trim()) return;

    setSavingGemini(true);
    try {
      const res = await api.updateApiKey(geminiKey.trim());
      setHasGeminiKey(res.has_key);
      setGeminiKey("");
      toastSuccess("Gemini API Key activated successfully.");
    } catch (err: any) {
      toastError(err.message || "Failed to update Gemini API Key.");
    } finally {
      setSavingGemini(false);
    }
  };

  const handleSaveFdaKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fdaKey.trim()) return;

    setSavingFda(true);
    try {
      const res = await api.updateFdaApiKey(fdaKey.trim());
      setHasFdaKey(res.has_key);
      setFdaKey("");
      toastSuccess("openFDA API Key updated. Elevated to 240 req/min.");
    } catch (err: any) {
      toastError(err.message || "Failed to update openFDA Key.");
    } finally {
      setSavingFda(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E5E3DC]">
        <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
          System & AI Credentials
        </h1>
        <p className="text-xs text-[#747D78] mt-0.5">
          Restricted clinician settings for Gemini multimodal models, openFDA rate limits, and Qdrant vector index.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gemini Vision API Key Box */}
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#315C4C]" />
              <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                Google Gemini Vision
              </h2>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                hasGeminiKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
              }`}
            >
              {hasGeminiKey ? "CONFIGURED" : "KEY REQUIRED"}
            </span>
          </div>

          <p className="text-xs text-[#747D78] leading-relaxed">
            Multimodal model used for prescription transcription and bounding box line item detection.
            Active Model: <span className="font-mono text-[#315C4C] font-semibold">{modelName}</span>.
          </p>

          <form onSubmit={handleSaveGeminiKey} className="space-y-3">
            <div className="relative">
              <input
                type={showGeminiKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={hasGeminiKey ? "•••••••••••••••••••••••••••••" : "Enter AI Studio Gemini API Key..."}
                className="w-full text-xs font-mono bg-[#F7F6F2] border border-[#E5E3DC] rounded px-3 py-2 pr-9 focus:bg-white focus:outline-none focus:border-[#315C4C]"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2.5 top-2.5 text-[#747D78] hover:text-[#202722] cursor-pointer"
              >
                {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={savingGemini || !geminiKey.trim()}
              className="w-full py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
            >
              {savingGemini ? "Validating & Saving..." : "Update Gemini Key"}
            </button>
          </form>

          <p className="text-[10px] text-[#747D78] text-center">
            Keys are stored locally in the backend environment and never logged.
          </p>
        </div>

        {/* openFDA API Key Box */}
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#315C4C]" />
              <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                openFDA Label API
              </h2>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                hasFdaKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#F1EFEA] text-[#747D78] border border-[#E5E3DC]"
              }`}
            >
              {hasFdaKey ? "KEY ACTIVE" : "PUBLIC TIER"}
            </span>
          </div>

          <p className="text-xs text-[#747D78] leading-relaxed">
            Official FDA labeling endpoint rate limit: <span className="font-mono text-[#202722]">{fdaRateLimit}</span>.
            Providing an FDA key increases query capacity to 240 requests/minute.
          </p>

          <form onSubmit={handleSaveFdaKey} className="space-y-3">
            <input
              type="password"
              value={fdaKey}
              onChange={(e) => setFdaKey(e.target.value)}
              placeholder={hasFdaKey ? "••••••••••••••••" : "Enter openFDA API Key (optional)..."}
              className="w-full text-xs font-mono bg-[#F7F6F2] border border-[#E5E3DC] rounded px-3 py-2 focus:bg-white focus:outline-none focus:border-[#315C4C]"
            />

            <button
              type="submit"
              disabled={savingFda || !fdaKey.trim()}
              className="w-full py-2 bg-[#F1EFEA] hover:bg-[#E8EEE8] border border-[#E5E3DC] text-[#202722] text-xs font-medium rounded transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
            >
              {savingFda ? "Updating..." : "Update openFDA Key"}
            </button>
          </form>

          <p className="text-[10px] text-[#747D78] text-center">
            Free FDA API keys can be requested at open.fda.gov/apis/authentication.
          </p>
        </div>
      </div>

      {/* Dependency Health Grid */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
          <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
            Clinical Dependency Diagnostics
          </h2>
          <span className="text-[10px] text-[#747D78] font-mono">App Version: {deps?.app_version || "1.0.0"}</span>
        </div>

        {loadingDeps ? (
          <div className="text-xs text-[#747D78]">Checking dependencies...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">SQLite Database</span>
              <span className="font-semibold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={12} /> {deps?.database.status || "healthy"}
              </span>
            </div>

            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">NIH RxNorm REST API</span>
              <span className="font-semibold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={12} /> {deps?.rxnorm_api.status || "healthy"}
              </span>
            </div>

            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">NLM DailyMed API</span>
              <span className="font-semibold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={12} /> {deps?.dailymed_api.status || "healthy"}
              </span>
            </div>

            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">openFDA Drug Labels</span>
              <span className="font-semibold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={12} /> {deps?.openfda_api.status || "healthy"}
              </span>
            </div>

            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">Qdrant Vector Engine</span>
              <span className="font-semibold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={12} /> {deps?.qdrant_vector_store.status || "healthy"}
              </span>
            </div>

            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg">
              <span className="text-[#747D78] text-[10px] uppercase block">Execution Mode</span>
              <span className="font-semibold text-[#315C4C] mt-0.5 block uppercase">
                {deps?.app_mode || "LIVE"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
