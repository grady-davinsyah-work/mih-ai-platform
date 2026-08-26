# Playground Chat Berriwayat (ala Claude) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah Playground jadi chat multi-turn dengan streaming SSE dan riwayat percakapan per-user.

**Architecture:** Dua tabel baru (`conversations`, `messages`) + route `chat.ts` (CRUD percakapan + `POST /api/chat` SSE streaming). Service RAG di-refactor: ekstrak pencarian vektor jadi helper `search()`, tambah `askStream()` dan `streamAnswer()` (openai SDK `stream: true`). Frontend Playground dirombak jadi layout sidebar kiri + thread chat, pakai `fetch` + `ReadableStream` (EventSource tak bisa POST).

**Tech Stack:** Bun + Express 5 + PostgreSQL (pg), openai SDK v4, Vite + React 19, supertest + bun test, mock LLM (`LLM_PROVIDER=mock`).

**Spec:** `docs/superpowers/specs/2026-08-27-drive-sync-and-chat-history-design.md` (bagian B)

## Global Constraints

- Bahasa: kode/komentar mengikuti gaya repo (backend TS + frontend TSX + komentar singkat berbahasa Indonesia).
- LLM mock: `LLM_PROVIDER=mock` harus menghasilkan teks yang mengandung `[1]` agar ekstraksi citation berfungsi di tes.
- `req.auth` berisi `{ tokenId, userId, scope }`; `req.session` = `{ userId, isAdmin }` (lihat `backend/src/types.ts`).
- Route autentikasi: `requireLogin` untuk CRUD percakapan (session), `askAuth` untuk `/api/chat` (token ATAU session).
- `applySchema()` (helpers) menjalankan `db/init.sql` ke `mih_test`; `truncateAll()` harus menyertakan tabel baru.
- Frontend tidak punya test runner — gate-nya `npm run build` (tsc + vite).
- Sebelum tes backend: pastikan DB test hidup (`postgres://mih:mih@localhost:5432/mih_test`).

---

### Task 1: Streaming di service RAG

**Files:**
- Modify: `backend/src/services/llm.ts` (tambah `streamAnswer`)
- Modify: `backend/src/services/rag.ts` (refactor `search()`, tambah `askStream`)
- Test: `backend/tests/stream.test.ts` (baru)

**Interfaces:**
- Produces:
  - `streamAnswer(question: string, context: string): AsyncGenerator<string>` — yield potongan teks; di `llm.ts`.
  - `search(question: string): Promise<{ labeled: SearchRow[]; context: string }>` — di `rag.ts`. `SearchRow = { document_id, filename, file_type, page_or_slide, section_title, label }`.
  - `askStream(question: string): AsyncGenerator<{ delta: string } | { citations: Citation[] }>` — di `rag.ts`. `Citation` sudah ada di `rag.ts`.
  - `ask()` lama tetap ekspor dan berperilaku sama.

- [ ] **Step 1: Tulis test yang gagal** — `backend/tests/stream.test.ts`

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";
import { askStream } from "../src/services/rag";

const zero = JSON.stringify(Array.from({ length: 1536 }, () => 0));

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  await testDb.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ('paparan-uji.pptx','paparan','pptx','hash1','/data/uploaded/x.pptx','completed') RETURNING id`
  );
  await testDb.query(
    `INSERT INTO chunks (document_id, content, embedding, page_or_slide, section_title, chunk_index)
     VALUES ((SELECT id FROM documents LIMIT 1), 'Kedeputian merencanakan pembangunan makro.', $1::vector, 4, 'Pendahuluan', 0)`,
    [zero]
  );
});

afterAll(async () => {
  await truncateAll();
});

test("askStream memancarkan delta lalu citations", async () => {
  const events: Array<{ delta?: string; citations?: any[] }> = [];
  for await (const evt of askStream("Apa rencana pembangunan makro?")) {
    if ("delta" in evt) events.push({ delta: evt.delta });
    else events.push({ citations: evt.citations });
  }
  const deltas = events.filter((e) => e.delta !== undefined);
  const citationEvents = events.filter((e) => e.citations !== undefined);
  expect(deltas.length).toBeGreaterThan(0);
  const full = deltas.map((d) => d.delta!).join("");
  expect(full).toContain("Jawaban (mock)");
  expect(citationEvents.length).toBe(1);
  expect(citationEvents[0].citations!.length).toBeGreaterThan(0);
  expect(citationEvents[0].citations![0].filename).toBe("paparan-uji.pptx");
  expect(citationEvents[0].citations![0].page_or_slide).toBe(4);
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd backend && bun test tests/stream.test.ts`
Expected: FAIL — `askStream` tidak ada (TypeError/undef).

