import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { hashToken } from "../lib/token";
import { getTodayUsage } from "../lib/rateLimit";

export async function tokenAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });

  const { rows } = await pool.query(
    `SELECT id, user_id, scope, daily_limit, expires_at, revoked_at
       FROM api_tokens WHERE token_hash = $1`,
    [hashToken(token)]
  );
  const t = rows[0];
  if (!t) return res.status(401).json({ error: "invalid token" });
  if (t.revoked_at) return res.status(403).json({ error: "token revoked" });
  if (t.expires_at && new Date(t.expires_at) < new Date())
    return res.status(403).json({ error: "token expired" });

  const used = await getTodayUsage(t.id);
  if (used >= t.daily_limit) return res.status(429).json({ error: "daily limit reached" });

  await pool.query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1", [t.id]);
  req.auth = { tokenId: t.id, userId: t.user_id, scope: t.scope };
  next();
}
