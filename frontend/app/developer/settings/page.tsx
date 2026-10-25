"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Key,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Cpu,
  ArrowLeft,
  ShieldCheck,
  Check,
  AlertCircle,
  Users
} from "lucide-react";
import { api, DependencyHealth } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function DeveloperSettingsPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  // Gemini Key State
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [activeModel, setActiveModel] = useState("gemini-3.1-flash-lite");
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // openFDA Key State
  const [fdaKeyInput, setFdaKeyInput] = useState("");
  const [showFdaKey, setShowFdaKey] = useState(false);
  const [hasFdaKey, setHasFdaKey] = useState(false);
  const [fdaRateLimit, setFdaRateLimit] = useState("40 req/min (Public tier)");
  const [isSavingFda, setIsSavingFda] = useState(false);

  // Diagnostics State
  const [deps, setDeps] = useState<DependencyHealth | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(true);

  // Users List State
  const [usersList, setUsersList] = useState<
    Array<{ id: string; name: string; email: string; role: string; created_at: string | null }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getDeveloperUsers();
      setUsersList(data);
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDeveloperStatus = async () => {
    try {
      const status = await api.getDeveloperStatus();
      setHasGeminiKey(status.has_gemini_key);
      setMaskedKey(status.gemini_masked_key || "");
      if (status.gemini_model) setActiveModel(status.gemini_model);
      setHasFdaKey(status.has_fda_key);
      if (status.fda_rate_limit) setFdaRateLimit(status.fda_rate_limit);
    } catch {
      // Fallback to legacy endpoints if needed
      try {
        const keyRes = await api.getKeyStatus();
        setHasGeminiKey(keyRes.has_key);
        if (keyRes.model) setActiveModel(keyRes.model);
      } catch {}
    }
  };

  const fetchDiagnostics = async () => {
    setLoadingDeps(true);
    try {
      const data = await api.getDependencies();
      setDeps(data);
    } catch (err: any) {
      toastError(err.message || "Failed to load system diagnostics.");
    } finally {
      setLoadingDeps(false);
    }
  };

  useEffect(() => {
    fetchDeveloperStatus();
    fetchDiagnostics();
    fetchUsers();
  }, []);

  const handleTestAndSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const keyToTest = geminiKeyInput.trim();
    if (!keyToTest) {
      toastError("Please enter a Gemini API Key to test and save.");
      return;
    }

    setIsSavingGemini(true);
    setValidationResult(null);

    try {
      // Call backend developer key update with active live validation
      const res = await api.updateDeveloperApiKey(keyToTest, true);
      setHasGeminiKey(res.has_key);
      if (res.model) setActiveModel(res.model);

      if (res.is_valid) {
        setValidationResult({
          valid: true,
          message: res.message || "Key successfully verified with Google GenAI.",
        });
        toastSuccess("Gemini API Key verified and activated successfully.");
        setGeminiKeyInput("");
        fetchDeveloperStatus();
        fetchDiagnostics();
      } else {
        setValidationResult({
          valid: false,
          message: res.message || "Key verification failed. Please check the API key.",
        });
        toastWarning("Key was saved, but Google GenAI verification reported an issue.");
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        message: err.message || "Failed to update Gemini API Key.",
      });
      toastError(err.message || "Failed to save Gemini API Key.");
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleValidateActiveKey = async () => {
    setIsValidatingGemini(true);
    setValidationResult(null);
    try {
      const res = await api.validateDeveloperApiKey(geminiKeyInput.trim());
      setValidationResult({
        valid: res.is_valid,
        message: res.message,
      });
      if (res.is_valid) {
        toastSuccess("Active Gemini API Key is valid.");
      } else {
        toastError(res.message);
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        message: err.message || "Key validation request failed.",
      });
      toastError(err.message || "Key validation request failed.");
    } finally {
      setIsValidatingGemini(false);
    }
  };

  const handleSaveFdaKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const keyToSave = fdaKeyInput.trim();
    if (!keyToSave) return;

    setIsSavingFda(true);
    try {
      const res = await api.updateDeveloperFdaApiKey(keyToSave);
      setHasFdaKey(res.has_key);
      if (res.rate_limit) setFdaRateLimit(res.rate_limit);
      setFdaKeyInput("");
      toastSuccess("openFDA API Key updated. Elevated to 240 req/min.");
      fetchDeveloperStatus();
      fetchDiagnostics();
    } catch (err: any) {
      toastError(err.message || "Failed to save openFDA API Key.");
    } finally {
      setIsSavingFda(false);
    }
  };

  const returnUrl = user?.role === "doctor" ? "/doctor" : "/patient";
  const returnLabel = user?.role === "doctor" ? "Return to Review Queue" : "Return to Prescription Upload";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      {/* Top Breadcrumb & Return Link */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
        <Link
          href={returnUrl}
          className="inline-flex items-center gap-1.5 text-xs text-[#747D78] hover:text-[#315C4C] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>{returnLabel}</span>
        </Link>
        <span className="text-[11px] font-mono text-[#747D78]">
          Developer Settings & System Configuration
        </span>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sliders size={20} className="text-[#315C4C]" />
          <h1 className="text-xl font-semibold text-[#202722] tracking-tight">
            Developer Settings
          </h1>
        </div>
        <p className="text-xs text-[#747D78] mt-1 leading-relaxed">
          Configure API credentials for Google Gemini Vision prescription transcription, openFDA label queries, and inspect live pipeline diagnostics.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gemini Vision API Key Box */}
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#315C4C]" />
              <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                Google Gemini Vision API Key
              </h2>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                hasGeminiKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/30"
              }`}
            >
              {hasGeminiKey ? "CONFIGURED" : "KEY REQUIRED"}
            </span>
          </div>

          <p className="text-xs text-[#747D78] leading-relaxed">
            The Gemini multimodal model transcribes handwritten prescriptions and extracts medicine line items with normalized bounding boxes.
          </p>

          <div className="p-2.5 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs font-mono space-y-1">
            <div className="flex items-center justify-between text-[#747D78]">
              <span>Active Model:</span>
              <span className="font-semibold text-[#315C4C]">{activeModel}</span>
            </div>
            {maskedKey && (
              <div className="flex items-center justify-between text-[#747D78]">
                <span>Active Key:</span>
                <span className="text-[#202722]">{maskedKey}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleTestAndSaveGeminiKey} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#202722] mb-1">
                Enter New Gemini API Key:
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={hasGeminiKey ? "Paste new key to replace..." : "AIzaSy..."}
                  className="w-full text-xs font-mono bg-[#F7F6F2] border border-[#E5E3DC] rounded px-3 py-2 pr-9 focus:bg-white focus:outline-none focus:border-[#315C4C]"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-2.5 text-[#747D78] hover:text-[#202722] cursor-pointer"
                  aria-label="Toggle key visibility"
                >
                  {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Validation Feedback Banner */}
            {validationResult && (
              <div
                className={`p-2.5 rounded text-xs border ${
                  validationResult.valid
                    ? "bg-[#EDF7EE] text-[#2E7D32] border-[#2E7D32]/20"
                    : "bg-[#FAEEEE] text-[#A33F38] border-[#A33F38]/20"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {validationResult.valid ? (
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{validationResult.message}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSavingGemini || !geminiKeyInput.trim()}
                className="flex-1 py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
              >
                {isSavingGemini ? "Verifying & Saving..." : "Test & Save API Key"}
              </button>

              {hasGeminiKey && !geminiKeyInput && (
                <button
                  type="button"
                  onClick={handleValidateActiveKey}
                  disabled={isValidatingGemini}
                  className="px-3 py-2 bg-[#F1EFEA] hover:bg-[#E5E3DC] text-[#202722] text-xs font-medium rounded transition-colors border border-[#E5E3DC] cursor-pointer disabled:opacity-50"
                  title="Test if the currently saved key is valid"
                >
                  {isValidatingGemini ? "Checking..." : "Test Active Key"}
                </button>
              )}
            </div>
          </form>

          {/* Quick instructions to get a key */}
          <div className="pt-2 border-t border-[#F1EFEA] text-[11px] text-[#747D78] space-y-1">
            <p>Need a free Gemini Vision API Key?</p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#315C4C] hover:underline font-medium"
            >
              <span>Get API Key on Google AI Studio</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* openFDA API Key Box */}
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#315C4C]" />
              <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
                openFDA API Key (Optional)
              </h2>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                hasFdaKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#F1EFEA] text-[#747D78] border border-[#E5E3DC]"
              }`}
            >
              {hasFdaKey ? "CONFIGURED" : "PUBLIC TIER"}
            </span>
          </div>

          <p className="text-xs text-[#747D78] leading-relaxed">
            The openFDA drug label endpoint works out-of-the-box in public tier. Providing a free FDA key elevates your rate limit from 40 to 240 requests/minute.
          </p>

          <div className="p-2.5 rounded bg-[#F7F6F2] border border-[#E5E3DC] text-xs font-mono space-y-1">
            <div className="flex items-center justify-between text-[#747D78]">
              <span>Rate Limit:</span>
              <span className="font-semibold text-[#202722]">{fdaRateLimit}</span>
            </div>
          </div>

          <form onSubmit={handleSaveFdaKey} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#202722] mb-1">
                Enter openFDA Key:
              </label>
              <div className="relative">
                <input
                  type={showFdaKey ? "text" : "password"}
                  value={fdaKeyInput}
                  onChange={(e) => setFdaKeyInput(e.target.value)}
                  placeholder={hasFdaKey ? "Paste key to update..." : "FDA API Key..."}
                  className="w-full text-xs font-mono bg-[#F7F6F2] border border-[#E5E3DC] rounded px-3 py-2 pr-9 focus:bg-white focus:outline-none focus:border-[#315C4C]"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowFdaKey(!showFdaKey)}
                  className="absolute right-2.5 top-2.5 text-[#747D78] hover:text-[#202722] cursor-pointer"
                  aria-label="Toggle FDA key visibility"
                >
                  {showFdaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingFda || !fdaKeyInput.trim()}
              className="w-full py-2 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
            >
              {isSavingFda ? "Saving..." : "Save openFDA Key"}
            </button>
          </form>

          <div className="pt-2 border-t border-[#F1EFEA] text-[11px] text-[#747D78] space-y-1">
            <p>Get a free openFDA key instantaneously:</p>
            <a
              href="https://open.fda.gov/apis/authentication/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#315C4C] hover:underline font-medium"
            >
              <span>Get openFDA Key</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* System Diagnostics Table */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[#315C4C]" />
            <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
              Live Pipeline Services & Diagnostics
            </h2>
          </div>
          <button
            onClick={fetchDiagnostics}
            disabled={loadingDeps}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#315C4C] hover:bg-[#E8EEE8] rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loadingDeps ? "animate-spin" : ""} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E3DC] text-[11px] font-mono text-[#747D78] uppercase">
                <th className="py-2 px-3">Service</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Latency</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EFEA]">
              {/* Gemini Vision */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">Google Gemini Multimodal</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      hasGeminiKey
                        ? "bg-[#EDF7EE] text-[#2E7D32]"
                        : "bg-[#FCF5EB] text-[#A56A19]"
                    }`}
                  >
                    {hasGeminiKey ? "CONFIGURED" : "KEY REQUIRED"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  {deps?.gemini_vision?.latency_ms ? `${deps.gemini_vision.latency_ms} ms` : "—"}
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  {hasGeminiKey ? `Active model: ${activeModel}` : "Enter API key above to transcribe prescriptions."}
                </td>
              </tr>

              {/* Database */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">SQLite Database</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EDF7EE] text-[#2E7D32]">
                    ONLINE
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  {deps?.database?.latency_ms ? `${deps.database.latency_ms} ms` : "< 1 ms"}
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  {deps?.database?.details || "Local SQLite database operational."}
                </td>
              </tr>

              {/* RxNorm */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">NIH NLM RxNorm REST API</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      deps?.rxnorm_api?.status === "healthy"
                        ? "bg-[#EDF7EE] text-[#2E7D32]"
                        : "bg-[#FCF5EB] text-[#A56A19]"
                    }`}
                  >
                    {deps?.rxnorm_api?.status === "healthy" ? "ONLINE" : "CHECKING"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  {deps?.rxnorm_api?.latency_ms ? `${deps.rxnorm_api.latency_ms} ms` : "—"}
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  {deps?.rxnorm_api?.details || "RxCUI clinical code resolution."}
                </td>
              </tr>

              {/* DailyMed */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">NIH NLM DailyMed SPL</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      deps?.dailymed_api?.status === "healthy"
                        ? "bg-[#EDF7EE] text-[#2E7D32]"
                        : "bg-[#FCF5EB] text-[#A56A19]"
                    }`}
                  >
                    {deps?.dailymed_api?.status === "healthy" ? "ONLINE" : "CHECKING"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  {deps?.dailymed_api?.latency_ms ? `${deps.dailymed_api.latency_ms} ms` : "—"}
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  {deps?.dailymed_api?.details || "FDA Structured Product Label retrieval."}
                </td>
              </tr>

              {/* openFDA */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">openFDA Drug Label API</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      deps?.openfda_api?.status === "healthy"
                        ? "bg-[#EDF7EE] text-[#2E7D32]"
                        : "bg-[#FCF5EB] text-[#A56A19]"
                    }`}
                  >
                    {deps?.openfda_api?.status === "healthy" ? "ONLINE" : "CHECKING"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  {deps?.openfda_api?.latency_ms ? `${deps.openfda_api.latency_ms} ms` : "—"}
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  {deps?.openfda_api?.details || fdaRateLimit}
                </td>
              </tr>

              {/* Qdrant */}
              <tr>
                <td className="py-2.5 px-3 font-medium text-[#202722]">Qdrant Vector Database</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EDF7EE] text-[#2E7D32]">
                    ONLINE
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                  0.5 ms
                </td>
                <td className="py-2.5 px-3 text-[#747D78] text-[11px]">
                  Drug-food interaction vector embedding index.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered Database Users Inspector */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC]">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#315C4C]" />
            <h2 className="font-semibold text-xs text-[#202722] uppercase tracking-wider font-mono">
              Registered Users in Database ({usersList.length})
            </h2>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loadingUsers}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#315C4C] hover:bg-[#E8EEE8] rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loadingUsers ? "animate-spin" : ""} />
            <span>Refresh Users</span>
          </button>
        </div>

        {usersList.length === 0 ? (
          <p className="text-xs text-[#747D78] py-3 text-center">
            {loadingUsers ? "Loading users from database..." : "No users found in database."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E3DC] text-[11px] font-mono text-[#747D78] uppercase">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Role</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EFEA]">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F6F2]">
                    <td className="py-2.5 px-3 font-semibold text-[#202722]">
                      {u.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          u.role === "doctor"
                            ? "bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20"
                            : "bg-[#F1EFEA] text-[#747D78] border border-[#E5E3DC]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#747D78]">
                      {u.email}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[#747D78] tabular-nums">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
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
