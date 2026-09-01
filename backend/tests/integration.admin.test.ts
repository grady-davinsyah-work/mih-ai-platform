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

test("admin can update user", async () => {
  const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
  const staf = list.body.find((u: any) => u.email === "staf@x.c");
  const res = await request(app)
    .put(`/api/admin/users/${staf.id}`)
    .set("Cookie", cookie)
    .send({ name: "Staf Baru", unit_kerja: "Subdit Baru", is_admin: true });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Staf Baru");
  expect(res.body.unit_kerja).toBe("Subdit Baru");
  expect(res.body.is_admin).toBe(true);
  // kembalikan ke semula agar test lain (login staf) tetap valid
  await request(app)
    .put(`/api/admin/users/${staf.id}`)
    .set("Cookie", cookie)
    .send({ name: "Staf", unit_kerja: "Uji", is_admin: false });
});

test("admin can reset password", async () => {
  const created = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Pw", email: "pw@x.c", unit_kerja: "x", password: "lama123", is_admin: false });
  expect(created.status).toBe(201);
  const reset = await request(app)
    .put(`/api/admin/users/${created.body.id}`)
    .set("Cookie", cookie)
    .send({ password: "baru123" });
  expect(reset.status).toBe(200);
  const login = await request(app).post("/api/auth/login").send({ email: "pw@x.c", password: "baru123" });
  expect(login.status).toBe(200);
});

test("cannot demote own admin role", async () => {
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  const res = await request(app)
    .put(`/api/admin/users/${me.body.user.id}`)
    .set("Cookie", cookie)
    .send({ is_admin: false });
  expect(res.status).toBe(200);
  expect(res.body.is_admin).toBe(true);
});

test("admin can delete user", async () => {
  const created = await request(app)
    .post("/api/admin/users")
    .set("Cookie", cookie)
    .send({ name: "Hapus", email: "hapus@x.c", unit_kerja: "x", password: "pw", is_admin: false });
  const res = await request(app).delete(`/api/admin/users/${created.body.id}`).set("Cookie", cookie);
  expect(res.status).toBe(200);
  const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
  expect(list.body.some((u: any) => u.email === "hapus@x.c")).toBe(false);
});

test("cannot delete own account", async () => {
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  const res = await request(app).delete(`/api/admin/users/${me.body.user.id}`).set("Cookie", cookie);
  expect(res.status).toBe(400);
});

test("delete missing user returns 404", async () => {
  const res = await request(app).delete("/api/admin/users/999999").set("Cookie", cookie);
  expect(res.status).toBe(404);
});
