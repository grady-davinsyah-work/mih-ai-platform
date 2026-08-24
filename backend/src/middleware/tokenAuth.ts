import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { hashToken } from "../lib/token";
import { getTodayUsage } from "../lib/rateLimit";

type AuthResult =
  | { auth: { tokenId: number; userId: number; scope: string } }
  | { error: { status: number; message: string } };

// Validasi Bearer API token. Mengembalikan null bila header Authorization tidak
// ada (bukan kegagalan auth), objek auth bila token valid, atau objek error bila
// token invalid/dicabut/kedaluwarsa/melewati batas harian.
async function resolveBearerToken(req: Request): Promise<AuthResult | null> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { rows } = await pool.query(
    `SELECT id, user_id, scope, daily_limit, expires_at, revoked_at
       FROM api_tokens WHERE token_hash = $1`,
    [hashToken(token)]
  );
  const t = rows[0];
  if (!t) return { error: { status: 401, message: "invalid token" } };
  if (t.revoked_at) return { error: { status: 403, message: "token revoked" } };
  if (t.expires_at && new Date(t.expires_at) < new Date())
    return { error: { status: 403, message: "token expired" } };

  const used = await getTodayUsage(t.id);
  if (used >= t.daily_limit) return { error: { status: 429, message: "daily limit reached" } };

  await pool.query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1", [t.id]);
  return { auth: { tokenId: t.id, userId: t.user_id, scope: t.scope } };
}

export async function tokenAuth(req: Request, res: Response, next: NextFunction) {
  const result = await resolveBearerToken(req);
  if (result === null) return res.status(401).json({ error: "missing token" });
  if ("error" in result) return res.status(result.error.status).json({ error: result.error.message });
  req.auth = result.auth;
  next();
}

// Untuk /api/ask: terima API token (klien programatik) ATAU sesi login staf
// (Playground). tokenId diisi null saat akses lewat sesi.
export async function askAuth(req: Request, res: Response, next: NextFunction) {
  const result = await resolveBearerToken(req);
  if (result !== null) {
    if ("error" in result) return res.status(result.error.status).json({ error: result.error.message });
    req.auth = result.auth;
    return next();
  }
  if (req.session?.userId) {
    req.auth = { tokenId: null, userId: req.session.userId, scope: "session" };
    return next();
  }
  return res.status(401).json({ error: "missing token" });
}
