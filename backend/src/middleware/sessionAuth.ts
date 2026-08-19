import type { Request, Response, NextFunction } from "express";
import { decodeSession, encodeSession } from "../lib/session";

export const SESSION_COOKIE = "mih_session";

function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie ?? "";
  const found = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return found ? found.slice(SESSION_COOKIE.length + 1) : undefined;
}

export function loadSession(req: Request, _res: Response, next: NextFunction) {
  req.session = decodeSession(readCookie(req)) ?? {};
  next();
}

export function setSession(req: Request, res: Response, payload: Record<string, unknown>) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeSession(payload)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
  );
  req.session = payload;
}

export function clearSession(req: Request, res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  req.session = {};
}

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "not logged in" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "not logged in" });
  if (!req.session?.isAdmin) return res.status(403).json({ error: "admin only" });
  next();
}
