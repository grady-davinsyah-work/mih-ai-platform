import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import multer from "multer";
import { pool } from "../db";
import { hashPassword } from "../lib/passwords";
import { generateToken, hashToken } from "../lib/token";
import { requireLogin, requireAdmin } from "../middleware/sessionAuth";
import { config } from "../config";

const router = Router();

// ---- users ----
router.get("/users", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin, created_at FROM users ORDER BY id"
  );
  res.json(rows);
});

router.post("/users", requireAdmin, async (req, res) => {
  const { name, email, unit_kerja, password, is_admin } = req.body ?? {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, dan password wajib" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, unit_kerja, password_hash, is_admin)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, unit_kerja, is_admin`,
      [String(name), String(email).toLowerCase(), String(unit_kerja ?? ""), hashPassword(String(password)), is_admin === true || is_admin === "true"]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ error: "email sudah terdaftar" });
    throw e;
  }
});

// ---- api tokens ----
router.post("/users/:id/tokens", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "id tidak valid" });
  const token = generateToken();
  await pool.query(
    `INSERT INTO api_tokens (user_id, name, token_hash, scope, daily_limit, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      userId,
      String(req.body?.name ?? "default"),
      hashToken(token),
      String(req.body?.scope ?? "internal-read"),
      Number(req.body?.daily_limit ?? 100),
      req.body?.expires_at ? new Date(req.body.expires_at) : null,
    ]
  );
  res.status(201).json({ token, note: "Simpan token ini — tidak akan ditampilkan lagi." });
});

router.get("/tokens", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.user_id, u.email, t.name, t.scope, t.daily_limit,
            t.expires_at, t.revoked_at, t.last_used_at, t.created_at
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      ORDER BY t.id`
  );
  res.json(rows);
});

router.post("/tokens/:id/revoke", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  await pool.query("UPDATE api_tokens SET revoked_at = now() WHERE id=$1", [id]);
  res.json({ ok: true });
});

router.get("/usage-logs", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.created_at, l.question, l.latency_ms,
            COALESCE(t.name, u.name) AS token_name
       FROM usage_logs l
       LEFT JOIN api_tokens t ON t.id = l.token_id
       LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.id DESC LIMIT 200`
  );
  res.json(rows);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ---- documents ----
router.get("/documents", requireLogin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, filename, file_type, file_extension, status, error_message, chunk_count,
            created_at, updated_at FROM documents ORDER BY id DESC`
  );
  res.json(rows);
});

router.post("/documents", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file wajib" });
  const buf = req.file.buffer;
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
  if (!["pptx", "pdf", "docx"].includes(ext))
    return res.status(400).json({ error: "hanya pptx/pdf/docx" });

  const hash = sha256(buf);
  const dup = await pool.query("SELECT 1 FROM documents WHERE sha256=$1", [hash]);
  if ((dup.rowCount ?? 0) > 0)
    return res.status(409).json({ error: "dokumen sudah ada (duplikat)" });

  const fileType = req.body.file_type || (ext === "pptx" ? "paparan" : "laporan");
  const dir = path.join(config.dataDir, "uploaded");
  await fs.mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
  const filePath = path.join(dir, safeName);
  await fs.writeFile(filePath, buf);

  const { rows } = await pool.query(
    `INSERT INTO documents (filename, file_type, file_extension, sha256, file_path, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id, filename, file_type, status`,
    [req.file.originalname, fileType, ext, hash, filePath]
  );
  res.status(201).json(rows[0]);
});

router.post("/documents/:id/retry", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  const { rows } = await pool.query(
    `UPDATE documents SET status='pending', error_message=NULL, updated_at=now()
      WHERE id=$1 AND status='failed' RETURNING id, filename, status`,
    [id]
  );
  if (rows.length === 0) return res.status(400).json({ error: "hanya dokumen gagal yang bisa diulang" });
  res.json(rows[0]);
});

export default router;
