import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
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
  // Dummy user for ownership tests (conversation FK references users)
  await testDb.query(
    "INSERT INTO users (id, name, email, unit_kerja, password_hash, is_admin) VALUES (99999, 'Other', 'o@t.c', 'Other', $1, FALSE)",
    [hashPassword("dummy")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "u@t.c", password: "x" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

beforeEach(async () => {
  await testDb.query("DELETE FROM messages");
  await testDb.query("DELETE FROM conversations");
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
