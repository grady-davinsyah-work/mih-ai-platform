import { Router } from "express";
import { pool } from "../db";

const router = Router();

const PUBLIC_COLS = `
  id, type, slug, title, excerpt, image, category, author, date, content,
  document_url, document_name, gallery, created_at, updated_at
`;

// Konten publik landing (berita & publikasi) — hanya yang published.
router.get("/content", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM content
      WHERE is_published = true
      ORDER BY date DESC, id DESC`
  );
  res.json(rows);
});

// Detail satu konten by slug — hanya yang published.
router.get("/content/:slug", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM content
      WHERE slug = $1 AND is_published = true`,
    [String(req.params.slug)]
  );
  if (rows.length === 0) return res.status(404).json({ error: "konten tidak ditemukan" });
  res.json(rows[0]);
});

export default router;
