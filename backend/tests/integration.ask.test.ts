import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashToken } from "../src/lib/token";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  const zero = JSON.stringify(Array.from({ length: 1536 }, () => 0));
  const doc = await testDb.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ('paparan-uji.pptx','paparan','pptx','hash1','/data/uploaded/x.pptx','completed') RETURNING id`
  );
  await testDb.query(
    `INSERT INTO chunks (document_id, content, embedding, page_or_slide, section_title, chunk_index)
     VALUES ($1,$2,$3::vector,4,'Pendahuluan',0)`,
    [doc.rows[0].id, "Kedeputian merencanakan pembangunan makro untuk tahun depan.", zero]
  );
  const user = await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Uji','u@t.c','Uji',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  await testDb.query(
    "INSERT INTO api_tokens (user_id,name,token_hash,scope,daily_limit) VALUES ($1,'t',$2,'internal-read',10)",
    [user.rows[0].id, hashToken("mih_ask")]
  );
});

afterAll(async () => {
  await truncateAll();
});

test("POST /api/ask returns answer and citations", async () => {
  const res = await request(app)
    .post("/api/ask")
    .set("Authorization", "Bearer mih_ask")
    .send({ question: "Apa rencana pembangunan makro?" });
  expect(res.status).toBe(200);
  expect(res.body.answer.length).toBeGreaterThan(0);
  expect(res.body.citations.length).toBeGreaterThan(0);
  expect(res.body.citations[0].filename).toBe("paparan-uji.pptx");
  expect(res.body.citations[0].page_or_slide).toBe(4);
});

test("POST /api/ask rejects unknown token", async () => {
  const res = await request(app)
    .post("/api/ask")
    .set("Authorization", "Bearer mih_wrong")
    .send({ question: "x" });
  expect(res.status).toBe(401);
});

test("usage_logs records the request", async () => {
  const { rows } = await testDb.query(
    "SELECT question, cited_chunks FROM usage_logs ORDER BY id DESC LIMIT 1"
  );
  expect(rows[0].question).toBe("Apa rencana pembangunan makro?");
  expect(Array.isArray(rows[0].cited_chunks)).toBe(true);
});
