import { Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { askAuth } from "../middleware/tokenAuth";
import { ask } from "../services/rag";

const router = Router();

router.post("/ask", askAuth, async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) return res.status(400).json({ error: "question required" });

  const started = Date.now();
  const result = await ask(question);
  const latency_ms = Date.now() - started;

  await pool.query(
    `INSERT INTO usage_logs (token_id, user_id, question, answer, cited_chunks, model, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.auth!.tokenId,
      req.auth!.userId,
      question,
      result.answer,
      JSON.stringify(result.citations),
      config.openaiModel,
      latency_ms,
    ]
  );
  res.json(result);
});

export default router;
