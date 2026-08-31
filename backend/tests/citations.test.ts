import { test, expect } from "bun:test";
import { extractCitedIndices, extractYears, isComparisonQuery, buildContext, buildRetrievalQuery } from "../src/services/rag";
import { selectSystemPrompt, SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT } from "../src/services/llm";

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

test("selectSystemPrompt memilih prompt perbandingan", () => {
  expect(selectSystemPrompt(true)).toBe(COMPARISON_SYSTEM_PROMPT);
  expect(selectSystemPrompt(false)).toBe(SYSTEM_PROMPT);
  expect(COMPARISON_SYSTEM_PROMPT).not.toBe(SYSTEM_PROMPT);
  expect(COMPARISON_SYSTEM_PROMPT).toContain("INSTRUKSI KHUSUS UNTUK PERTANYAAN PERBANDINGAN");
});

test("buildContext mengelompokkan per dokumen bila diminta", () => {
  const labeled = [
    { label: 1, document_id: 1, filename: "RKP 2026.pdf", file_type: "pdf", page_or_slide: 5, section_title: "Pendahuluan", content: "AAA" },
    { label: 2, document_id: 2, filename: "RKP 2027.pdf", file_type: "pdf", page_or_slide: 3, section_title: null, content: "BBB" },
    { label: 3, document_id: 1, filename: "RKP 2026.pdf", file_type: "pdf", page_or_slide: 10, section_title: "Ekonomi", content: "CCC" },
  ];
  const grouped = buildContext(labeled, true);
  expect(grouped).toContain("=== Dokumen 1: RKP 2026.pdf (pdf) ===");
  expect(grouped).toContain("=== Dokumen 2: RKP 2027.pdf (pdf) ===");
  expect(grouped).toContain("[1]");
  expect(grouped).toContain("[3]");
});

test("buildContext tetap flat bila tidak diminta", () => {
  const labeled = [
    { label: 1, document_id: 1, filename: "RKP 2026.pdf", file_type: "pdf", page_or_slide: 5, section_title: null, content: "AAA" },
  ];
  const flat = buildContext(labeled, false);
  expect(flat).toContain("[1] (File: RKP 2026.pdf, pdf");
  expect(flat).not.toContain("=== Dokumen");
});

test("buildRetrievalQuery menggabungkan pertanyaan user terakhir ke follow-up", () => {
  expect(buildRetrievalQuery("jelaskan poin kedua", [])).toBe("jelaskan poin kedua");
  const history = [
    { role: "user" as const, content: "Perbandingan hilirisasi kelapa sawit dan kerangka ekonomi makro" },
    { role: "assistant" as const, content: "Jawaban (mock) berdasarkan [1]" },
  ];
  expect(buildRetrievalQuery("jelaskan poin kedua", history)).toContain("Perbandingan hilirisasi kelapa sawit");
  expect(buildRetrievalQuery("jelaskan poin kedua", history)).toContain("jelaskan poin kedua");
});
