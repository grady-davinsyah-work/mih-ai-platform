import { Router } from "express";
import { pool } from "../db";
import { hashPassword } from "../lib/passwords";
import { generateToken, hashToken } from "../lib/token";
import { requireLogin, requireAdmin } from "../middleware/sessionAuth";

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
      [String(name), String(email).toLowerCase(), String(unit_kerja ?? ""), hashPassword(String(password)), Boolean(is_admin)]
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
  await pool.query("UPDATE api_tokens SET revoked_at = now() WHERE id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
});

export default router;
