import { expect, test } from "bun:test";
import { CLUSTERS, CLUSTER_LAINNYA, classify } from "../src/services/clusters";

test("klasifikasi filename ke klaster yang tepat", () => {
  expect(classify(["Laporan Akhir Penyusunan Kerangka Ekonomi Makro RKP 2025.pdf"])).toBe(1);
  expect(classify(["2026 Analisis Pelemahan Nilai Tukar dan IHSG.pptx"])).toBe(2);
  expect(classify(["2025 Analisis Pentahapan Pengembangan Hilirisasi Kelapa Sawit.pdf"])).toBe(3);
  expect(classify(["2025 Master Plan Produktivitas Nasional 2025.pdf"])).toBe(4);
  expect(classify(["Laporan Akhir Koordinasi Penyusunan RPJMN 2025-2029.pdf"])).toBe(5);
  expect(classify(["2026 Laporan Kinerja Sekretariat Deputi Bidang PMP.pdf"])).toBe(6);
});

test("teks tanpa keyword masuk klaster Lainnya", () => {
  expect(classify(["The Economist - May 2026.pdf", "global markets weekly digest"])).toBe(CLUSTER_LAINNYA);
});

test("isi chunk ikut dipertimbangkan", () => {
  expect(classify(["dokumen-umum.pdf", "pembahasan tata kelola statistik sektoral nasional"])).toBe(1);
});

test("CLUSTERS berisi 7 entri berurutan 1..7", () => {
  expect(CLUSTERS.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});
