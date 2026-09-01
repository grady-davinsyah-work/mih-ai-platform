# n8n sebagai RAG Retrieval Engine MIH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti `search()` di backend MIH dengan panggilan webhook n8n (retrieval pgvector di sisi n8n), dengan fallback ke query lokal agar RAG tetap jalan saat n8n down. Streaming Playground tidak berubah.

**Architecture:** n8n menjadi retrieval engine: embed pertanyaan → query pgvector (`chunks`) → bangun `context` → balas `{labeled, context}` ke MIH lewat webhook. MIH (`rag.ts`) memanggil webhook; bila gagal, jatuh ke query SQL lokal yang ada sekarang. Generasi jawaban, streaming SSE, dan ekstraksi citations tetap di MIH.

**Tech Stack:** Bun (backend), Express 5, pg, OpenAI SDK; n8n (workflow retrieval, dibangun manual di UI user).

**Spec:** `docs/superpowers/specs/2026-08-27-n8n-rag-engine-design.md`

## Global Constraints

- String tampilan/user-facing tetap Bahasa Indonesia (konsisten dengan codebase).
- Tidak ada secret yang di-commit (`.env.prod` sudah di .gitignore; template hanya placeholder).
- Test backend: `cd backend && bun test` harus tetap hijau. `tests/setup.ts` men-set `LLM_PROVIDER=mock`; `stream.test.ts` bergantung pada jalur lokal.
- **DB test backend lokal:** `postgres://mih:mih@localhost:5434/mih_test` (container `mih-dev-db-5434`, pgvector sudah ada; port 5432 adalah proyek arthakarya — JANGAN pakai). Semua perintah test backend memakai prefix `TEST_DATABASE_URL=postgres://mih:mih@localhost:5434/mih_test`.
- `search(question)` mempertahankan signature `Promise<{ labeled: SearchRow[]; context: string }>` — pemanggil (`ask`, `askStream`) tidak berubah.
- Webhook contract dan format `context`/`labeled` identik dengan yang tercatat di spec (lampiran).
- Workflow n8n dibangun manual di UI n8n oleh user (di luar repo); repo hanya berisi README setup.
- **Amandemen R4 (spec sudah disesuaikan):** guard `provider !== "mock"` DIHAPUS — webhook mode tidak embed lokal, jadi mock provider tidak bertabrakan; dev lokal cukup mengosongkan `N8N_RAG_WEBHOOK_URL`. Ini membuat jalur fallback bisa diuji di bawah provider mock.

---

### Task 1: Konfigurasi `ragWebhookUrl` + env

**Files:**
- Modify: `backend/src/config.ts` (setelah baris `vectorK`)
- Modify: `.env.example` (setelah blok Drive sync)
- Modify: `.env.example.prod` (setelah blok Drive sync)

**Interfaces:**
- Consumes: —
- Produces: `config.ragWebhookUrl: string` (dibaca Task 2)

- [ ] **Step 1: Tambah field config**

Di `backend/src/config.ts`, setelah baris `vectorK`:
```ts
ragWebhookUrl: process.env.N8N_RAG_WEBHOOK_URL ?? "",
```

- [ ] **Step 2: Tambah env `.env.example`**

Setelah blok `RCLONE_CONFIG`:
```
# --- n8n RAG retrieval engine (OPSIONAL; kosong = pakai query lokal) ----------
# URL webhook n8n yang menggantikan search() lokal.
# Lihat docs/superpowers/specs/2026-08-27-n8n-rag-engine-design.md
N8N_RAG_WEBHOOK_URL=
```

- [ ] **Step 3: Tambah env `.env.example.prod`** — blok sama seperti Step 2, di tempat yang sama.

- [ ] **Step 4: Verifikasi**

Run: `cd backend && TEST_DATABASE_URL=postgres://mih:mih@localhost:5434/mih_test bun test`
Expected: semua test tetap hijau (tidak ada perubahan perilaku).

- [ ] **Step 5: Commit**

```bash
git add backend/src/config.ts .env.example .env.example.prod
git commit -m "feat(rag): tambah config ragWebhookUrl + env N8N_RAG_WEBHOOK_URL"
```

---

### Task 2: `rag.ts` — webhook retrieval + fallback (TDD)

**Files:**
- Create: `backend/tests/rag-webhook.test.ts`
- Modify: `backend/src/services/rag.ts`

