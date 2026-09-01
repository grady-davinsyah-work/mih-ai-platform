import { Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { requireLogin } from "../middleware/sessionAuth";
import { askAuth } from "../middleware/tokenAuth";
import { askStream } from "../services/rag";
import type { ChatTurn } from "../services/llm";

const router = Router();

router.get("/conversations", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.updated_at,
            (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC`,
    [req.session!.userId]
  );
  res.json(rows);
});

router.post("/conversations", requireLogin, async (req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO conversations (user_id) VALUES ($1) RETURNING id",
    [req.session!.userId]
  );
  res.status(201).json({ id: rows[0].id });
});

router.delete("/conversations/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  const { rowCount } = await pool.query(
    "DELETE FROM conversations WHERE id=$1 AND user_id=$2",
    [id, req.session!.userId]
  );
  if (!rowCount) return res.status(404).json({ error: "percakapan tidak ditemukan" });
  res.json({ ok: true });
});

router.get("/conversations/:id/messages", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id tidak valid" });
  const owns = await pool.query(
    "SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2",
    [id, req.session!.userId]
  );
  if ((owns.rowCount ?? 0) === 0)
    return res.status(404).json({ error: "percakapan tidak ditemukan" });
  const { rows } = await pool.query(
    `SELECT id, role, content, citations, created_at
       FROM messages WHERE conversation_id=$1 ORDER BY id`,
    [id]
  );
  res.json(rows);
});

router.post("/chat", askAuth, async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) return res.status(400).json({ error: "question required" });
  const userId = req.auth!.userId;

  let conversationId = Number(req.body?.conversation_id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    const created = await pool.query(
      "INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id",
      [userId, question.slice(0, 50)]
    );
    conversationId = created.rows[0].id;
  } else {
    const owns = await pool.query(
      "SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );
    if ((owns.rowCount ?? 0) === 0)
      return res.status(404).json({ error: "percakapan tidak ditemukan" });
  }

  // Konteks percakapan: N pesan terakhir jadi memori LLM (retrieval tetap
  // berpusat pada pertanyaan saat ini).
  const { rows: historyRows } = await pool.query(
    `SELECT role, content FROM messages
      WHERE conversation_id = $1 AND role IN ('user','assistant')
      ORDER BY id DESC LIMIT $2`,
    [conversationId, config.chatHistoryTurns]
  );
  const history = historyRows
    .reverse()
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

  // Nomor sitasi [n] di pesan lama merujuk chunk konteks yang BERBEDA dari
  // turn ini; ganti jadi (n) agar LLM tidak mengira itu rujukan konteks aktif.
  const cleanHistory: ChatTurn[] = history.map((turn) => ({
    ...turn,
    content: turn.role === "assistant" ? turn.content.replace(/\[(\d+)\]/g, "($1)") : turn.content,
  }));

  await pool.query(
    "INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)",
    [conversationId, question]
  );
  await pool.query(
    "UPDATE conversations SET title = $2, updated_at = now() WHERE id = $1 AND title = ''",
    [conversationId, question.slice(0, 50)]
  );

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  const write = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  write("meta", { conversation_id: conversationId });

  let answer = "";
  const started = Date.now();
  try {
    for await (const part of askStream(question, cleanHistory)) {
      if ("delta" in part) {
        answer += part.delta;
        write("delta", { text: part.delta });
      } else {
        await pool.query(
          `INSERT INTO usage_logs (token_id, user_id, question, answer, cited_chunks, model, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.auth!.tokenId,
            req.auth!.userId,
            question,
            answer,
            JSON.stringify(part.citations),
            config.openaiModel,
            Date.now() - started,
          ]
        );
        await pool.query(
          "INSERT INTO messages (conversation_id, role, content, citations) VALUES ($1,'assistant',$2,$3)",
          [conversationId, answer, JSON.stringify(part.citations)]
        );
        await pool.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [conversationId]);
        write("citations", { citations: part.citations });
      }
    }
    write("done", {});
  } catch (err: any) {
    write("error", { message: err.message ?? "internal server error" });
  } finally {
    res.end();
  }
});

export default router;
