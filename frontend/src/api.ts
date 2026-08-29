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
export interface ContentItem {
  id: number;
  type: "news" | "publication";
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  author: string;
  date: string;
  content: string[];
  document_url: string;
  document_name: string;
  gallery: string[];
  is_published: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}
export interface Conversation {
  id: number;
  title: string;
  updated_at: string;
  message_count: number;
}
export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}
export interface ChatEvent {
  event: "meta" | "delta" | "citations" | "done" | "error";
  data: any;
}

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
  updateUser: (id: number, u: { name: string; email: string; unit_kerja: string; password?: string; is_admin: boolean }) =>
    req<User>(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(u) }),
  deleteUser: (id: number) => req<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
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
  retryDocument: (id: number) =>
    req<{ id: number; filename: string; status: string }>(`/api/admin/documents/${id}/retry`, { method: "POST" }),
  content: () => req<ContentItem[]>("/api/content"),
  contentBySlug: (slug: string) => req<ContentItem>(`/api/content/${slug}`),
  adminContent: () => req<ContentItem[]>("/api/admin/content"),
  createContent: (c: Partial<ContentItem>) =>
    req<ContentItem>("/api/admin/content", { method: "POST", body: JSON.stringify(c) }),
  updateContent: (id: number, c: Partial<ContentItem>) =>
    req<ContentItem>(`/api/admin/content/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  deleteContent: (id: number) =>
    req<{ ok: boolean }>(`/api/admin/content/${id}`, { method: "DELETE" }),
  conversations: () => req<Conversation[]>("/api/conversations"),
  createConversation: () =>
    req<{ id: number }>("/api/conversations", { method: "POST", body: JSON.stringify({}) }),
  deleteConversation: (id: number) =>
    req<{ ok: boolean }>(`/api/conversations/${id}`, { method: "DELETE" }),
  conversationMessages: (id: number) =>
    req<ChatMessage[]>(`/api/conversations/${id}/messages`),
  chat: async (question: string, conversationId: number | null, onEvent: (e: ChatEvent) => void) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, conversation_id: conversationId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error ?? `HTTP ${res.status}`);
    }
    if (!res.body) throw new Error("streaming tidak didukung");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (data) {
          try {
            onEvent({ event: event as ChatEvent["event"], data: JSON.parse(data) });
          } catch {
            /* abaikan data rusak */
          }
        }
      }
    }
  },
};
