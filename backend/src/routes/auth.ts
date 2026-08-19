import { Router } from "express";
import { pool } from "../db";
import { verifyPassword } from "../lib/passwords";
import { setSession, clearSession, requireLogin } from "../middleware/sessionAuth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin, password_hash FROM users WHERE email=$1",
    [email]
  );
  const u = rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) {
    return res.status(401).json({ error: "email atau password salah" });
  }
  setSession(req, res, { userId: u.id, isAdmin: u.is_admin });
  res.json({
    user: { id: u.id, name: u.name, email: u.email, unit_kerja: u.unit_kerja, is_admin: u.is_admin },
  });
});

router.post("/auth/logout", (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

router.get("/auth/me", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, email, unit_kerja, is_admin FROM users WHERE id=$1",
    [req.session!.userId]
  );
  res.json({ user: rows[0] });
});

export default router;
