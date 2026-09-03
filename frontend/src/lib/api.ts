// src/lib/api.ts
// Full API client for EvaluLabs Django backend.
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

// Dispatched whenever a token refresh fails (refresh token expired/invalid/
// blacklisted). AuthContext listens for this to clear its `user` state and
// the `ix_user` localStorage snapshot — without it, tokens.clear() wipes the
// tokens but the app still looks logged in (stale ix_user), so every
// subsequent request fails the same way with no path back to /login.
export const AUTH_EXPIRED_EVENT = "ix:auth-expired";
function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  subscription_plan: "free" | "pro" | "premium" | "max";
  monthly_limit?: number | null;
  interviews_this_month?: number;
  bonus_interviews?: number;
  is_email_verified?: boolean;
  is_staff?: boolean;
  auth_provider?: "email" | "google";
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface AdminField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readonly: boolean;
  help_text: string;
  choices: { value: string; label: string }[];
  options: { value: number; label: string }[];
  is_m2m: boolean;
}

export interface AdminFieldset {
  title: string;
  field_names: string[];
}

export interface AdminInline {
  app_label: string;
  model_name: string;
  label: string;
  fk_name: string;
}

export interface AdminListFilter {
  name: string;
  label: string;
  choices: { value: string; label: string }[];
}

export interface AdminModel {
  app_label: string;
  model: string;
  label: string;
  fields: AdminField[];
  list_display: string[];
  search_fields: string[];
  list_filter: AdminListFilter[];
  fieldsets: AdminFieldset[];
  inlines: AdminInline[];
  actions: { name: string; label: string }[];
  can_view: boolean;
  can_add: boolean;
  can_change: boolean;
  can_delete: boolean;
}

export interface AdminObject {
  id: number;
  [key: string]: unknown;
}

export interface AdminHistoryEntry {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  change_message: string;
}

export interface AdminDeletePreview {
  objects: string[];
  model_count: Record<string, number>;
  protected: string[];
  perms_needed: string[];
}

export interface AdminLookupResult {
  value: number;
  label: string;
}

export interface AdminInsights {
  referrals: Record<string, number>;
  new_users: { month: string; count: number }[];
  monthly_active_users: { month: string; count: number }[];
  plans: Record<string, number>;
  companies: number;
  revenue: Record<"day" | "week" | "month" | "quarter" | "year", number>;
  revenue_daily: { day: string; amount: number }[];
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

// A code/system-design submission attached to a transcript turn, or (with
// no `content`) the AI's signal to open the workspace before one exists.
export interface WorkspacePayload {
  type: "coding" | "system_design";
  content?: string;
  language?: string;
  // True for the auto-sent mid-attempt snapshots (see the workspace
  // components' check-in debounce) — the candidate hasn't submitted yet, so
  // the panel stays open and the AI is told not to grade it.
  draft?: boolean;
}

export interface InterviewSession {
  id: number;
  round: number;
  company_name?: string;
  role_title?: string;
  status: "in_progress" | "completed" | "abandoned";
  transcript: { role: "user" | "ai"; text: string; ts: string; workspace?: WorkspacePayload }[];
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
  // True only for sessions started via an org candidate invite
  // (apps.enterprise.OrgCandidateInvite) — gates webcam-based proctoring.
  is_proctored?: boolean;
  // Superuser-only opt-in (Organization.live_camera_enabled) — gates
  // WebRTC-publishing this candidate's camera for org members to watch live.
  live_camera_enabled?: boolean;
}

export type ProctoringEventType =
  | "no_face"
  | "multiple_faces"
  | "gaze_away"
  | "tab_switch"
  | "low_light"
  | "phone_detected"
  | "other";

export interface Company {
  id: number;
  name: string;
  tone_style: string;
  description?: string;
  is_free?: boolean;
  kind?: "company" | "skill";
  category?: string;
  question_count?: number;
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
  open_workspace: { type: "coding" | "system_design"; language?: string } | null;
  session: InterviewSession;
}

export interface RealInterviewRound {
  round_name: string;
  topics: string;
  // Literal questions the candidate was asked in this round, if they chose
  // to share them. Verified submissions earn 5 extra bonus interviews
  // (once per report) for users currently on a paid plan.
  questions?: string[];
}

export interface RealInterviewReportPayload {
  had_recent_interview: "yes" | "no";
  name?: string;
  email?: string;
  company_name?: string;
  role_title?: string;
  round_name?: string;
  questions?: string[];
  rounds?: RealInterviewRound[];
  can_provide_proof?: boolean;
  // Which of the user's own completed sessions this was submitted
  // alongside, if any (omit when submitted on-demand from the dashboard).
  session?: number;
}

export interface RealInterviewReport extends RealInterviewReportPayload {
  id: number;
  user: number;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
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
    notifyAuthExpired();
    return null;
  }

