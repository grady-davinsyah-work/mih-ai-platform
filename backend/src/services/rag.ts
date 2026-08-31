import { pool } from "../db";
import { config } from "../config";
import { generateAnswer, streamAnswer } from "./llm";
import { embedTexts } from "./embeddings";

export interface Citation {
  label: number;
  document_id: number;
  filename: string;
  file_type: string;
  page_or_slide: number | null;
  section_title: string | null;
}

export interface SearchRow {
  document_id: number;
  filename: string;
  file_type: string;
  page_or_slide: number | null;
  section_title: string | null;
  label: number;
}

export function extractCitedIndices(answer: string): Set<number> {
  const set = new Set<number>();
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) set.add(Number(m[1]));
  return set;
}

const RAG_WEBHOOK_TIMEOUT_MS = 30_000;

async function searchLocal(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  const [qv] = await embedTexts([question]);
  const { rows } = await pool.query(
    `SELECT c.id, c.content, c.page_or_slide, c.section_title,
            d.id AS document_id, d.filename, d.file_type
       FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.is_outdated = FALSE AND d.status = 'completed'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [JSON.stringify(qv), config.vectorK]
  );
  const labeled = rows.map((r, i) => ({ ...r, label: i + 1 }));
  const context = labeled
    .map((r) =>
      `[${r.label}] (File: ${r.filename}, ${r.file_type}` +
      (r.page_or_slide != null ? `, halaman/slide ${r.page_or_slide}` : "") +
      (r.section_title ? `, Bagian: ${r.section_title}` : "") + `)\n${r.content}`
    )
    .join("\n\n---\n\n");
  return { labeled, context };
}

export async function searchViaWebhook(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_WEBHOOK_TIMEOUT_MS);
  try {
    const resp = await fetch(config.ragWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, vector_k: config.vectorK }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`n8n rag webhook HTTP ${resp.status}`);
    const data = (await resp.json()) as { labeled?: SearchRow[]; context?: string };
    if (!Array.isArray(data.labeled) || typeof data.context !== "string")
      throw new Error("n8n rag webhook: format response tidak valid");
    return { labeled: data.labeled, context: data.context };
  } finally {
    clearTimeout(timer);
  }
}

export async function search(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  if (config.ragWebhookUrl) {
    try {
      return await searchViaWebhook(question);
    } catch (err) {
      console.warn("n8n rag webhook gagal, fallback ke query lokal:", (err as Error).message);
    }
  }
  return searchLocal(question);
}

export async function ask(question: string): Promise<{ answer: string; citations: Citation[] }> {
  const { labeled, context } = await search(question);
  const answer = await generateAnswer(question, context);
  const cited = extractCitedIndices(answer);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      label: r.label,
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  return { answer, citations };
}

export async function* askStream(question: string): AsyncGenerator<{ delta: string } | { citations: Citation[] }> {
  const { labeled, context } = await search(question);
  let text = "";
  for await (const delta of streamAnswer(question, context)) {
    text += delta;
    yield { delta };
  }
  const cited = extractCitedIndices(text);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      label: r.label,
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  yield { citations };
}