**Interfaces:**
- Consumes: `config.ragWebhookUrl`, `config.vectorK` (Task 1); `pool` (`../db`); `embedTexts` (`./embeddings`).
- Produces: `search(question)` signature tetap; ekspor baru `searchViaWebhook(question)`; fungsi internal `searchLocal(question)`.

- [ ] **Step 1: Tulis test gagal dulu** — `backend/tests/rag-webhook.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { config } from "../src/config";
import { search } from "../src/services/rag";
import { testDb, applySchema, truncateAll } from "./helpers";

const zero = JSON.stringify(Array.from({ length: 1536 }, () => 0));
const realFetch = globalThis.fetch;
const realWebhookUrl = config.ragWebhookUrl;
const realLlmProvider = config.llmProvider;

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
  config.ragWebhookUrl = realWebhookUrl;
  config.llmProvider = realLlmProvider;
  globalThis.fetch = realFetch;
  await truncateAll();
});

afterEach(() => {
  config.ragWebhookUrl = "";
  config.llmProvider = "mock";
  globalThis.fetch = realFetch;
});

test("webhook dipanggil & hasilnya dipakai saat ragWebhookUrl terisi", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(
      JSON.stringify({
        labeled: [
          { document_id: 1, filename: "dari-n8n.pdf", file_type: "laporan", page_or_slide: 2, section_title: null, content: "teks", label: 1 },
        ],
        context: "[1] (File: dari-n8n.pdf, laporan, halaman/slide 2)\nteks",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  config.ragWebhookUrl = "http://n8n.test/rag";
  config.llmProvider = "mock";

  const { labeled, context } = await search("berapa PPN?");
  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe("http://n8n.test/rag");
  expect(calls[0].body.question).toBe("berapa PPN?");
  expect(calls[0].body.vector_k).toBe(config.vectorK);
  expect(labeled[0].filename).toBe("dari-n8n.pdf");
  expect(context).toContain("dari-n8n.pdf");
});

test("webhook gagal (error jaringan) → fallback ke query lokal", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  config.ragWebhookUrl = "http://n8n.test/rag";
  config.llmProvider = "mock";

  const { labeled, context } = await search("rencana pembangunan makro?");
  expect(labeled[0].filename).toBe("paparan-uji.pptx");
  expect(context).toContain("paparan-uji.pptx");
});

test("webhook balas HTTP 500 → fallback ke query lokal", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })) as typeof fetch;
  config.ragWebhookUrl = "http://n8n.test/rag";
  config.llmProvider = "mock";

  const { labeled } = await search("rencana pembangunan makro?");
  expect(labeled[0].filename).toBe("paparan-uji.pptx");
});

test("webhook balas format tidak valid → fallback ke query lokal", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ foo: "bar" }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  config.ragWebhookUrl = "http://n8n.test/rag";
  config.llmProvider = "mock";

  const { labeled } = await search("rencana pembangunan makro?");
  expect(labeled[0].filename).toBe("paparan-uji.pptx");
});

test("ragWebhookUrl kosong → query lokal, fetch tidak dipanggil", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("tidak boleh dipanggil");
  }) as typeof fetch;
  config.ragWebhookUrl = "";

  const { labeled } = await search("rencana pembangunan makro?");
  expect(called).toBe(false);
  expect(labeled[0].filename).toBe("paparan-uji.pptx");
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && TEST_DATABASE_URL=postgres://mih:mih@localhost:5434/mih_test bun test tests/rag-webhook.test.ts`
Expected: FAIL — webhook belum dipanggil.

- [ ] **Step 3: Refactor `rag.ts`**

`backend/src/services/rag.ts` — badan `search()` lama dipindah ke `searchLocal`, tambah `searchViaWebhook` + dispatch baru:
```ts
const RAG_WEBHOOK_TIMEOUT_MS = 30_000;

async function searchLocal(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
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

export async function searchViaWebhook(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_WEBHOOK_TIMEOUT_MS);
  try {
    const resp = await fetch(config.ragWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, vector_k: config.vectorK }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`n8n rag webhook HTTP ${resp.status}`);
    const data = (await resp.json()) as { labeled?: SearchRow[]; context?: string };
    if (!Array.isArray(data.labeled) || typeof data.context !== "string")
      throw new Error("n8n rag webhook: format response tidak valid");
    return { labeled: data.labeled, context: data.context };
  } finally {
    clearTimeout(timer);
  }
}

export async function search(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  if (config.ragWebhookUrl) {
    try {
      return await searchViaWebhook(question);
    } catch (err) {
      console.warn("n8n rag webhook gagal, fallback ke query lokal:", (err as Error).message);
    }
  }
  return searchLocal(question);
}
```

