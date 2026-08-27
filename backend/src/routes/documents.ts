import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db";
import { requireLogin } from "../middleware/sessionAuth";

const router = Router();

// Unduh file mentah dokumen (dipakai tautan rujukan/citation di Playground).
router.get("/documents/:id/file", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });

  const { rows } = await pool.query(
    `SELECT filename, file_path FROM documents WHERE id=$1`,
    [id]
  );
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "dokumen tidak ditemukan" });

  let data: Buffer;
  try {
    data = await fs.readFile(doc.file_path);
  } catch {
    return res.status(404).json({ error: "file tidak ditemukan di server" });
  }

  // filename asli (bisa non-ASCII) via RFC 5987; fallback ASCII utk klien lama.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(doc.file_path).replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(data);
});

export default router;
