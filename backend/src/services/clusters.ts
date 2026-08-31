// Klasifikasi dokumen ke klaster tematik berbasis keyword.
// Sumber teks: filename (bobot ×3) + sampel isi chunk. Tanpa LLM call.

export interface ClusterDef {
  id: number;
  name: string;
  keywords: string[];
}

export const CLUSTER_LAINNYA = 7;

export const CLUSTERS: ClusterDef[] = [
  {
    id: 1,
    name: "Makro & Statistik",
    keywords: [
      "kerangka ekonomi makro", "makroekonomi", "outlook makro", "model outlook",
      "modelling", "model ekonomi makro", "asumsi dasar", "perkembangan ekonomi makro",
      "ekonomi makro", "statistik sektoral", "forum masyarakat statistik", "statistik",
      "perekonomian indonesia", "triwulan", "produk domestik bruto", "pdb",
    ],
  },
  {
    id: 2,
    name: "Fiskal, Moneter & Keuangan",
    keywords: [
      "postur makro fiskal", "makro fiskal", "fiskal daerah", "transfer ke daerah", "tkd",
      "pinjaman daerah", "moneter", "inflasi", "nilai tukar", "kurs", "ihsg",
      "sektor keuangan", "belanja tkd", "apbn", "apbd", "kualitas belanja",
      "perbankan", "bank indonesia", "suku bunga",
    ],
  },
  {
    id: 3,
    name: "Hilirisasi & Kerjasama Ekonomi",
    keywords: [
      "hilirisasi", "komoditas strategis", "komoditas", "kelapa sawit", "kelapa",
      "aren", "kopi", "kakao", "batu bara", "agrotechnopreneur", "ekspor",
      "kerjasama ekonomi internasional", "kerja sama ekonomi", "verbal note",
      "world bank", "partnership", "geopolitik", "geopolitic", "tariff", "tarif",
      "sumber daya alam", "ksp", "danantara", "hibah luar negeri",
    ],
  },
  {
    id: 4,
    name: "Produktivitas & Ekonomi Tematik",
    keywords: [
      "produktivitas", "master plan produktivitas", "ekonomi biru", "ekonomi hijau",
      "ekonomi oranye", "blue economy", "green economy", "orange economy",
      "green growth", "creative hub", "ekonomi kreatif", "genom",
    ],
  },
  {
    id: 5,
    name: "Perencanaan Pembangunan",
    keywords: [
      "peta jalan", "rencana aksi", "blueprint", "roadmap", "rkp", "rpjmn", "rpjpn",
      "rpjpd", "perpres rkp", "ranwal", "penyusunan perencanaan", "transformasi ekonomi",
      "trisula pembangunan", "prioritas pembangunan", "psn", "proyek strategis nasional",
      "digital transformation", "perencanaan", "pengendalian intern pemerintah", "spip",
      "dekon", "dekonsentrasi", "penyelarasan",
    ],
  },
  {
    id: 6,
    name: "Tata Kelola Internal",
    keywords: [
      "kinerja", "laporan kinerja", "lkj", "anggaran", "risiko", "sumber daya manusia",
      "sdm", "asn", "kearsipan", "bmn", "barang milik negara", "pengadaan",
      "perbendaharaan", "audit", "rumah tangga", "protokol", "ortala", "rab",
      "kapasitas asn", "insentif", "disinsentif", "format penamaan",
    ],
  },
  { id: CLUSTER_LAINNYA, name: "Lainnya", keywords: [] },
];

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// texts[0] dianggap filename (bobot ×3), sisanya isi chunk.
// Kembalikan id klaster dengan skor tertinggi; 0 skor → Lainnya.
export function classify(texts: string[]): number {
  const lowered = texts.map((t) => t.toLowerCase());
  let best = CLUSTER_LAINNYA;
  let bestScore = 0;
  for (const c of CLUSTERS) {
    if (c.id === CLUSTER_LAINNYA) continue;
    let score = 0;
    for (const kw of c.keywords) {
      for (let i = 0; i < lowered.length; i++) {
        const hits = countOccurrences(lowered[i], kw);
        if (hits > 0) score += hits * (i === 0 ? 3 : 1);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = c.id;
    }
  }
  return best;
}
