const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("aurelis.session.v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) return parsed.token;
    }
  } catch {
    // fallback
  }
  return localStorage.getItem("aurelis_token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("aurelis.session.v1");
      localStorage.removeItem("aurelis_token");
      window.location.href = "/";
    }
    throw new Error("Session expired");
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface LiveSystemHealth {
  postgres_connected: boolean;
  gmail_watch_active: boolean;
  gmail_watch_expiration?: string | null;
  ai_openrouter?: string;
  ai_nim?: string;
  ai_groq?: string;
  ai_cerebras?: string;
  ai_provider_distribution?: Record<string, number>;
  last_sheets_sync_at?: string | null;
  last_sheets_sync_ok?: boolean | null;
  recent_cron_runs?: Array<{ id: string; status: string; date: string }>;
  http_metrics?: { total_requests?: number; avg_latency_ms?: number };
}

export interface LiveAuditLog {
  id: string;
  created_at: string;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, any>;
}

export interface LiveStaffUser {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
  doctor_id?: string | null;
  created_at?: string;
}

export interface LiveDoctor {
  id: string;
  email: string;
  full_name: string;
  specialty?: string | null;
  bio?: string | null;
  price_per_visit?: number | null;
}

export async function fetchLiveSystemHealth(): Promise<LiveSystemHealth | null> {
  try {
    return await apiFetch<LiveSystemHealth>("/api/admin/system-health");
  } catch (err) {
    console.warn("fetchLiveSystemHealth failed, fallback to local status", err);
    return null;
  }
}

export async function fetchLiveAuditLogs(): Promise<LiveAuditLog[] | null> {
  try {
    const res = await apiFetch<{ items: LiveAuditLog[] }>("/api/audit-log?page=1&page_size=50");
    return res.items || [];
  } catch (err) {
    console.warn("fetchLiveAuditLogs failed", err);
    return null;
  }
}

export async function fetchLiveStaffUsers(): Promise<LiveStaffUser[] | null> {
  try {
    return await apiFetch<LiveStaffUser[]>("/api/admin/staff-users");
  } catch (err) {
    console.warn("fetchLiveStaffUsers failed", err);
    return null;
  }
}

export async function createLiveStaffUser(payload: {
  email: string;
  full_name: string;
  role: string;
  password?: string;
}): Promise<LiveStaffUser> {
  return await apiFetch<LiveStaffUser>("/api/admin/staff-users", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      password: payload.password || "TempPass123!@",
    }),
  });
}

export async function deleteLiveStaffUser(userId: string): Promise<void> {
  await apiFetch(`/api/admin/staff-users/${userId}`, { method: "DELETE" });
}

export async function fetchLiveDoctors(): Promise<LiveDoctor[] | null> {
  try {
    return await apiFetch<LiveDoctor[]>("/api/admin/doctors");
  } catch (err) {
    console.warn("fetchLiveDoctors failed", err);
    return null;
  }
}

export async function createLiveDoctor(payload: {
  email: string;
  full_name: string;
  specialty?: string;
  price_per_visit?: number;
}): Promise<LiveDoctor> {
  return await apiFetch<LiveDoctor>("/api/admin/doctors", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      full_name: payload.full_name,
      specialty: payload.specialty || "General Medicine",
      price_per_visit: payload.price_per_visit || 240,
    }),
  });
}

export async function downloadLiveAuditCsv(): Promise<boolean> {
  const token = getAuthToken();
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/export/audit.csv`, { headers });
    if (!res.ok) throw new Error("CSV download request failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurelis-audit-trail-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.warn("Server audit CSV failed, using fallback CSV generator", err);
    return false;
  }
}
