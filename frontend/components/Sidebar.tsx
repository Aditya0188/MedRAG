"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FilePlus,
  History,
  UserCheck,
  BookOpen,
  Settings,
  Activity,
  Menu,
  X,
  Key
} from "lucide-react";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/new-analysis", label: "New Analysis", icon: FilePlus },
  { href: "/history", label: "Prescription History", icon: History },
  { href: "/doctor-review", label: "Doctor Review", icon: UserCheck },
  { href: "/evidence-library", label: "Evidence Library", icon: BookOpen },
  { href: "/settings", label: "Settings & Status", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    api.getHealth()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));

    api.getKeyStatus()
      .then((res) => setHasApiKey(res.has_key))
      .catch(() => setHasApiKey(false));
  }, []);

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md bg-white border border-[#E5E3DC] text-[#202722] shadow-sm hover:bg-[#F1EFEA]"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-xs z-40"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#F7F6F2] border-r border-[#E5E3DC] flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand & Project Identity */}
        <div className="p-5 border-b border-[#E5E3DC] bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#315C4C] text-white flex items-center justify-center font-bold text-sm tracking-wider">
              Rx
            </div>
            <div>
              <h1 className="font-semibold text-base text-[#202722] tracking-tight">MedDRAG</h1>
              <p className="text-[11px] text-[#747D78] font-mono tracking-tight leading-none">Clinical AI & RAG</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F1EFEA]">
            <p className="text-[11px] text-[#202722] font-medium leading-snug">
              Prescription Analysis & Drug-Food RAG
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#315C4C] text-white shadow-xs"
                    : "text-[#202722] hover:bg-[#E8EEE8] hover:text-[#315C4C]"
                }`}
              >
                <Icon size={18} className={isActive ? "text-white" : "text-[#747D78]"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System & Mode Badge */}
        <div className="p-4 border-t border-[#E5E3DC] bg-[#F1EFEA]/60 text-xs space-y-2">
          {/* AI Vision Status */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white border border-[#E5E3DC]">
            <span className="text-[11px] font-mono font-medium text-[#747D78]">Gemini Vision</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                hasApiKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20"
              }`}
            >
              {hasApiKey ? "ACTIVE" : "KEY NEEDED"}
            </span>
          </div>

          {/* Backend Status */}
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-[#747D78] font-mono">
            <span>FastAPI Server</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-[#2E7D32]"
                    : backendStatus === "checking"
                    ? "bg-[#A56A19] animate-pulse"
                    : "bg-[#A33F38]"
                }`}
              />
              <span className="capitalize">{backendStatus}</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
