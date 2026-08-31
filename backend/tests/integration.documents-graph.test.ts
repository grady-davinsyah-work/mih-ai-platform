import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";

const app = createApp();
let cookie = "";

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Admin','admin@x.c','Uji',$1,TRUE)",
    [hashPassword("adminpw")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "admin@x.c", password: "adminpw" });
  cookie = login.headers["set-cookie"][0].split(";")[0];

  // Dua dokumen completed, masing-masing satu chunk.
  // Vektor berbeda sumbu agar cosine-nya 0 (di bawah ambang default) —
  // edge semantik memang tidak diharapkan; edge kutipan yang diuji.
  const vec = (dim: number) =>
    JSON.stringify(Array.from({ length: 1536 }, (_, i) => (i === dim ? 1 : 0)));
  for (const [name, dim] of [["doc-a.pdf", 0], ["doc-b.pdf", 1]] as const) {
    const r = await testDb.query(
      `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status, chunk_count)
       VALUES ($1,'laporan','pdf',$2,$3,'completed',1) RETURNING id`,
      [name, `sha-${name}`, `/data/raw/${name}`]
    );
    await testDb.query(
      `INSERT INTO chunks (document_id, content, embedding, page_or_slide, chunk_index)
       VALUES ($1, 'teks', $2::vector, 1, 0)`,
      [r.rows[0].id, vec(dim)]
    );
  }

  // Satu jawaban yang mengutip kedua dokumen → edge ko-kutipan.
  await testDb.query(
    "INSERT INTO conversations (user_id, title) VALUES ((SELECT id FROM users LIMIT 1), 'uji')"
  );
  await testDb.query(
    `INSERT INTO messages (conversation_id, role, content, citations)
     VALUES ((SELECT id FROM conversations LIMIT 1), 'assistant', 'jawaban [1][2]', $1)`,
    [JSON.stringify([
      { document_id: 1, filename: "doc-a.pdf" },
      { document_id: 2, filename: "doc-b.pdf" },
    ])]
  );
});

afterAll(async () => {
  await truncateAll();
});

test("graph butuh login", async () => {
  const res = await request(app).get("/api/documents/graph");
  expect(res.status).toBe(401);
});

test("graph mengembalikan nodes dokumen completed", async () => {
  const res = await request(app).get("/api/documents/graph").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.nodes)).toBe(true);
  expect(Array.isArray(res.body.edges)).toBe(true);
  const names = res.body.nodes.map((n: any) => n.filename).sort();
  expect(names).toEqual(["doc-a.pdf", "doc-b.pdf"]);
  expect(res.body.nodes[0].chunk_count).toBe(1);
});

test("graph punya edge ko-kutipan untuk dokumen yang dikutip bersama", async () => {
  const res = await request(app).get("/api/documents/graph").set("Cookie", cookie);
  expect(res.status).toBe(200);
  const edge = res.body.edges.find((e: any) => Number(e.source) === 1 && Number(e.target) === 2);
  expect(edge).toBeDefined();
  expect(Number(edge.citations)).toBe(1);
});

test("min_semantic=0 menyertakan edge semantik lemah", async () => {
  const res = await request(app)
    .get("/api/documents/graph?min_semantic=0")
    .set("Cookie", cookie);
  expect(res.status).toBe(200);
  const edge = res.body.edges.find((e: any) => Number(e.source) === 1 && Number(e.target) === 2);
  // cosine dua vektor ortogonal = 0 → lolos ambang 0, edge semantik muncul.
  expect(Number(edge.semantic)).toBe(0);
  expect(Number(edge.citations)).toBe(1);
});
