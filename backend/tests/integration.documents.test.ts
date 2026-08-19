import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashPassword } from "../src/lib/passwords";
import { hashToken } from "../src/lib/token";

const app = createApp();
let cookie = "";

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Admin','a@d.c','Uji',$1,TRUE)",
    [hashPassword("pw")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "a@d.c", password: "pw" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

afterAll(async () => {
  await truncateAll();
  await testDb.end();
});

test("upload creates pending document", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("dummy pdf bytes"), "contoh-laporan.pdf");
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("pending");
  expect(res.body.file_type).toBe("laporan");
});

test("duplicate upload returns 409", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("dummy pdf bytes"), "contoh-laporan.pdf");
  expect(res.status).toBe(409);
});

test("list documents shows uploaded file", async () => {
  const res = await request(app).get("/api/admin/documents").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.some((d: any) => d.filename === "contoh-laporan.pdf")).toBe(true);
});

test("unsupported extension rejected", async () => {
  const res = await request(app)
    .post("/api/admin/documents")
    .set("Cookie", cookie)
    .attach("file", Buffer.from("x"), "malware.exe");
  expect(res.status).toBe(400);
});

test("retry resets failed document to pending", async () => {
  const { rows } = await testDb.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ('gagal.pdf','laporan','pdf','hash-retry','/x/gagal.pdf','failed') RETURNING id`
  );
  const res = await request(app).post(`/api/admin/documents/${rows[0].id}/retry`).set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("pending");
  const again = await request(app).post(`/api/admin/documents/${rows[0].id}/retry`).set("Cookie", cookie);
  expect(again.status).toBe(400);
});

test("usage-logs returns recorded asks with token name", async () => {
  const user = await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('U','u2@t.c','U',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  await testDb.query(
    "INSERT INTO api_tokens (user_id,name,token_hash,scope,daily_limit) VALUES ($1,'tok-uji',$2,'internal-read',10)",
    [user.rows[0].id, hashToken("mih_usage")]
  );
  const ask = await request(app).post("/api/ask").set("Authorization", "Bearer mih_usage").send({ question: "uji log" });
  expect(ask.status).toBe(200);
  const res = await request(app).get("/api/admin/usage-logs").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  expect(res.body[0].question).toBe("uji log");
  expect(res.body[0].token_name).toBe("tok-uji");
});
