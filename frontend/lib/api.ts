/**
 * MedDRAG API Client
 * Connects Next.js frontend with FastAPI backend
 * Full HTTP-only cookie credentials support and RBAC isolation
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor";
  created_at: string;
}

export interface PatientProfile {
  user_id: string;
  name: string;
  email: string;
  age?: number | null;
  sex?: string | null;
  allergies: string[];
  conditions: string[];
  notes?: string | null;
}

export interface PatientListItem {
  id: string;
  name: string;
  email: string;
  age?: number | null;
  sex?: string | null;
  allergies: string[];
  conditions: string[];
  analysis_count: number;
}

export interface PatientDetail extends PatientListItem {
  notes?: string | null;
  analyses: AnalysisListItem[];
}

export interface ExtractedMedicine {
  id: string;
  analysis_id: string;
  original_name: string;
  normalized_name?: string | null;
  rxcui?: string | null;
  concept_type?: string | null;
  strength?: string | null;
  dosage?: string | null;
  route?: string | null;
  frequency?: string | null;
  frequency_meaning?: string | null;
  duration?: string | null;
  timing_instructions?: string | null;
  food_instructions?: string | null;
  extraction_confidence: number;
  verification_status: "verified_match" | "possible_match" | "no_verified_match" | "unclear_handwriting" | "unsupported_regional_brand";
  uncertainty_flags: string[];
  alternatives_json: Array<{ rxcui: string; name: string; score: number; term_type?: string }>;
  reviewer_corrected: boolean;
  reviewer_notes?: string | null;
  bounding_box?: number[] | null;
}

export interface Evidence {
  id: string;
  analysis_id: string;
  medicine_id?: string | null;
  medicine_name: string;
  food_or_substance: string;
  evidence_category: "avoid_contraindicated" | "limit_caution" | "timing_instruction" | "no_relevant_warning" | "unavailable_insufficient";
  source_provider: string;
  source_document_title: string;
  source_section?: string | null;
  official_source_url: string;
  evidence_excerpt: string;
  plain_language_summary: string;
  retrieval_score: number;
  retrieval_timestamp: string;
}

export interface Review {
  id: string;
  analysis_id: string;
  reviewer_name: string;
  reviewer_role: string;
  decision: "approved" | "rejected" | "in_review";
  review_notes?: string | null;
  corrections_made_json?: Record<string, any>;
  review_duration_seconds: number;
  decided_at: string;
}

export interface AuditEvent {
  id: string;
  analysis_id: string;
  user_id?: string | null;
  event_type: string;
  actor: string;
  timestamp: string;
  details_json: Record<string, any>;
}

export interface Analysis {
  id: string;
  patient_id?: string | null;
  original_filename: string;
  stored_filepath: string;
  file_checksum: string;
  created_at: string;
  stage: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  error_message?: string | null;
  failed_stage?: string | null;
  is_demo: boolean;
  demo_scenario_id?: string | null;
  patient_name_detected?: string | null;
  prescriber_name_detected?: string | null;
  prescription_date_detected?: string | null;
  total_processing_duration_sec: number;
  image_quality_score: number;
  image_quality_feedback?: string | null;
  raw_ocr_baseline?: string | null;
  raw_ai_text?: string | null;
  review_status: "unreviewed" | "pending_review" | "approved" | "rejected";
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  medicines: ExtractedMedicine[];
  evidences: Evidence[];
  reviews: Review[];
  audit_events: AuditEvent[];
}

export interface AnalysisListItem {
  id: string;
  patient_id?: string | null;
  patient_name?: string | null;
  original_filename: string;
  created_at: string;
  stage: string;
  status: string;
  is_demo: boolean;
  review_status: string;
  medicine_count: number;
  total_processing_duration_sec: number;
}

export interface DashboardMetrics {
  total_analyses: number;
  pending_doctor_reviews: number;
  approved_reports: number;
  rejected_reports: number;
  failed_analyses: number;
  average_processing_time_sec: number;
  average_review_time_sec: number;
  recent_analyses: AnalysisListItem[];
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unavailable";
  latency_ms?: number | null;
  details?: string | null;
}

export interface DependencyHealth {
  app_version: string;
  app_mode: string;
  database: ServiceHealth;
  gemini_vision: ServiceHealth;
  rxnorm_api: ServiceHealth;
  dailymed_api: ServiceHealth;
  openfda_api: ServiceHealth;
  qdrant_vector_store: ServiceHealth;
}

export interface PatientScheduleItem {
  medicine_name: string;
  strength: string;
  dosage: string;
  route: string;
  timing_schedule: string;
  food_instruction: string;
  caution_notes?: string | null;
}

export interface PatientFoodWarningItem {
  medicine_name: string;
  food_or_substance: string;
  warning_level: "AVOID" | "LIMIT" | "TIMING" | "SAFE" | "UNKNOWN";
  advice: string;
  source_title: string;
  official_source_url: string;
}

export interface PatientSummary {
  analysis_id: string;
  patient_name: string;
  prescriber_name: string;
  prescription_date?: string | null;
  approval_date: string;
  approved_by: string;
  reviewer_role: string;
  medicines_schedule: PatientScheduleItem[];
  dietary_warnings: PatientFoodWarningItem[];
  disclaimer: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  patient_name: string;
  prescriber_name: string;
  prescription_date: string;
  filename: string;
  medicine_count: number;
  evidence_count: number;
}

export interface StageItem {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  duration_ms: number;
}

export interface StageProgressEvent {
  analysis_id: string;
  stage: string;
  stage_index: number;
  status: "pending" | "running" | "done" | "failed";
  elapsed_ms: number;
  stages: StageItem[];
  error_message?: string | null;
  failed_stage?: string | null;
}

// -------------------------------------------------------------
// Base Fetch Wrapper with Credentials (httpOnly Cookies)
// -------------------------------------------------------------

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include", // Essential for httpOnly authentication cookie
    headers: {
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) errorDetail = errorJson.detail;
    } catch {
      // ignore
    }

    if (res.status === 401 && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (
        currentPath !== "/login" &&
        !endpoint.includes("/auth/login") &&
        !endpoint.includes("/auth/register")
      ) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    const err = new Error(errorDetail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export const api = {
  // Authentication
  login: (data: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

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
  }) =>
    request<{ user: User; token: string; message: string }>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
    }),

  getMe: () => request<User>("/auth/me"),

  // Patient Profile
  getPatientProfile: () => request<PatientProfile>("/patients/me"),
  updatePatientProfile: (data: { age?: number | null; sex?: string | null; allergies?: string[]; conditions?: string[]; notes?: string | null }) =>
    request<PatientProfile>("/patients/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getPatients: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<PatientListItem[]>(`/patients${q}`);
  },

  getPatient: (id: string) => request<PatientDetail>(`/patients/${id}`),

  // Health
  getHealth: () => request<{ status: string; app_name: string; version: string; mode: string }>("/health"),
  getDependencies: () => request<DependencyHealth>("/health/dependencies"),

  // Dashboard Metrics
  getMetrics: () => request<DashboardMetrics>("/metrics/summary"),

  // Analyses
  getAnalyses: (params?: { status?: string; review_status?: string; is_demo?: boolean; search?: string; skip?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append("status", params.status);
    if (params?.review_status) q.append("review_status", params.review_status);
    if (params?.is_demo !== undefined) q.append("is_demo", String(params.is_demo));
    if (params?.search) q.append("search", params.search);
    if (params?.skip) q.append("skip", String(params.skip));
    if (params?.limit) q.append("limit", String(params.limit));
    return request<AnalysisListItem[]>(`/analyses?${q.toString()}`);
  },

  getAnalysis: (id: string) => request<Analysis>(`/analyses/${id}`),

  createAnalysis: (formData: FormData) =>
    request<Analysis>("/analyses", {
      method: "POST",
      body: formData,
    }),

  triggerProcess: (id: string) =>
    request<Analysis>(`/analyses/${id}/process`, {
      method: "POST",
    }),

  getAnalysisStatus: (id: string) =>
    request<{
      id: string;
      stage: string;
      status: string;
      error_message?: string;
      failed_stage?: string;
      review_status: string;
      total_processing_duration_sec: number;
      stages_completed: string[];
    }>(`/analyses/${id}/status`),

  getEventsUrl: (id: string) => `${API_BASE}/analyses/${id}/events`,

  retryAnalysis: (id: string) =>
    request<Analysis>(`/analyses/${id}/retry`, {
      method: "POST",
    }),

  getPrescriptionImageUrl: (id: string) => `${API_BASE}/analyses/${id}/image`,

  // Medicines
  updateMedicine: (analysisId: string, medicineId: string, data: Partial<ExtractedMedicine>) =>
    request<ExtractedMedicine>(`/analyses/${analysisId}/medicines/${medicineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  reverifyMedicines: (analysisId: string) =>
    request<ExtractedMedicine[]>(`/analyses/${analysisId}/verify-medicines`, {
      method: "POST",
    }),

  // Evidence
  getEvidence: (analysisId: string) => request<Evidence[]>(`/analyses/${analysisId}/evidence`),

  searchEvidenceLibrary: (query?: string, category?: string) => {
    const q = new URLSearchParams();
    if (query) q.append("q", query);
    if (category) q.append("category", category);
    return request<Evidence[]>(`/evidence/search?${q.toString()}`);
  },

  // Review & Approval (Doctor Only)
  saveReviewDraft: (analysisId: string, data: { reviewer_name: string; reviewer_role?: string; review_notes?: string; review_duration_seconds?: number }) =>
    request<Review>(`/analyses/${analysisId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  approveAnalysis: (analysisId: string, data: { reviewer_name: string; reviewer_role?: string; review_notes?: string; confirmed_no_unresolved_critical_fields?: boolean; review_duration_seconds?: number }) =>
    request<Review>(`/analyses/${analysisId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  rejectAnalysis: (analysisId: string, data: { reviewer_name: string; reviewer_role?: string; rejection_reason: string; review_duration_seconds?: number }) =>
    request<Review>(`/analyses/${analysisId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // Patient Summary (Only accessible when approved)
  getPatientSummary: (analysisId: string) => request<PatientSummary>(`/analyses/${analysisId}/patient-summary`),
  getTranslatedSummary: (analysisId: string, lang = "hi") =>
    request<PatientSummary>(`/analyses/${analysisId}/patient-summary/translate?lang=${lang}`),

  // API Key Management (Doctor Only)
  updateApiKey: (apiKey: string) =>
    request<{ status: string; message: string; has_key: boolean }>("/settings/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    }),

  getKeyStatus: () => request<{ has_key: boolean; model: string }>("/settings/key/status"),

  updateFdaApiKey: (apiKey: string) =>
    request<{ status: string; message: string; has_key: boolean }>("/settings/fda-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    }),

  getFdaKeyStatus: () => request<{ has_key: boolean; rate_limit: string }>("/settings/fda-key/status"),

  // Developer Settings (Available to all authenticated/prototype users)
  updateDeveloperApiKey: (apiKey: string, validate = false) =>
    request<{ status: string; message: string; has_key: boolean; is_valid: boolean; model: string }>("/developer/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, validate_key: validate }),
    }),

  validateDeveloperApiKey: (apiKey: string) =>
    request<{ is_valid: boolean; message: string; model: string }>("/developer/key/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    }),

  updateDeveloperFdaApiKey: (apiKey: string) =>
    request<{ status: string; message: string; has_key: boolean; rate_limit: string }>("/developer/fda-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    }),

  getDeveloperStatus: () =>
    request<{
      has_gemini_key: boolean;
      gemini_masked_key: string;
      gemini_model: string;
      has_fda_key: boolean;
      fda_rate_limit: string;
      app_mode: string;
      database: string;
    }>("/developer/status"),

  getDeveloperUsers: () =>
    request<Array<{ id: string; name: string; email: string; role: string; created_at: string | null }>>(
      "/developer/users"
    ),

  // Demo Controls
  getDemoScenarios: () => request<DemoScenario[]>("/demo/scenarios"),
  resetDemoData: () =>
    request<{ status: string; message: string; records_cleared: number }>("/demo/reset", {
      method: "POST",
    }),
};
