export interface User {
  id: number; name: string; email: string; unit_kerja: string; is_admin: boolean;
}
export interface Token {
  id: number; user_id: number; email: string; name: string; scope: string;
  daily_limit: number; expires_at: string | null; revoked_at: string | null;
  last_used_at: string | null;
}
export interface DocumentRow {
  id: number; filename: string; file_type: string; file_extension: string;
  status: string; error_message: string | null; chunk_count: number;
  created_at: string; updated_at: string;
}
export interface Citation {
  document_id: number; filename: string; file_type: string;
  page_or_slide: number | null; section_title: string | null;
}
export interface AskResult { answer: string; citations: Citation[]; }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> =
    init?.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const res = await fetch(path, { credentials: "same-origin", ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    req<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => req<{ user: User }>("/api/auth/me"),
  ask: (question: string) =>
    req<AskResult>("/api/ask", { method: "POST", body: JSON.stringify({ question }) }),
  users: () => req<User[]>("/api/admin/users"),
  createUser: (u: { name: string; email: string; unit_kerja: string; password: string; is_admin: boolean }) =>
    req<User>("/api/admin/users", { method: "POST", body: JSON.stringify(u) }),
  tokens: () => req<Token[]>("/api/admin/tokens"),
  createToken: (userId: number, opts: { name?: string; scope?: string; daily_limit?: number }) =>
    req<{ token: string; note: string }>(`/api/admin/users/${userId}/tokens`, { method: "POST", body: JSON.stringify(opts) }),
  revokeToken: (id: number) => req<{ ok: boolean }>(`/api/admin/tokens/${id}/revoke`, { method: "POST" }),
  usageLogs: () => req<any[]>("/api/admin/usage-logs"),
  documents: () => req<DocumentRow[]>("/api/admin/documents"),
  uploadDocument: (file: File, fileType?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (fileType) fd.append("file_type", fileType);
    return req<DocumentRow>("/api/admin/documents", { method: "POST", body: fd });
  },
};
