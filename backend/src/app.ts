import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";
import askRoutes from "./routes/ask";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.use("/api", askRoutes);
  app.use("/api", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Express 5 meneruskan error dari handler async ke middleware berikut
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const status =
      err.status ??
      err.statusCode ??
      (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
    res.status(status).json({ error: "internal server error" });
  });
  return app;
}
