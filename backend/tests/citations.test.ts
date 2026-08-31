import { test, expect } from "bun:test";
import { extractCitedIndices, extractYears, isComparisonQuery } from "../src/services/rag";

test("extracts [n] citation markers", () => {
  const s = extractCitedIndices("Menurut [1] dan [3], target [12] tercapai.");
  expect([...s].sort((a, b) => a - b)).toEqual([1, 3, 12]);
});

test("no markers returns empty set", () => {
  expect(extractCitedIndices("Tidak ada rujukan.").size).toBe(0);
});

test("extractYears menemukan tahun yang disebut", () => {
  expect([...extractYears("Perbandingan RKP 2026 dan 2027")].sort()).toEqual([2026, 2027]);
  expect(extractYears("Apa target pembangunan makro?").size).toBe(0);
});

test("isComparisonQuery mendeteksi perbandingan & entitas ganda", () => {
  expect(isComparisonQuery("Perbandingan RKP 2026 dan 2027")).toBe(true);
  expect(isComparisonQuery("Bandingkan inflasi 2026 dengan 2025")).toBe(true);
  expect(isComparisonQuery("Apa perbedaan ekonomi biru dan hijau?")).toBe(true);
  expect(isComparisonQuery("Apa rencana pembangunan makro?")).toBe(false);
  expect(isComparisonQuery("Ringkas RKP 2027")).toBe(false);
});
