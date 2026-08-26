import { pool } from "../src/db";
import { news, publications } from "../../frontend/src/data/portal";

/*
 * Seed awal konten publik: baca berita & publikasi dari data statis landing
 * (frontend/src/data/portal.ts) lalu insert ke tabel `content`.
 * Idempoten — slug yang sudah ada di-skip (ON CONFLICT DO NOTHING).
 *
 * Jalankan: cd backend && bun run scripts/seed-content.ts
 */

async function main() {
  let created = 0;
  let skipped = 0;

  for (const n of news) {
    const r = await pool.query(
      `INSERT INTO content
         (type, slug, title, excerpt, image, category, author, date, content, gallery, is_published)
       VALUES ('news', $1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (slug) DO NOTHING`,
      [n.slug, n.title, n.excerpt, n.image, n.category, n.author, n.date, n.content, n.gallery]
    );
    if (r.rowCount === 1) created++;
    else skipped++;
  }

  for (const p of publications) {
    const r = await pool.query(
      `INSERT INTO content
         (type, slug, title, excerpt, image, category, author, date, content,
          document_url, document_name, is_published)
       VALUES ('publication', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       ON CONFLICT (slug) DO NOTHING`,
      [p.slug, p.title, p.excerpt, p.image, p.category, p.author, p.date, p.content, p.documentUrl, p.documentName]
    );
    if (r.rowCount === 1) created++;
    else skipped++;
  }

  console.log(`seed konten selesai — dibuat: ${created}, sudah ada (skip): ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
