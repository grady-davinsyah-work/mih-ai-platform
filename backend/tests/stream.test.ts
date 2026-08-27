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
