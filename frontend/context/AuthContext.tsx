"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: "patient" | "doctor";
    age?: number | null;
    sex?: string | null;
    allergies?: string[];
    conditions?: string[];
    notes?: string | null;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      try {
        await api.logout();
      } catch {
        // ignore
      }
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/patient") || path.startsWith("/doctor")) {
          router.push(`/login?redirect=${encodeURIComponent(path)}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (data: { email: string; password: string }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login(data);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role: "patient" | "doctor";
    age?: number | null;
    sex?: string | null;
    allergies?: string[];
    conditions?: string[];
    notes?: string | null;
  }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
