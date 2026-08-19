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
  await testDb.query(
    "INSERT INTO users (name,email,unit_kerja,password_hash,is_admin) VALUES ('Staf','staf@x.c','Uji',$1,FALSE)",
    [hashPassword("stafpw")]
  );
  const login = await request(app).post("/api/auth/login").send({ email: "admin@x.c", password: "adminpw" });
  cookie = login.headers["set-cookie"][0].split(";")[0];
});

afterAll(async () => {
  await truncateAll();
});

test("admin can list users", async () => {
  const res = await request(app).get("/api/admin/users").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(2);
});

test("admin can create user", async () => {
  const res = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Baru", email: "baru@x.c", unit_kerja: "Subdit", password: "pw123", is_admin: false });
  expect(res.status).toBe(201);
  expect(res.body.email).toBe("baru@x.c");
});

test("duplicate email returns 409", async () => {
  const res = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Dup", email: "baru@x.c", unit_kerja: "x", password: "pw" });
  expect(res.status).toBe(409);
});

test("generate token shows plaintext once and works for /ask", async () => {
  const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
  const staf = list.body.find((u: any) => u.email === "staf@x.c");
  const created = await request(app)
    .post(`/api/admin/users/${staf.id}/tokens`)
    .set("Cookie", cookie)
    .send({ name: "integrasi", scope: "internal-read", daily_limit: 50 });
  expect(created.status).toBe(201);
  expect(created.body.token).toMatch(/^mih_/);

  const ask = await request(app)
    .post("/api/ask")
    .set("Authorization", `Bearer ${created.body.token}`)
    .send({ question: "q" });
  expect(ask.status).toBe(200);
});

test("non-admin cannot access admin endpoints", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "staf@x.c", password: "stafpw" });
  const staffCookie = login.headers["set-cookie"][0].split(";")[0];
  const res = await request(app).get("/api/admin/users").set("Cookie", staffCookie);
  expect(res.status).toBe(403);
});
