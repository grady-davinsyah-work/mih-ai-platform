import { test, expect } from "bun:test";
import { encodeSession, decodeSession } from "../src/lib/session";

test("session encode/decode round-trip", () => {
  const cookie = encodeSession({ userId: 7, isAdmin: true });
  const data = decodeSession(cookie);
  expect(data?.userId).toBe(7);
  expect(data?.isAdmin).toBe(true);
});

test("tampered cookie is rejected", () => {
  const cookie = encodeSession({ userId: 7 });
  const forged = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
  expect(decodeSession(forged)).toBeNull();
});
