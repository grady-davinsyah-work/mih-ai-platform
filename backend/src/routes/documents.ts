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

// Graph relasi antar dokumen: semantik (cosine antar centroid embedding) +
// ko-kutipan (dokumen yang dikutip bersamaan dalam jawaban Playground).
// Hitung on-the-fly — 92 dokumen ≈ 4 ribu pasangan, sepele untuk Postgres.
router.get("/documents/graph", requireLogin, async (req, res) => {
  const minSem = Math.min(Math.max(Number(req.query.min_semantic) || 0.5, 0), 1);

  const { rows: nodes } = await pool.query(
    `SELECT d.id, d.filename, d.file_type, d.source, d.chunk_count
       FROM documents d
      WHERE d.status = 'completed'
        AND EXISTS (SELECT 1 FROM chunks c WHERE c.document_id = d.id AND c.is_outdated = FALSE)
      ORDER BY d.id`
  );

  const { rows: edges } = await pool.query(
    `WITH centroids AS (
       SELECT document_id, avg(embedding) AS centroid
         FROM chunks WHERE is_outdated = FALSE
        GROUP BY document_id
     ),
     sem_edges AS (
       SELECT a_id, b_id, sem FROM (
         SELECT a.document_id AS a_id, b.document_id AS b_id,
                1 - (a.centroid <=> b.centroid) AS sem,
                ROW_NUMBER() OVER (PARTITION BY a.document_id ORDER BY a.centroid <=> b.centroid) AS ra,
                ROW_NUMBER() OVER (PARTITION BY b.document_id ORDER BY a.centroid <=> b.centroid) AS rb
           FROM centroids a CROSS JOIN centroids b
          WHERE a.document_id < b.document_id
       ) r WHERE sem >= $1 AND (ra <= 5 OR rb <= 5)
     ),
     cit_edges AS (
       SELECT (a.value->>'document_id')::bigint AS a_id,
              (b.value->>'document_id')::bigint AS b_id,
              COUNT(*) AS w
         FROM (
           SELECT citations FROM messages WHERE role = 'assistant'
           UNION ALL SELECT cited_chunks AS citations FROM usage_logs
         ) src,
         jsonb_array_elements(src.citations) a,
         jsonb_array_elements(src.citations) b
        WHERE (a.value->>'document_id')::bigint < (b.value->>'document_id')::bigint
        GROUP BY 1, 2
     )
     SELECT COALESCE(s.a_id, c.a_id) AS source,
            COALESCE(s.b_id, c.b_id) AS target,
            s.sem AS semantic,
            c.w AS citations
       FROM sem_edges s
       FULL OUTER JOIN cit_edges c ON c.a_id = s.a_id AND c.b_id = s.b_id`,
    [minSem]
  );

  res.json({ nodes, edges });
});

export default router;