  const data = await res.json();
  // The backend may rotate refresh tokens (SIMPLE_JWT ROTATE_REFRESH_TOKENS);
  // if it sends a new one back, it must replace ours — reusing the old one
  // after rotation gets it blacklisted and permanently breaks future refreshes.
  tokens.set(data.access, data.refresh ?? refresh);
  return data.access;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public code?: string,
    public body?: unknown
  ) {
    super(detail);
  }
}

// DRF error bodies come in two shapes: {"detail": "..."} for most view-level
// errors, or {"field": ["msg", ...], ...} for serializer validation errors —
// the latter has no "detail" key, so without this the UI fell back to a bare
// status code for every validation error (e.g. registering with a taken email).
function extractDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.detail === "string" && obj.detail) return obj.detail;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
  authRequired = true
): Promise<T> {
  const access = authRequired ? tokens.getAccess() : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401. Public endpoints (authRequired=false) never attach a
  // token in the first place, so a 401 from them is a real auth error (e.g.
  // invalid credentials) — let it fall through to the generic error handling
  // below instead of being swallowed by the refresh/retry flow.
  if (authRequired && res.status === 401 && retry) {
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
    let code: string | undefined;
    let body: unknown;
    try {
      body = await res.json();
    } catch {}
    if (body && typeof body === "object") {
      code = (body as any).code;
    }
    // Only reached when the backend sent nothing usable (network-level
    // failure, non-JSON body, or an empty error payload) — surface the raw
    // status rather than inventing wording the backend never sent.
    const detail = extractDetail(body) || `Request failed (${res.status})`;
    throw new ApiError(res.status, detail, code, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, username: string, password: string, password2: string) =>
    request<RegisterResponse>(
      "/api/auth/register/",
      { method: "POST", body: JSON.stringify({ email, username, password, password2 }) },
      true,
      false
    ),

  verifyEmail: (email: string, code: string) =>
    request<AuthResponse>(
      "/api/auth/verify-email/",
      { method: "POST", body: JSON.stringify({ email, code }) },
      true,
      false
    ),

  resendOtp: (email: string) =>
    request<{ detail: string }>(
      "/api/auth/resend-otp/",
      { method: "POST", body: JSON.stringify({ email }) },
      true,
      false
    ),

  login: (email: string, password: string) =>
    request<AuthResponse>(
      "/api/auth/login/",
      { method: "POST", body: JSON.stringify({ email, password }) },
      true,
      false
    ),

  google: (id_token: string) =>
    request<AuthResponse>(
      "/api/auth/google/",
      { method: "POST", body: JSON.stringify({ id_token }) },
      true,
      false
    ),

  googleAdmin: (id_token: string) =>
    request<AuthResponse>(
      "/api/auth/google-admin/",
      { method: "POST", body: JSON.stringify({ id_token }) },
      true,
      false
    ),

  me: () => request<User>("/api/auth/me/"),

  forgotPassword: (email: string) =>
    request<{ detail: string }>(
      "/api/auth/forgot-password/",
      { method: "POST", body: JSON.stringify({ email }) },
      true,
      false
    ),

  resetPassword: (
    email: string,
    code: string,
    new_password: string,
    new_password2: string
  ) =>
    request<AuthResponse>(
      "/api/auth/reset-password/",
      { method: "POST", body: JSON.stringify({ email, code, new_password, new_password2 }) },
      true,
      false
    ),
};

export const adminApi = {
  insights: () => request<AdminInsights>("/api/analytics/referral/dashboard/"),
  schema: () => request<{ groups: { app_label: string; models: AdminModel[] }[] }>("/api/admin/schema/"),
  list: (model: AdminModel, page: number, search: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ page: String(page), search });
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (value) params.set(`filter_${key}`, value);
    });
    return request<{ results: AdminObject[]; page: number; page_size: number; total: number }>(
      `/api/admin/${model.app_label}/${model.model}/?${params.toString()}`
    );
  },
  create: (model: AdminModel, data: Record<string, unknown>) =>
    request<{ object: AdminObject }>(`/api/admin/${model.app_label}/${model.model}/`, { method: "POST", body: JSON.stringify(data) }),
  update: (model: AdminModel, id: number, data: Record<string, unknown>) =>
    request<{ object: AdminObject }>(`/api/admin/${model.app_label}/${model.model}/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (model: AdminModel, id: number) =>
    request<void>(`/api/admin/${model.app_label}/${model.model}/${id}/`, { method: "DELETE" }),
  // Fetches one parent's inline children (e.g. the Roles under a Company),
  // filtered server-side by the real FK field name — unlike `list`'s
  // `filter_<name>` params, this isn't restricted to list_filter membership.
  listChildren: (model: AdminModel, fkName: string, parentId: number) =>
    request<{ results: AdminObject[]; total: number }>(
      `/api/admin/${model.app_label}/${model.model}/?page=1&search=&${encodeURIComponent(fkName)}=${parentId}`
    ),
  deletePreview: (model: AdminModel, id: number) =>
    request<AdminDeletePreview>(`/api/admin/${model.app_label}/${model.model}/${id}/delete-preview/`),
  action: (model: AdminModel, action: string, ids: number[]) =>
    request<{ detail: string }>(`/api/admin/${model.app_label}/${model.model}/${action}/`, { method: "POST", body: JSON.stringify({ ids }) }),
  lookup: (appLabel: string, modelName: string, q: string) =>
    request<{ results: AdminLookupResult[] }>(`/api/admin/${appLabel}/${modelName}/lookup/?q=${encodeURIComponent(q)}`),
  history: (model: AdminModel, id: number) =>
    request<{ entries: AdminHistoryEntry[] }>(`/api/admin/${model.app_label}/${model.model}/${id}/history/`),

  // Bypasses the shared request() wrapper (same reason as
  // organizations.uploadQuestions): a multipart body needs its own
  // browser-set Content-Type boundary, not the wrapper's fixed JSON header.
  uploadSpreadsheet: async (file: File): Promise<{ detail: string }> => {
    const access = tokens.getAccess();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/admin/companies/company/upload-spreadsheet/`, {
      method: "POST",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: form,
    });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, extractDetail(body) || `Request failed (${res.status})`, undefined, body);
    return body;
  },

  uploadSponsorshipEmails: async (campaignId: number, file: File): Promise<{ detail: string }> => {
    const access = tokens.getAccess();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/admin/subscriptions/sponsorshipcampaign/${campaignId}/upload-emails/`, {
      method: "POST",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: form,
    });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, extractDetail(body) || `Request failed (${res.status})`, undefined, body);
    return body;
  },
};

// ── Company endpoints ─────────────────────────────────────────────────────────

export const companies = {
  list: (kind?: "company" | "skill") =>
    request<Company[]>(`/api/companies/${kind ? `?kind=${kind}` : ""}`),
  detail: (id: number) => request<CompanyDetail>(`/api/companies/${id}/`),
};

// Skills are Company rows with kind="skill" — same detail/roles/rounds shape.
export const skills = {
  list: () => request<Company[]>("/api/companies/?kind=skill"),
  detail: (id: number) => request<CompanyDetail>(`/api/companies/${id}/`),
};

// ── Progress dashboard types ────────────────────────────────────────────────────

export interface ProgressHistoryEntryFree {
  date: string;
  company: string;
  overall: number | null;
}

export interface ProgressHistoryEntryDetailed {
  id: number;
  date: string;
  company: string;
  role: string;
  round: string;
  scores: InterviewSession["scores"];
  time_expired: boolean;
}

export interface ProgressTopic {
  name: string;
  average: number;
  attempts: number;
  trend: number[];
}

export interface ProgressCompany {
  company: string;
  average: number;
  attempts: number;
  ready: boolean;
}

export interface ProgressResponseFree {
  locked: true;
  total_completed: number;
  overall_trend: number[];
  momentum: number | null;
  consistency: "high" | "medium" | "low" | null;
  history: ProgressHistoryEntryFree[];
}

export interface ProgressResponseDetailed {
  locked: false;
  total_completed: number;
  overall_trend: number[];
  momentum: number | null;
  consistency: "high" | "medium" | "low" | null;
  dimension_trends: {
    communication: (number | null)[];
    technical: (number | null)[];
    problem_solving: (number | null)[];
    overall: (number | null)[];
  };
  history: ProgressHistoryEntryDetailed[];
  topics: ProgressTopic[];
  companies: ProgressCompany[];
}

export type ProgressResponse = ProgressResponseFree | ProgressResponseDetailed;

// ── Interview endpoints ───────────────────────────────────────────────────────

export const interviews = {
  list: () => request<InterviewSession[]>("/api/interviews/"),
  detail: (id: number) => request<InterviewSession>(`/api/interviews/${id}/`),

  start: (round_id: number) =>
    request<StartInterviewResponse>("/api/interviews/start/", {
      method: "POST",
      body: JSON.stringify({ round_id }),
    }),

  chat: (session_id: number, message: string, workspace?: WorkspacePayload) =>
    request<{ ai_message: string; open_workspace: { type: "coding" | "system_design"; language?: string } | null }>(
      `/api/interviews/${session_id}/chat/`,
      {
        method: "POST",
        body: JSON.stringify({ message, workspace }),
      }
    ),

  end: (session_id: number) =>
    request<InterviewSession>(`/api/interviews/${session_id}/end/`, {
      method: "POST",
    }),

  // Enterprise-only: reports a flagged proctoring moment (and optionally a
  // short clip) for an org-invite session. The backend 404s this for any
  // non-org-linked session, so it's a no-op to call for a consumer session.
  // Bypasses the shared request() wrapper for the same reason as
  // organizations.uploadQuestions — a multipart body needs its own
  // browser-set Content-Type boundary.
  reportProctoringEvent: async (
    session_id: number,
    event_type: ProctoringEventType,
    opts?: { confidence?: number; note?: string; clip?: Blob }
  ): Promise<void> => {
    const access = tokens.getAccess();
    const form = new FormData();
    form.append("event_type", event_type);
    if (opts?.confidence !== undefined) form.append("confidence", String(opts.confidence));
    if (opts?.note) form.append("note", opts.note);
    if (opts?.clip) form.append("clip", opts.clip, "clip.webm");
    const res = await fetch(`${API_URL}/api/enterprise/sessions/${session_id}/proctoring-events/`, {
      method: "POST",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: form,
    });
    if (!res.ok) {
      // Best-effort telemetry — never let a failed proctoring report
      // interrupt or fail the candidate's actual interview.
      return;
    }
  },

  progress: () => request<ProgressResponse>("/api/interviews/progress/"),

  realReports: () => request<RealInterviewReport[]>("/api/interviews/real-reports/"),

  submitRealReport: (payload: RealInterviewReportPayload) =>
    request<RealInterviewReport>("/api/interviews/real-reports/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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

export interface CreateTopupOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  pack: string;
  credits: number;
  key_id: string;
  user_email: string;
  user_name: string;
}

export interface VerifyTopupPaymentResponse {
  detail: string;
  credits_added: number;
  bonus_interviews: number;
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

  createTopupOrder: (pack: "spark" | "boost" | "power") =>
    request<CreateTopupOrderResponse>("/api/subscriptions/topup/create-order/", {
      method: "POST",
      body: JSON.stringify({ pack }),
    }),

  verifyTopupPayment: (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) =>
    request<VerifyTopupPaymentResponse>("/api/subscriptions/topup/verify-payment/", {
      method: "POST",
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    }),
};

// ── Enterprise (org dashboard) endpoints ────────────────────────────────────

export interface OrgQuestion {
  id: number;
  question_text: string;
  question_type: string;
  ideal_answer: string;
  starter_code: string;
  language: string;
}

export interface OrgRound {
  id: number;
  title: string;
  order: number;
  round_type: string;
  questions: OrgQuestion[];
}

export interface OrgRole {
  id: number;
  title: string;
  rounds: OrgRound[];
}

export interface Organization {
  id: number;
  name: string;
  candidate_quota: number;
  candidates_used: number;
  contract_ends: string;
  is_active: boolean;
  // Superuser-only opt-in (set via Django admin) — lets this org's members
  // watch a candidate's live camera feed while their interview is live.
  live_camera_enabled: boolean;
}

export interface OrgInviteWeek {
  week_start: string;
  count: number;
}

export interface OrgActivityItem {
  text: string;
  when: string;
  live: boolean;
}

export interface OrgDashboard {
  organization: Organization;
  role: "admin" | "recruiter";
  question_bank: OrgRole[];
  invite_counts: Record<string, number>;
  invite_series: OrgInviteWeek[];
  recent_activity: OrgActivityItem[];
}

export interface OrgQuestionUploadResult {
  rows_seen: number;
  rows_skipped: number;
  skipped_examples: string[];
  roles_created: number;
  rounds_created: number;
  questions_created: number;
  questions_skipped_duplicate: number;
}

export interface OrgCandidateInvite {
  id: number;
  candidate_email: string;
  round: number;
  round_title: string;
  role_title: string;
  token: string;
  status: "pending" | "started" | "completed" | "expired";
  // Pending/Live/Finished/Expired — derived from the linked session's own
  // status rather than `status` above (see OrgCandidateInviteSerializer).
  candidate_status: "pending" | "live" | "finished" | "expired";
  scores: Record<string, number> | null;
  feedback: string | null;
  insights: InterviewInsights | null;
  session: number | null;
  created_at: string;
  expires_at: string;
}

export const organizations = {
  dashboard: () => request<OrgDashboard>("/api/enterprise/dashboard/"),

  // Bypasses the shared request() wrapper: it always sets
  // Content-Type: application/json, which breaks a multipart file upload
  // (the browser needs to set its own boundary on the Content-Type header).
  uploadQuestions: async (file: File): Promise<OrgQuestionUploadResult> => {
    const access = tokens.getAccess();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/enterprise/question-bank/upload/`, {
      method: "POST",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: form,
    });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      throw new ApiError(res.status, extractDetail(body) || `Request failed (${res.status})`, undefined, body);
    }
    return body;
  },

  invites: {
    list: () => request<OrgCandidateInvite[]>("/api/enterprise/invites/"),

    create: (round: number, candidate_email: string, expires_at: string) =>
      request<OrgCandidateInvite>("/api/enterprise/invites/", {
        method: "POST",
        body: JSON.stringify({ round, candidate_email, expires_at }),
      }),

    start: (token: string) =>
      request<StartInterviewResponse>(`/api/enterprise/invites/${token}/start/`, {
        method: "POST",
      }),
  },
};

// ── Review endpoints ────────────────────────────────────────────────────────

export interface ReviewPayload {
  rating: number;
  comment?: string;
  session?: number;
}

export interface Review {
  id: number;
  session: number | null;
  rating: number;
  comment: string;
  plan_at_time: string;
  created_at: string;
}

export const reviews = {
  promptStatus: () =>
    request<{ show: boolean; completed_count: number }>("/api/reviews/prompt-status/"),

  submit: (payload: ReviewPayload) =>
    request<Review>("/api/reviews/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { API_URL };