- [ ] **Step 3: Implementasi minimal** — `backend/src/services/llm.ts` tambah setelah `generateAnswer`:

```ts
export async function* streamAnswer(question: string, context: string): AsyncGenerator<string> {
  if (config.llmProvider === "mock") {
    yield `Jawaban (mock) berdasarkan [1]: ${question}`;
    return;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const stream = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
    stream: true,
  });
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
```

`backend/src/services/rag.ts` — refactor: ekstrak blok embed+query jadi `search()`, pakai di `ask()` dan `askStream()`:

```ts
export async function search(question: string) {
  const [qv] = await embedTexts([question]);
  const { rows } = await pool.query(
    `SELECT c.id, c.content, c.page_or_slide, c.section_title,
            d.id AS document_id, d.filename, d.file_type
       FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.is_outdated = FALSE AND d.status = 'completed'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [JSON.stringify(qv), config.vectorK]
  );
  const labeled = rows.map((r, i) => ({ ...r, label: i + 1 }));
  const context = labeled
    .map((r) =>
      `[${r.label}] (File: ${r.filename}, ${r.file_type}` +
      (r.page_or_slide != null ? `, halaman/slide ${r.page_or_slide}` : "") +
      (r.section_title ? `, Bagian: ${r.section_title}` : "") + `)\n${r.content}`
    )
    .join("\n\n---\n\n");
  return { labeled, context };
}

export async function ask(question: string): Promise<{ answer: string; citations: Citation[] }> {
  const { labeled, context } = await search(question);
  const answer = await generateAnswer(question, context);
  const cited = extractCitedIndices(answer);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  return { answer, citations };
}

export async function* askStream(question: string): AsyncGenerator<{ delta: string } | { citations: Citation[] }> {
  const { labeled, context } = await search(question);
  let text = "";
  for await (const delta of streamAnswer(question, context)) {
    text += delta;
    yield { delta };
  }
  const cited = extractCitedIndices(text);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  yield { citations };
}
```

Impor `streamAnswer` di `rag.ts` (baris impor dari `./llm`).

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd backend && bun test tests/stream.test.ts`
Expected: PASS (mock menghasilkan `[1]` → 1 citation).

- [ ] **Step 5: Regression test** — pastikan ask lama tetap jalan

