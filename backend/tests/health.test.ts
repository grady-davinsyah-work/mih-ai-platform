import { test, expect } from "bun:test";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});
