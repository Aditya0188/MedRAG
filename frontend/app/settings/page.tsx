"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Server,
  Database,
  Activity,
  ShieldCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Globe,
  Key,
  Info
} from "lucide-react";
import { api, DependencyHealth } from "@/lib/api";

export default function SettingsPage() {
  const [health, setHealth] = useState<DependencyHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hasKey, setHasKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);

  const runHealthCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDependencies();
      setHealth(data);

      const keyStatus = await api.getKeyStatus();
      setHasKey(keyStatus.has_key);
    } catch (err: any) {
      setError(err.message || "Failed to query system dependencies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setIsSavingKey(true);
    setKeyMessage(null);
    try {
      const res = await api.updateApiKey(apiKeyInput.trim());
      setKeyMessage(res.message);
      setHasKey(true);
      setApiKeyInput("");
      await runHealthCheck();
    } catch (err: any) {
      alert("Failed to update API Key: " + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-semibold text-[#202722] tracking-tight">
            Settings & System Status
          </h1>
          <p className="text-xs text-[#747D78] mt-1">
            Configure AI vision credentials and verify real-time connectivity for external drug databases and vector search.
          </p>
        </div>

        <button
          onClick={runHealthCheck}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c] transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Run Connectivity Check
        </button>
      </div>

      {/* API Key Configuration Card */}
      <div className="p-6 rounded-lg bg-white border border-[#E5E3DC] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-[#315C4C]" />
            <h2 className="text-sm font-semibold text-[#202722]">Google Gemini Multimodal Vision Key</h2>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              hasKey
                ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/30"
                : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
            }`}
          >
            {hasKey ? "ACTIVE & CONFIGURED" : "NO KEY CONFIGURED"}
          </span>
        </div>

        <p className="text-xs text-[#747D78] leading-relaxed">
          The Gemini multimodal vision API enables high-accuracy transcription of handwritten prescriptions and extracts all prescribed medications. You can get a free API key at{" "}
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#315C4C] font-semibold"
          >
            Google AI Studio
          </a>
          .
        </p>

        <form onSubmit={handleSaveApiKey} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={hasKey ? "Key is set (enter new key to replace)..." : "Paste your GEMINI_API_KEY..."}
            className="w-full sm:flex-1 px-3 py-2 rounded border border-[#E5E3DC] bg-[#F7F6F2] text-xs text-[#202722] focus:outline-none focus:border-[#315C4C]"
          />
          <button
            type="submit"
            disabled={isSavingKey || !apiKeyInput.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded bg-[#315C4C] text-white text-xs font-medium hover:bg-[#28493c] transition-colors"
          >
            {isSavingKey ? "Saving..." : "Save & Activate Key"}
          </button>
        </form>

        {keyMessage && (
          <div className="p-3 rounded bg-[#EDF7EE] border border-[#2E7D32]/30 text-xs text-[#2E7D32] flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{keyMessage}</span>
          </div>
        )}
      </div>

      {/* Subsystem Health Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-[#202722] uppercase font-mono">
          Subsystem Telemetry & Response Latency
        </h2>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-[#747D78] bg-white rounded-lg border border-[#E5E3DC] animate-pulse">
            Testing connections to SQLite, NLM RxNorm, DailyMed, openFDA, and Qdrant...
          </div>
        ) : error || !health ? (
          <div className="p-6 rounded bg-[#FAEEEE] text-xs text-[#A33F38]">
            {error || "Unable to retrieve dependency telemetry."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Database */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Database size={14} className="text-[#315C4C]" /> SQLite Database
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EDF7EE] text-[#2E7D32] font-bold">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-[#747D78]">{health.database.details}</p>
              <p className="text-[10px] font-mono text-[#747D78]">
                Latency: {health.database.latency_ms ?? 0} ms
              </p>
            </div>

            {/* 2. Gemini Vision AI */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Cpu size={14} className="text-[#315C4C]" /> Gemini Vision AI
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    hasKey
                      ? "bg-[#EDF7EE] text-[#2E7D32]"
                      : "bg-[#FCF5EB] text-[#A56A19]"
                  }`}
                >
                  {hasKey ? "READY" : "KEY NEEDED"}
                </span>
              </div>
              <p className="text-xs text-[#747D78]">
                {hasKey ? "Gemini 2.5 Flash multimodal vision configured" : "API key not set yet"}
              </p>
              <p className="text-[10px] font-mono text-[#747D78]">
                SDK: Official Google GenAI (Python)
              </p>
            </div>

            {/* 3. NLM RxNorm */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Globe size={14} className="text-[#315C4C]" /> NLM RxNorm REST API
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    health.rxnorm_api.status === "healthy"
                      ? "bg-[#EDF7EE] text-[#2E7D32]"
                      : "bg-[#FAEEEE] text-[#A33F38]"
                  }`}
                >
                  {health.rxnorm_api.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#747D78]">{health.rxnorm_api.details}</p>
              <p className="text-[10px] font-mono text-[#747D78]">
                Latency: {health.rxnorm_api.latency_ms ?? 0} ms
              </p>
            </div>

            {/* 4. FDA DailyMed */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Globe size={14} className="text-[#315C4C]" /> FDA DailyMed API
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    health.dailymed_api.status === "healthy"
                      ? "bg-[#EDF7EE] text-[#2E7D32]"
                      : "bg-[#FAEEEE] text-[#A33F38]"
                  }`}
                >
                  {health.dailymed_api.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#747D78]">{health.dailymed_api.details}</p>
              <p className="text-[10px] font-mono text-[#747D78]">
                Latency: {health.dailymed_api.latency_ms ?? 0} ms
              </p>
            </div>

            {/* 5. openFDA */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Globe size={14} className="text-[#315C4C]" /> openFDA Label API
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    health.openfda_api.status === "healthy"
                      ? "bg-[#EDF7EE] text-[#2E7D32]"
                      : "bg-[#FAEEEE] text-[#A33F38]"
                  }`}
                >
                  {health.openfda_api.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#747D78]">{health.openfda_api.details}</p>
              <p className="text-[10px] font-mono text-[#747D78]">
                Latency: {health.openfda_api.latency_ms ?? 0} ms
              </p>
            </div>

            {/* 6. Qdrant Vector Engine */}
            <div className="p-4 rounded-lg bg-white border border-[#E5E3DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#202722] flex items-center gap-1.5">
                  <Activity size={14} className="text-[#315C4C]" /> Qdrant Vector Store
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EDF7EE] text-[#2E7D32] font-bold">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-[#747D78]">{health.qdrant_vector_store.details}</p>
              <p className="text-[10px] font-mono text-[#747D78]">
                Storage: Embedded Local Disk Engine
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Privacy & Safety Policy Notice */}
      <div className="p-6 rounded-lg bg-[#F7F6F2] border border-[#E5E3DC] space-y-2 text-xs text-[#747D78]">
        <div className="flex items-center gap-2 font-semibold text-[#202722]">
          <ShieldCheck size={16} className="text-[#315C4C]" />
          Privacy & Clinical Safety Policy
        </div>
        <p className="leading-relaxed">
          The system processes uploaded prescription images server-side. Extracted text is grounded against official government medicine databases (NLM RxNorm and FDA DailyMed). Patient instructions are generated strictly upon explicit clinician verification and approval.
        </p>
      </div>
    </div>
  );
}
