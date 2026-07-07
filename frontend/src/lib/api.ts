// src/lib/api.ts
// Full API client for InterviewX Django backend.
// Handles JWT access/refresh tokens, typed responses, and auto-refresh on 401.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Token storage ─────────────────────────────────────────────────────────────

export const tokens = {
  getAccess: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("ix_access") : null,
  getRefresh: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("ix_refresh") : null,
  set: (access: string, refresh: string) => {
    localStorage.setItem("ix_access", access);
    localStorage.setItem("ix_refresh", refresh);
  },
  clear: () => {
    localStorage.removeItem("ix_access");
    localStorage.removeItem("ix_refresh");
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  subscription_plan: "free" | "premium";
  interviews_this_month?: number;
  is_email_verified?: boolean;
  auth_provider?: "email" | "google";
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterResponse {
  detail: string;
  email: string;
  requires_verification: true;
}

export interface InterviewInsights {
  topics?: { name: string; score: number; note: string }[];
  improvement_areas?: { area: string; suggestion: string }[];
}

export interface InterviewSession {
  id: number;
  round: number;
  status: "in_progress" | "completed" | "abandoned";
  transcript: { role: "user" | "ai"; text: string; ts: string }[];
  scores: {
    communication?: number;
    technical?: number;
    problem_solving?: number;
    overall?: number;
  };
  feedback: string;
  insights?: InterviewInsights;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  time_expired: boolean;
}

export interface Company {
  id: number;
  name: string;
  tone_style: string;
  is_free?: boolean;
}

export interface Round {
  id: number;
  title: string;
  round_type: string;
}

export interface Role {
  id: number;
  title: string;
  rounds: Round[];
}

export interface CompanyDetail extends Company {
  roles: Role[];
}

export interface StartInterviewResponse {
  session_id: number;
  ai_message: string;
  session: InterviewSession;
}

export interface RealInterviewRound {
  round_name: string;
  topics: string;
}

export interface RealInterviewReportPayload {
  had_recent_interview: "yes" | "no";
  name?: string;
  email?: string;
  company_name?: string;
  role_title?: string;
  rounds?: RealInterviewRound[];
  can_provide_proof?: boolean;
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokens.getRefresh();
  if (!refresh) return null;

  const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    tokens.clear();
    return null;
  }

  const data = await res.json();
  tokens.set(data.access, refresh);
  return data.access;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public code?: string
  ) {
    super(detail);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const access = tokens.getAccess();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(newToken ?? ""));
      refreshQueue = [];

      if (!newToken) throw new ApiError(401, "Session expired. Please log in again.");
      return request<T>(path, options, false);
    }

    // Queue concurrent requests during refresh
    return new Promise((resolve, reject) => {
      refreshQueue.push((token: string) => {
        if (!token) {
          reject(new ApiError(401, "Session expired. Please log in again."));
        } else {
          request<T>(path, options, false).then(resolve).catch(reject);
        }
      });
    });
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json();
      detail = body.detail || detail;
      code = body.code;
    } catch {}
    throw new ApiError(res.status, detail, code);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, username: string, password: string, password2: string) =>
    request<RegisterResponse>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify({ email, username, password, password2 }),
    }),

  verifyEmail: (email: string, code: string) =>
    request<AuthResponse>("/api/auth/verify-email/", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  resendOtp: (email: string) =>
    request<{ detail: string }>("/api/auth/resend-otp/", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  google: (id_token: string) =>
    request<AuthResponse>("/api/auth/google/", {
      method: "POST",
      body: JSON.stringify({ id_token }),
    }),

  me: () => request<User>("/api/auth/me/"),
};

// ── Company endpoints ─────────────────────────────────────────────────────────

export const companies = {
  list: () => request<Company[]>("/api/companies/"),
  detail: (id: number) => request<CompanyDetail>(`/api/companies/${id}/`),
};

// ── Interview endpoints ───────────────────────────────────────────────────────

export const interviews = {
  list: () => request<InterviewSession[]>("/api/interviews/"),
  detail: (id: number) => request<InterviewSession>(`/api/interviews/${id}/`),

  start: (round_id: number) =>
    request<StartInterviewResponse>("/api/interviews/start/", {
      method: "POST",
      body: JSON.stringify({ round_id }),
    }),

  chat: (session_id: number, message: string) =>
    request<{ ai_message: string }>(`/api/interviews/${session_id}/chat/`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  end: (session_id: number) =>
    request<InterviewSession>(`/api/interviews/${session_id}/end/`, {
      method: "POST",
    }),

  submitRealReport: (session_id: number, payload: RealInterviewReportPayload) =>
    request<RealInterviewReportPayload & { id: number; created_at: string }>(
      `/api/interviews/${session_id}/real-report/`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
};

// ── Subscription endpoints ────────────────────────────────────────────────────

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  plan: string;
  key_id: string;
  user_email: string;
  user_name: string;
}

export interface VerifyPaymentResponse {
  detail: string;
  subscription_plan: string;
  subscription_end_date: string;
}

export const subscriptions = {
  createOrder: (plan: "pro" | "premium" | "max") =>
    request<CreateOrderResponse>("/api/subscriptions/create-order/", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  verifyPayment: (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) =>
    request<VerifyPaymentResponse>("/api/subscriptions/verify-payment/", {
      method: "POST",
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    }),
};

export { API_URL };