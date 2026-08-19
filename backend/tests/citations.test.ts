import { test, expect } from "bun:test";
import { extractCitedIndices } from "../src/services/rag";

test("extracts [n] citation markers", () => {
  const s = extractCitedIndices("Menurut [1] dan [3], target [12] tercapai.");
  expect([...s].sort((a, b) => a - b)).toEqual([1, 3, 12]);
});

test("no markers returns empty set", () => {
  expect(extractCitedIndices("Tidak ada rujukan.").size).toBe(0);
});