- [ ] **Step 4: Jalankan test file**

Run: `cd backend && TEST_DATABASE_URL=postgres://mih:mih@localhost:5434/mih_test bun test tests/rag-webhook.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Jalankan seluruh test backend**

Run: `cd backend && TEST_DATABASE_URL=postgres://mih:mih@localhost:5434/mih_test bun test`
Expected: PASS — termasuk `stream.test.ts` (provider mock, `ragWebhookUrl` kosong → jalur lokal).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/rag.ts backend/tests/rag-webhook.test.ts
git commit -m "feat(rag): search() via webhook n8n dengan fallback ke query lokal"
```

---

### Task 3: Dokumen operasional setup n8n

**Files:**
- Create: `n8n/README.md`

**Interfaces:**
- Consumes: webhook contract dari spec (request/response, format `context`/`labeled`).
- Produces: checklist untuk user membangun workflow n8n di UI.

- [ ] **Step 1: Tulis `n8n/README.md`** berisi:
  1. Ringkasan peran n8n (retrieval; generasi+streaming di MIH).
  2. Prasyarat: akses Postgres MIH (Tailscale), OpenAI key sama.
  3. SQL user read-only (opsional, disarankan):
     ```sql
     CREATE USER mih_rag_ro WITH PASSWORD '<ganti>';
     GRANT CONNECT ON DATABASE mih TO mih_rag_ro;
     GRANT USAGE ON SCHEMA public TO mih_rag_ro;
     GRANT SELECT ON chunks, documents TO mih_rag_ro;
     ```
  4. Langkah build workflow (node per node): Webhook (POST) → OpenAI Embeddings (`text-embedding-3-small`) → Postgres → Code → Respond to Webhook (`{ labeled, context }`) → branch error → 500.
     SQL node Postgres (parameter: `$1` = embedding pertanyaan array float, `$2` = vector_k):
     ```sql
     SELECT c.id, c.content, c.page_or_slide, c.section_title,
            d.id AS document_id, d.filename, d.file_type
       FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.is_outdated = FALSE AND d.status = 'completed'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
     ```
     Node Code: tambah `label = index + 1` per baris; bangun `context` per baris:
     `[N] (File: {filename}, {file_type}[, halaman/slide {page_or_slide}][, Bagian: {section_title}])\n{content}`
     (komponen `halaman/slide` dan `Bagian` di-skip bila null), baris digabung `\n\n---\n\n`.
  5. Tes curl:
     ```bash
     curl -X POST {WEBHOOK_URL} -H 'Content-Type: application/json' \
       -d '{"question":"berapa persen PPN atas jasa?","vector_k":8}'
     ```
     Expected: JSON `{ labeled, context }`, `labeled.length` = vector_k (atau kurang).
  6. Setelah webhook OK: set `N8N_RAG_WEBHOOK_URL` di env server, deploy backend, verifikasi Playground.
  7. Catatan: model embedding WAJIB `text-embedding-3-small`; bila ganti, retrieval salah diam-diam.

- [ ] **Step 2: Verifikasi konsistensi** — bandingkan SQL & format context di README dengan lampiran spec. Harus identik.

- [ ] **Step 3: Commit**

```bash
git add n8n/README.md
git commit -m "docs(n8n): README setup workflow RAG retrieval"
```

---

## Verifikasi Manual (setelah deploy, dilakukan user)

1. Curl webhook n8n → `{ labeled, context }` valid, top-k sesuai `vector_k`.
2. Playground: tanya → streaming per-token + citations muncul, format sama seperti sebelumnya.
3. Stop workflow n8n → `/api/ask` tetap menjawab (fallback SQL lokal), ada log warning.
4. Kosongkan `N8N_RAG_WEBHOOK_URL` → perilaku lama (tidak ada panggilan webhook).

## Amandemen Spec

- **R4 direvisi:** guard `provider !== "mock"` dihapus (tidak muncul di kode Task 2). Alasan: dalam webhook mode MIH tidak embed lokal, sehingga mock provider tidak bertabrakan; fallback tetap bisa diuji di bawah provider mock. Spec file telah disesuaikan.