Run: `cd backend && bun test`
Expected: semua PASS (termasuk `integration.ask.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/llm.ts backend/src/services/rag.ts backend/tests/stream.test.ts
git commit -m "feat(rag): streaming jawaban via askStream + refactor search()"
```

---

### Task 2: Schema DB + Route chat (CRUD + SSE)

**Files:**
- Modify: `db/init.sql` (tambah `conversations`, `messages`)
- Modify: `backend/tests/helpers.ts` (tambah tabel baru ke `truncateAll`)
- Create: `backend/src/routes/chat.ts`
- Modify: `backend/src/app.ts` (mount `chatRoutes`)
- Test: `backend/tests/integration.chat.test.ts` (baru)

**Interfaces:**
- Consumes: `askStream` dari Task 1; `req.auth`, `requireLogin`, `askAuth`.
- Produces:
  - `GET /api/conversations` → `Array<{ id, title, updated_at, message_count }>` (requireLogin)
  - `POST /api/conversations` → `{ id }` (requireLogin)
  - `DELETE /api/conversations/:id` → `{ ok: true }` (requireLogin, pemilik; 404 kalau bukan miliknya)
  - `GET /api/conversations/:id/messages` → `Array<{ id, role, content, citations, created_at }>` (requireLogin, pemilik)
  - `POST /api/chat` (askAuth) → SSE stream

- [ ] **Step 1: Tulis test yang gagal** — `backend/tests/integration.chat.test.ts`

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();
let cookie = "";
let userId = 0;

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  const user = await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Uji','u@t.c','Uji',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  userId = user.rows[0].id;
  const login = await request(app).post("/api/auth/login").send({ email: "u@t.c", password: "x" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

afterAll(async () => {
  await truncateAll();
});

test("POST /api/conversations membuat percakapan kosong", async () => {
  const res = await request(app).post("/api/conversations").set("Cookie", cookie);
  expect(res.status).toBe(201);
  expect(res.body.id).toBeGreaterThan(0);
});

test("GET /api/conversations hanya menampilkan milik user", async () => {
  const a = await request(app).post("/api/conversations").set("Cookie", cookie);
  const other = await testDb.query(
    "INSERT INTO conversations (user_id, title) VALUES ($1, 'rahasia')",
    [99999]
  );
  const res = await request(app).get("/api/conversations").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
  expect(res.body[0].id).toBe(a.body.id);
});

test("GET/POST /api/conversations butuh login", async () => {
  expect((await request(app).get("/api/conversations")).status).toBe(401);
  expect((await request(app).post("/api/conversations")).status).toBe(401);
});

test("DELETE /api/conversations/:id milik user lain -> 404", async () => {
  const other = await testDb.query(
    "INSERT INTO conversations (user_id, title) VALUES ($1, 'lain') RETURNING id",
    [99999]
  );
  const res = await request(app).delete(`/api/conversations/${other.rows[0].id}`).set("Cookie", cookie);
  expect(res.status).toBe(404);
});

test("GET /api/conversations/:id/messages mengembalikan riwayat", async () => {
  const created = await request(app).post("/api/conversations").set("Cookie", cookie);
  const convId = created.body.id;
  await testDb.query(
    "INSERT INTO messages (conversation_id, role, content, citations) VALUES ($1,'user','pertanyaan','[]')",
    [convId]
  );
  const res = await request(app).get(`/api/conversations/${convId}/messages`).set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
  expect(res.body[0].role).toBe("user");
  expect(res.body[0].content).toBe("pertanyaan");
});

test("POST /api/chat streaming (session): delta + citations + pesan tersimpan", async () => {
  const created = await request(app).post("/api/conversations").set("Cookie", cookie);
  const convId = created.body.id;
  const res = await request(app)
    .post("/api/chat")
    .set("Cookie", cookie)
    .send({ question: "Apa rencana pembangunan makro?", conversation_id: convId });
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toContain("text/event-stream");
  expect(res.text).toContain("event: meta");
  expect(res.text).toContain("event: delta");
  expect(res.text).toContain("event: citations");
  expect(res.text).toContain("event: done");
  const msgs = await testDb.query(
    "SELECT role, content FROM messages WHERE conversation_id=$1 ORDER BY id",
    [convId]
  );
  expect(msgs.rows.map((r) => r.role)).toEqual(["user", "assistant"]);
  expect(msgs.rows[1].content).toContain("Jawaban (mock)");
});

test("POST /api/chat tanpa conversation_id membuat percakapan baru berjudul", async () => {
  const res = await request(app)
    .post("/api/chat")
    .set("Cookie", cookie)
    .send({ question: "Pertanyaan panjang sekali untuk judul percakapan yang dihasilkan" });
  expect(res.status).toBe(200);
  const conv = await testDb.query(
    "SELECT title FROM conversations WHERE id=(SELECT conversation_id FROM messages WHERE role='user' ORDER BY id DESC LIMIT 1)"
  );
  expect(conv.rows[0].title.length).toBeGreaterThan(0);
});

test("POST /api/chat tanpa auth -> 401", async () => {
  const res = await request(app).post("/api/chat").send({ question: "x" });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd backend && bun test tests/integration.chat.test.ts`
Expected: FAIL — route `/api/conversations` 404.

- [ ] **Step 3: Schema** — `db/init.sql` tambah (di akhir file):

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);
```

`backend/tests/helpers.ts` — `truncateAll` jadi:

```ts
await testDb.query(
  "TRUNCATE usage_logs, api_tokens, chunks, documents, messages, conversations, users RESTART IDENTITY CASCADE"
);
```

- [ ] **Step 4: Route chat** — `backend/src/routes/chat.ts`:

```ts
import { Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { requireLogin } from "../middleware/sessionAuth";
import { askAuth } from "../middleware/tokenAuth";
import { askStream } from "../services/rag";

const router = Router();

router.get("/conversations", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.updated_at,
            (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC`,
    [req.session!.userId]
  );
  res.json(rows);
});

router.post("/conversations", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO conversations (user_id) VALUES ($1) RETURNING id",
    [req.session!.userId]
  );
  res.status(201).json({ id: rows[0].id });
});

