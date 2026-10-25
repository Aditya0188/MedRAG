"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Stethoscope,
  User as UserIcon,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  UserPlus,
  LogIn,
  HeartPulse
} from "lucide-react";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const { login, register } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Common fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration fields
  const [name, setName] = useState("");
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [allergiesText, setAllergiesText] = useState("");
  const [conditionsText, setConditionsText] = useState("");

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setFormError("Please enter both email and password.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      toastSuccess(`Welcome back, ${user.name}`);

      const destination = redirectTarget || (user.role === "doctor" ? "/doctor" : "/patient");
      router.push(destination);
    } catch (err: any) {
      const msg = err.message || "Invalid credentials. Please verify your email and password.";
      setFormError(msg);
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setFormError("Please fill in your name, email, and password.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      // Parse allergies and conditions
      const allergies = allergiesText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const conditions = conditionsText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const parsedAge = age ? parseInt(age, 10) : null;

      const user = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        age: parsedAge,
        sex: sex.trim() || null,
        allergies,
        conditions,
      });

      toastSuccess(`Account created successfully. Welcome, ${user.name}`);
      const destination = redirectTarget || (user.role === "doctor" ? "/doctor" : "/patient");
      router.push(destination);
    } catch (err: any) {
      const msg = err.message || "Registration failed. Please check your information.";
      setFormError(msg);
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-white border border-[#E5E3DC] rounded-xl shadow-xs p-6 md:p-8">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 pb-5 border-b border-[#E5E3DC]">
        <div className="w-9 h-9 rounded-md bg-[#315C4C] text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-xs">
          Rx
        </div>
        <div>
          <h1 className="font-semibold text-lg text-[#202722] tracking-tight">MedDRAG</h1>
          <p className="text-[11px] text-[#747D78] font-mono tracking-tight leading-none mt-0.5">
            Clinical AI & RAG Decision-Support
          </p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg mt-5 mb-5">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setFormError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
            mode === "signin"
              ? "bg-white text-[#202722] shadow-xs border border-[#E5E3DC]"
              : "text-[#747D78] hover:text-[#202722]"
          }`}
        >
          <LogIn size={14} className={mode === "signin" ? "text-[#315C4C]" : "text-[#747D78]"} />
          <span>Sign In</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("register");
            setFormError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
            mode === "register"
              ? "bg-white text-[#202722] shadow-xs border border-[#E5E3DC]"
              : "text-[#747D78] hover:text-[#202722]"
          }`}
        >
          <UserPlus size={14} className={mode === "register" ? "text-[#315C4C]" : "text-[#747D78]"} />
          <span>Create Account</span>
        </button>
      </div>

      {/* Mode Context Headline */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[#202722] tracking-tight">
          {mode === "signin" ? "Sign In to Your Account" : "Create New MedDRAG Account"}
        </h2>
        <p className="text-xs text-[#747D78] mt-1 leading-relaxed">
          {mode === "signin"
            ? "Enter your credentials to access your clinician workspace or patient medication records."
            : "Register as a patient to track outpatient prescriptions or as a clinician to verify and triage."}
        </p>
      </div>

      {/* Inline Form Error Notification */}
      {formError && (
        <div className="mb-4 p-3 bg-[#FAEEEE] border border-[#A33F38]/30 rounded-md text-xs text-[#A33F38] flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* SIGN IN FORM */}
      {mode === "signin" ? (
        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="signin-email">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              <input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="signin-password">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              <input
                id="signin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              "Authenticating..."
            ) : (
              <>
                <span>Sign In to Portal</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <span className="text-xs text-[#747D78]">Need an account? </span>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setFormError(null);
              }}
              className="text-xs text-[#315C4C] hover:underline font-medium cursor-pointer"
            >
              Create an account
            </button>
          </div>
        </form>
      ) : (
        /* REGISTRATION FORM */
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {/* Role Selector */}
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5">
              Select Account Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("patient")}
                className={`p-3 text-left border rounded-lg transition-all cursor-pointer ${
                  role === "patient"
                    ? "border-[#315C4C] bg-[#E8EEE8]/40 ring-1 ring-[#315C4C]"
                    : "border-[#E5E3DC] bg-[#F7F6F2] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#202722]">
                  <UserIcon size={14} className={role === "patient" ? "text-[#315C4C]" : "text-[#747D78]"} />
                  <span>Patient</span>
                </div>
                <div className="text-[10px] text-[#747D78] mt-1 leading-normal">
                  Upload prescriptions, view daily schedule & food guides
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("doctor")}
                className={`p-3 text-left border rounded-lg transition-all cursor-pointer ${
                  role === "doctor"
                    ? "border-[#315C4C] bg-[#E8EEE8]/40 ring-1 ring-[#315C4C]"
                    : "border-[#E5E3DC] bg-[#F7F6F2] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#202722]">
                  <Stethoscope size={14} className={role === "doctor" ? "text-[#315C4C]" : "text-[#747D78]"} />
                  <span>Doctor / Clinician</span>
                </div>
                <div className="text-[10px] text-[#747D78] mt-1 leading-normal">
                  Review queue, verify OCR/RxNorm & sign off on summaries
                </div>
              </button>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="reg-name">
              {role === "doctor" ? "Doctor Full Name" : "Patient Full Name"}
            </label>
            <div className="relative">
              {role === "doctor" ? (
                <Stethoscope size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              ) : (
                <UserIcon size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              )}
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "doctor" ? "e.g. Dr. Jane Smith, MD" : "e.g. Jane Doe"}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="reg-email">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === "doctor" ? "dr.smith@hospital.org" : "jane.doe@example.com"}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[#202722] mb-1.5" htmlFor="reg-password">
              Password (min. 6 characters)
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-[#747D78]" />
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F2] border border-[#E5E3DC] rounded-md text-[#202722] placeholder:text-[#747D78]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#315C4C]/20 focus:border-[#315C4C] transition-all font-mono"
              />
            </div>
          </div>

          {/* Optional Patient Health Profile Fields */}
          {role === "patient" && (
            <div className="p-3 bg-[#F7F6F2] border border-[#E5E3DC] rounded-lg space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#202722] font-mono uppercase tracking-wider">
                <HeartPulse size={13} className="text-[#315C4C]" />
                <span>Initial Health Profile (Optional)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#747D78] mb-1" htmlFor="reg-age">
                    Age
                  </label>
                  <input
                    id="reg-age"
                    type="number"
                    min={0}
                    max={130}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E3DC] rounded text-[#202722] placeholder:text-[#747D78]/60 focus:outline-none focus:border-[#315C4C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#747D78] mb-1" htmlFor="reg-sex">
                    Biological Sex
                  </label>
                  <select
                    id="reg-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E3DC] rounded text-[#202722] focus:outline-none focus:border-[#315C4C]"
                  >
                    <option value="">Select...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#747D78] mb-1" htmlFor="reg-allergies">
                  Known Drug Allergies (comma-separated)
                </label>
                <input
                  id="reg-allergies"
                  type="text"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E3DC] rounded text-[#202722] placeholder:text-[#747D78]/60 focus:outline-none focus:border-[#315C4C]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#747D78] mb-1" htmlFor="reg-conditions">
                  Pre-existing Conditions (comma-separated)
                </label>
                <input
                  id="reg-conditions"
                  type="text"
                  value={conditionsText}
                  onChange={(e) => setConditionsText(e.target.value)}
                  placeholder="e.g. Hypertension, Asthma, Type 2 Diabetes"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E3DC] rounded text-[#202722] placeholder:text-[#747D78]/60 focus:outline-none focus:border-[#315C4C]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-[#315C4C] hover:bg-[#25463A] text-white text-xs font-medium rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              "Creating Account..."
            ) : (
              <>
                <span>Complete Registration & Open Portal</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <span className="text-xs text-[#747D78]">Already have an account? </span>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setFormError(null);
              }}
              className="text-xs text-[#315C4C] hover:underline font-medium cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="w-full max-w-lg h-96 bg-white rounded-xl border border-[#E5E3DC] animate-pulse" />}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
