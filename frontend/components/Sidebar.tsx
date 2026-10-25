"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  UserCheck,
  Users,
  Settings,
  FilePlus,
  History,
  User,
  LogOut,
  Menu,
  X,
  Stethoscope,
  ShieldCheck,
  LogIn,
  Sliders
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setMounted(true);

    api.getHealth()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));

    api.getKeyStatus()
      .then((res) => setHasApiKey(res.has_key))
      .catch(() => setHasApiKey(false));
  }, []);

  // Do not render sidebar on /login
  if (pathname === "/login") {
    return null;
  }

  const isDoctor = user?.role === "doctor";

  const doctorNavItems = [
    { href: "/doctor", label: "Review Queue", icon: UserCheck },
    { href: "/doctor/patients", label: "Patient Directory", icon: Users },
    { href: "/doctor/settings", label: "AI & System Settings", icon: Settings },
    { href: "/developer/settings", label: "Developer Settings", icon: Sliders },
  ];

  const patientNavItems = [
    { href: "/patient", label: "Upload Prescription", icon: FilePlus },
    { href: "/patient/history", label: "My Prescriptions", icon: History },
    { href: "/patient/profile", label: "Health Profile", icon: User },
    { href: "/developer/settings", label: "Developer Settings", icon: Sliders },
  ];

  const navItems = isDoctor ? doctorNavItems : patientNavItems;

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md bg-white border border-[#E5E3DC] text-[#202722] shadow-xs hover:bg-[#F1EFEA] cursor-pointer"
          aria-label="Toggle Navigation Menu"
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#315C4C] text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-xs">
              Rx
            </div>
            <div>
              <h1 className="font-semibold text-base text-[#202722] tracking-tight">MedDRAG</h1>
              <p className="text-[11px] text-[#747D78] font-mono tracking-tight leading-none mt-0.5">
                {isDoctor ? "Doctor Workspace" : "Patient Portal"}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F1EFEA] flex items-center justify-between">
            <span className="text-[11px] text-[#202722] font-medium leading-snug">
              {isDoctor ? "Clinical Verification Triage" : "Medication & Diet Guidance"}
            </span>
            {user ? (
              <span
                className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  isDoctor
                    ? "bg-[#E8EEE8] text-[#315C4C] border border-[#315C4C]/20"
                    : "bg-[#F1EFEA] text-[#747D78] border border-[#E5E3DC]"
                }`}
              >
                {user.role}
              </span>
            ) : (
              <Link
                href="/login"
                className="text-[10px] font-medium text-[#315C4C] hover:underline"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/doctor" || item.href === "/patient"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#315C4C] text-white shadow-xs font-semibold"
                    : "text-[#202722] hover:bg-[#E8EEE8] hover:text-[#315C4C]"
                }`}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-[#747D78]"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        {user ? (
          <div className="p-3 border-t border-[#E5E3DC] bg-white">
            <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#F7F6F2] border border-[#E5E3DC]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#E8EEE8] border border-[#315C4C]/20 flex items-center justify-center text-[#315C4C] shrink-0">
                  {isDoctor ? <Stethoscope size={14} /> : <User size={14} />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#202722] truncate leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-[#747D78] font-mono truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-1.5 text-[#747D78] hover:text-[#A33F38] hover:bg-[#FAEEEE] rounded transition-colors cursor-pointer shrink-0"
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-[#E5E3DC] bg-white">
            <Link
              href="/login"
              className="w-full py-2 px-3 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogIn size={14} />
              <span>Sign In / Register</span>
            </Link>
          </div>
        )}

        {/* System & Mode Badges */}
        <div className="p-3 border-t border-[#E5E3DC] bg-[#F1EFEA]/60 text-xs space-y-1.5">
          <Link
            href="/developer/settings"
            className="flex items-center justify-between px-2 py-1 rounded bg-white border border-[#E5E3DC] hover:border-[#315C4C]/40 transition-colors cursor-pointer group"
            title="Configure Gemini API Key in Developer Settings"
          >
            <span className="text-[10px] font-mono font-medium text-[#747D78] group-hover:text-[#315C4C]">
              Gemini Vision
            </span>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                mounted && hasApiKey
                  ? "bg-[#EDF7EE] text-[#2E7D32] border border-[#2E7D32]/20"
                  : "bg-[#FCF5EB] text-[#A56A19] border border-[#A56A19]/20"
              }`}
            >
              {mounted && hasApiKey ? "ACTIVE" : "KEY REQ"}
            </span>
          </Link>

          <div className="flex items-center justify-between px-2 py-0.5 text-[10px] text-[#747D78] font-mono">
            <span>FastAPI Server</span>
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  mounted && backendStatus === "online"
                    ? "bg-[#2E7D32]"
                    : mounted && backendStatus === "offline"
                    ? "bg-[#A33F38]"
                    : "bg-[#A56A19] animate-pulse"
                }`}
              />
              <span className="capitalize text-[10px]">{mounted ? backendStatus : "checking"}</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
