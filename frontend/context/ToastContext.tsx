"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((msg: string) => showToast(msg, "success"), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, "error"), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, "info"), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, "warning"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}

      {/* Toast Overlay Container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-lg border shadow-sm text-xs font-medium transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
              t.type === "success"
                ? "bg-[#EDF7EE] text-[#2E7D32] border-[#2E7D32]/30"
                : t.type === "error"
                ? "bg-[#FAEEEE] text-[#A33F38] border-[#A33F38]/30"
                : t.type === "warning"
                ? "bg-[#FCF5EB] text-[#A56A19] border-[#A56A19]/30"
                : "bg-white text-[#202722] border-[#E5E3DC]"
            }`}
          >
            {t.type === "success" && <CheckCircle2 size={16} className="shrink-0 text-[#2E7D32]" />}
            {t.type === "error" && <AlertCircle size={16} className="shrink-0 text-[#A33F38]" />}
            {t.type === "warning" && <AlertCircle size={16} className="shrink-0 text-[#A56A19]" />}
            {t.type === "info" && <Info size={16} className="shrink-0 text-[#315C4C]" />}

            <div className="flex-1 leading-relaxed">{t.message}</div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-[#747D78] hover:text-[#202722] p-0.5 rounded transition-colors cursor-pointer"
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
