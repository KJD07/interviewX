"use client";
// src/context/AuthContext.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, tokens } from "@/lib/api";
import type { User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    password2: string
  ) => Promise<{ email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUserFromStorage(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ix_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: always start as null/true on both server and client so the
  // very first client render matches the server-rendered HTML exactly.
  // We only read localStorage AFTER mount (inside useEffect), which runs
  // client-side only, after hydration has already reconciled successfully.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readUserFromStorage());
    setLoading(false);
  }, []);

  const persistUser = (u: User) => {
    setUser(u);
    localStorage.setItem("ix_user", JSON.stringify(u));
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await auth.login(email, password);
    tokens.set(data.access, data.refresh);
    persistUser(data.user);
  }, []);

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      password2: string
    ) => {
      // No tokens yet — the account isn't usable until the OTP is verified.
      const data = await auth.register(email, username, password, password2);
      return { email: data.email };
    },
    []
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const data = await auth.verifyEmail(email, code);
    tokens.set(data.access, data.refresh);
    persistUser(data.user);
  }, []);

  const resendOtp = useCallback(async (email: string) => {
    await auth.resendOtp(email);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await auth.google(idToken);
    tokens.set(data.access, data.refresh);
    persistUser(data.user);
  }, []);

  const logout = useCallback(() => {
    tokens.clear();
    localStorage.removeItem("ix_user");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await auth.me();
    persistUser(fresh);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyEmail,
        resendOtp,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}