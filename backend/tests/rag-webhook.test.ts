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
