import { test, expect } from "bun:test";
import { generateToken, hashToken } from "../src/lib/token";
import { hashPassword, verifyPassword } from "../src/lib/passwords";

test("generateToken produces mih_ prefixed tokens", () => {
  const t = generateToken();
  expect(t.startsWith("mih_")).toBe(true);
  expect(t.length).toBeGreaterThan("mih_".length + 20);
});

test("hashToken is deterministic sha256", () => {
  expect(hashToken("abc")).toBe(hashToken("abc"));
  expect(hashToken("abc")).not.toBe(hashToken("abd"));
});

test("password hash round-trips and rejects wrong password", () => {
  const stored = hashPassword("rahasia123");
  expect(verifyPassword("rahasia123", stored)).toBe(true);
  expect(verifyPassword("salah", stored)).toBe(false);
  expect(stored).not.toContain("rahasia123");
});
