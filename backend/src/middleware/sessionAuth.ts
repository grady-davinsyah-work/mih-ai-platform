import type { Request, Response, NextFunction } from "express";

export function loadSession(_req: Request, _res: Response, next: NextFunction) {
  next();
}
