"use client";
// src/context/AuthContext.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { auth, tokens } from "@/lib/api";
import type { User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: false;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    password2: string
  ) => Promise<void>;
  logout: () => void;
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
  // Initialize synchronously — no useEffect, no loading state needed
  const [user, setUser] = useState<User | null>(readUserFromStorage);

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
      const data = await auth.register(email, username, password, password2);
      tokens.set(data.access, data.refresh);
      persistUser(data.user);
    },
    []
  );

  const logout = useCallback(() => {
    tokens.clear();
    localStorage.removeItem("ix_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading: false, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}