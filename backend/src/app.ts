import express, { type NextFunction, type Request, type Response } from "express";
import { loadSession } from "./middleware/sessionAuth";
import askRoutes from "./routes/ask";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(loadSession);
  app.use("/api", askRoutes);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Express 5 meneruskan error dari handler async ke middleware berikut
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