router.delete("/conversations/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  const { rowCount } = await pool.query(
    "DELETE FROM conversations WHERE id=$1 AND user_id=$2",
    [id, req.session!.userId]
  );
  if (!rowCount) return res.status(404).json({ error: "percakapan tidak ditemukan" });
  res.json({ ok: true });
});

router.get("/conversations/:id/messages", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  const owns = await pool.query(
    "SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2",
    [id, req.session!.userId]
  );
  if ((owns.rowCount ?? 0) === 0)
    return res.status(404).json({ error: "percakapan tidak ditemukan" });
  const { rows } = await pool.query(
    `SELECT id, role, content, citations, created_at
       FROM messages WHERE conversation_id=$1 ORDER BY id`,
    [id]
  );
  res.json(rows);
});

router.post("/chat", askAuth, async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) return res.status(400).json({ error: "question required" });
  const userId = req.auth!.userId;

  let conversationId = Number(req.body?.conversation_id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    const created = await pool.query(
      "INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id",
      [userId, question.slice(0, 50)]
    );
    conversationId = created.rows[0].id;
  } else {
    const owns = await pool.query(
      "SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );
    if ((owns.rowCount ?? 0) === 0)
      return res.status(404).json({ error: "percakapan tidak ditemukan" });
  }

  await pool.query(
    "INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)",
    [conversationId, question]
  );
  await pool.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [conversationId]);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  const write = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  write("meta", { conversation_id: conversationId });

  let answer = "";
  const started = Date.now();
  try {
    for await (const part of askStream(question)) {
      if ("delta" in part) {
        answer += part.delta;
        write("delta", { text: part.delta });
      } else {
        await pool.query(
          `INSERT INTO usage_logs (token_id, user_id, question, answer, cited_chunks, model, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.auth!.tokenId,
            req.auth!.userId,
            question,
            answer,
            JSON.stringify(part.citations),
            config.openaiModel,
            Date.now() - started,
          ]
        );
        await pool.query(
          "INSERT INTO messages (conversation_id, role, content, citations) VALUES ($1,'assistant',$2,$3)",
          [conversationId, answer, JSON.stringify(part.citations)]
        );
        await pool.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [conversationId]);
        write("citations", { citations: part.citations });
      }
    }
    write("done", {});
  } catch (err: any) {
    write("error", { message: err.message ?? "internal server error" });
  } finally {
    res.end();
  }
});

export default router;
```

`backend/src/app.ts` — tambah `import chatRoutes from "./routes/chat";` dan `app.use("/api", chatRoutes);` setelah `contentRoutes`.

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `cd backend && bun test tests/integration.chat.test.ts`
Expected: PASS.

- [ ] **Step 6: Regression** — `cd backend && bun test` → semua PASS.

- [ ] **Step 7: Commit**

```bash
git add db/init.sql backend/tests/helpers.ts backend/src/routes/chat.ts backend/src/app.ts backend/tests/integration.chat.test.ts
git commit -m "feat(chat): riwayat percakapan per-user + streaming SSE /api/chat"
```

---

### Task 3: Frontend — API client + Playground ala Claude

**Files:**
- Modify: `frontend/src/api.ts` (types + method CRUD chat + helper stream SSE)
- Rewrite: `frontend/src/pages/Playground.tsx`
- Gate: `cd frontend && npm run build`

**Interfaces:**
- Consumes: endpoint Task 2 (`/api/conversations*`, `/api/chat`).
- Produces:
  - `api.conversations(): Promise<Conversation[]>`
  - `api.createConversation(): Promise<{ id: number }>`
  - `api.deleteConversation(id): Promise<{ ok: boolean }>`
  - `api.conversationMessages(id): Promise<ChatMessage[]>`
  - `api.chat(question, conversationId, onEvent): Promise<void>` — parse SSE, panggil `onEvent({ event, data })` per event.

- [ ] **Step 1: API client** — `frontend/src/api.ts` tambah:

```ts
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
```

Di objek `api`, tambah method (setelah `deleteContent`):

```ts
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
```

- [ ] **Step 2: Rewrite Playground** — `frontend/src/pages/Playground.tsx` (ganti seluruh isi):

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatEvent, type ChatMessage, type Conversation } from "../api";
import {
  Button,
  Card,
  CitationPin,
  ErrorBanner,
  PageHeader,
  Textarea,
} from "../components/ui";

export default function Playground() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations());
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function newChat() {
    setError("");
    try {
      const { id } = await api.createConversation();
      setActiveId(id);
      setDraftId(id);
      setMessages([]);
      setSidebarOpen(false);
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openConversation(id: number) {
    setError("");
    try {
      const msgs = await api.conversationMessages(id);
      setActiveId(id);
      setDraftId(null);
      setMessages(msgs);
      setSidebarOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeConversation(id: number) {
    if (!window.confirm("Hapus percakapan ini?")) return;
    try {
      await api.deleteConversation(id);
      if (activeId === id) { setActiveId(null); setDraftId(null); setMessages([]); }
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function onEvent(evt: ChatEvent) {
    if (evt.event === "meta") {
      setActiveId(evt.data.conversation_id);
      setDraftId(null);
    } else if (evt.event === "delta") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.id === -1) {
          copy[copy.length - 1] = { ...last, content: last.content + evt.data.text };
        } else {
          copy.push({ id: -1, role: "assistant", content: evt.data.text, citations: [], created_at: "" });
        }
        return copy;
      });
    } else if (evt.event === "citations") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.id === -1) copy[copy.length - 1] = { ...last, citations: evt.data.citations };
        return copy;
      });
    } else if (evt.event === "error") {
      setError(evt.data.message ?? "terjadi kesalahan");
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || streaming) return;
    setError("");
    setQuestion("");
    setStreaming(true);
    setMessages((prev) => [...prev, { id: -2, role: "user", content: q, citations: [], created_at: "" }]);
    try {
      await api.chat(q, activeId ?? draftId, onEvent);
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <style>{`
        @keyframes chat-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; } }
        .chat-fade-in { animation: chat-fade 0.25s ease-out; }
        @media (prefers-reduced-motion: reduce) { .chat-fade-in { animation: none; } }
      `}</style>

      {/* Sidebar percakapan */}
      <aside className={`${sidebarOpen ? "flex" : "hidden"} md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white`}>
        <div className="p-3">
          <Button variant="primary" className="w-full" onClick={newChat} disabled={streaming}>+ Chat baru</Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                activeId === c.id ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => openConversation(c.id)}
            >
              <span className="truncate">{c.title || "Percakapan baru"}</span>
              <button
                className="hidden text-xs text-red-500 group-hover:block"
                onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }}
                aria-label="Hapus percakapan"
              >
                ✕
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Belum ada percakapan.</p>
          )}
        </nav>
      </aside>

      {/* Area chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Button variant="secondary" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</Button>
          <p className="text-sm font-semibold text-slate-700">Playground</p>
        </div>

        {error && <div className="px-4 pt-3"><ErrorBanner>{error}</ErrorBanner></div>}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && !streaming && (
            <div className="mx-auto max-w-2xl pt-16 text-center">
              <p className="text-2xl font-bold text-slate-800">Tanya-Jawab Dokumen</p>
              <p className="mt-2 text-sm text-slate-500">
                Ajukan pertanyaan tentang dokumen kedeputian. Jawaban disertai rujukan, dan riwayat
                percakapan tersimpan per pengguna.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={m.id === -1 || m.id === -2 ? `tmp-${i}` : m.id} message={m} />
          ))}
          {streaming && <StreamingCursor />}
        </div>

        <form onSubmit={send} className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              rows={1}
              placeholder="Tulis pertanyaan… (Enter untuk kirim, Shift+Enter baris baru)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <Button variant="primary" onClick={send} disabled={!question.trim() || streaming}>
              {streaming ? "…" : "Kirim"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`chat-fade-in mx-auto flex max-w-3xl ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[80%]" : "w-full"}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-blue-900 px-4 py-3 text-white">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
          </div>
        ) : (
          <Card interactive={false} className="p-5">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
              {message.content || "…"}
            </p>
            {message.citations.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500">Rujukan</p>
                <div className="mt-2 space-y-2">
                  {message.citations.map((c, i) => (
                    <p key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-slate-500">
                      <CitationPin index={i + 1} />
                      <span>
                        <span className="font-medium text-slate-800">{c.filename}</span>
                        {c.page_or_slide != null && <span> — halaman/slide {c.page_or_slide}</span>}
                        {c.section_title && <span> — {c.section_title}</span>}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-1 text-slate-400">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
      </div>
    </div>
  );
}
```

Catatan untuk engineer:
- `PageHeader` tidak dipakai (layout full-height) — biarkan tanpa PageHeader, judul di bar mobile.
- Verifikasi `Textarea` di `frontend/src/components/ui.tsx` meneruskan `onKeyDown` ke elemen `<textarea>` (bila tidak, bungkus sendiri). Cek cepat di file tersebut sebelum lanjut.
- `h-[calc(100vh-3.5rem)]` — sesuaikan tinggi header internal app jika berbeda (cek `InternalLayout`).

- [ ] **Step 3: Build gate**

Run: `cd frontend && npm run build`
Expected: PASS (tsc + vite, tanpa error type).

- [ ] **Step 4: Smoke manual** (bila backend lokal jalan): buka `/playground`, buat chat, kirim pertanyaan, pastikan jawaban streaming muncul, refresh → percakapan masih di sidebar, buka lagi → riwayat tampil.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/pages/Playground.tsx
git commit -m "feat(playground): chat multi-turn ala Claude dengan sidebar & streaming"
```

---

### Task 4: Verifikasi end-to-end & catatan deploy

- [ ] **Step 1: Regression backend penuh** — `cd backend && bun test` → semua PASS.
- [ ] **Step 2: Build penuh** — `cd frontend && npm run build` → PASS.
- [ ] **Step 3: Catatan deploy (dijalankan saat deploy, bukan di sini):**
  - Migrasi manual ke DB yang sudah hidup (kedua server), pola tabel `content`:
    - VPS: `docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db psql -U mih -d mih -f /docker-entrypoint-initdb.d/init.sql` (bind-mount lama — lebih aman jalan inline psql langsung, lihat quirk di memory `content-system-deploy`).
    - keuanganpmp: `docker compose exec -T db psql -U mih -d mih` + jalankan SQL `CREATE TABLE conversations/messages` inline.
  - Rebuild + restart kedua server.
  - Smoke browser (msedge + playwright-core): buat chat → stream → refresh → lanjut → hapus.
- [ ] **Step 4: Commit** — tidak ada (task ini tidak mengubah file).
