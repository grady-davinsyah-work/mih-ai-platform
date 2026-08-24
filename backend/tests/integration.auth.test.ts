import { afterAll, beforeAll, expect, test } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";
import { testDb, applySchema, truncateAll } from "./helpers";
import { hashToken } from "../src/lib/token";
import { hashPassword } from "../src/lib/passwords";
import { Router } from "express";
import { tokenAuth, askAuth } from "../src/middleware/tokenAuth";

// test endpoint yang butuh tokenAuth
function buildApp() {
  const app = createApp();
  const router = Router();
  router.post("/ping", tokenAuth, (req, res) => res.json({ auth: req.auth }));
  app.use("/api", router);
  return app;
}

// test endpoint yang butuh askAuth (token ATAU sesi login)
function buildAskApp() {
  const app = createApp();
  const router = Router();
  router.post("/ask-test", askAuth, (req, res) => res.json({ auth: req.auth }));
  app.use("/api", router);
  return app;
}

const app = buildApp();
const askApp = buildAskApp();

beforeAll(async () => {
  await applySchema();
  await truncateAll();
  const user = await testDb.query(
    "INSERT INTO users (name, email, unit_kerja, password_hash, is_admin) VALUES ('Uji','a@b.c','Uji',$1,FALSE) RETURNING id",
    [hashPassword("x")]
  );
  await testDb.query(
    "INSERT INTO api_tokens (user_id, name, token_hash, scope, daily_limit) VALUES ($1,'t',$2,'internal-read',2)",
    [user.rows[0].id, hashToken("mih_ok")]
  );
  // token khusus untuk askAuth (tidak pernah dicabut oleh tes lain)
  await testDb.query(
    "INSERT INTO api_tokens (user_id, name, token_hash, scope, daily_limit) VALUES ($1,'ask',$2,'ask',2)",
    [user.rows[0].id, hashToken("mih_ask")]
  );
});

afterAll(async () => {
  await truncateAll();
});

test("valid token passes", async () => {
  const res = await request(app).post("/api/ping").set("Authorization", "Bearer mih_ok");
  expect(res.status).toBe(200);
  expect(res.body.auth.scope).toBe("internal-read");
});

test("missing token returns 401", async () => {
  const res = await request(app).post("/api/ping");
  expect(res.status).toBe(401);
});

test("askAuth: valid token passes", async () => {
  const res = await request(askApp).post("/api/ask-test").set("Authorization", "Bearer mih_ask");
  expect(res.status).toBe(200);
  expect(res.body.auth.scope).toBe("ask");
  expect(res.body.auth.tokenId).not.toBeNull();
});

test("askAuth: session login passes without token", async () => {
  const login = await request(askApp).post("/api/auth/login").send({ email: "a@b.c", password: "x" });
  expect(login.status).toBe(200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const res = await request(askApp).post("/api/ask-test").set("Cookie", cookie);
  expect(res.status).toBe(200);
  expect(res.body.auth.scope).toBe("session");
  expect(res.body.auth.tokenId).toBeNull();
});

test("askAuth: no token and no session returns 401", async () => {
  const res = await request(askApp).post("/api/ask-test");
  expect(res.status).toBe(401);
});

test("revoked token returns 403", async () => {
  await testDb.query("UPDATE api_tokens SET revoked_at=now() WHERE token_hash=$1", [hashToken("mih_ok")]);
  const res = await request(app).post("/api/ping").set("Authorization", "Bearer mih_ok");
  expect(res.status).toBe(403);
});

test("login + me round-trip", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "a@b.c", password: "x" });
  expect(login.status).toBe(200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  expect(me.status).toBe(200);
  expect(me.body.user.email).toBe("a@b.c");
});

test("wrong password returns 401", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "a@b.c", password: "salah" });
  expect(res.status).toBe(401);
});
