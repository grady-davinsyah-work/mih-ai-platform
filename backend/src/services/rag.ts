import { pool } from "../db";
import { config } from "../config";
import { generateAnswer, streamAnswer, type ChatTurn } from "./llm";
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

// Deteksi pertanyaan perbandingan/ber-entities ganda agar retriever
// mengambil konteks dari KEDUA sisi (mis. "RKP 2026 dan 2027").
const COMPARISON_RE =
  /(?:perbandingan|bandingkan|membandingkan|dibanding(?:kan)?|vs\.?|versus|perbedaan|selisih)/i;

export function extractYears(question: string): Set<number> {
  const set = new Set<number>();
  for (const m of question.matchAll(/\b(19|20)\d{2}\b/g)) set.add(Number(m[0]));
  return set;
}

export function isComparisonQuery(question: string): boolean {
  return COMPARISON_RE.test(question) || extractYears(question).size >= 2;
}

function capPerDocument(rows: any[], maxPerDoc: number): any[] {
  const perDoc = new Map<number, number>();
  const out: any[] = [];
  for (const r of rows) {
    const doc = Number(r.document_id);
    const n = perDoc.get(doc) ?? 0;
    if (n < maxPerDoc) {
      out.push(r);
      perDoc.set(doc, n + 1);
    }
  }
  return out;
}

const RAG_WEBHOOK_TIMEOUT_MS = 30_000;

async function searchLocal(question: string): Promise<{ labeled: SearchRow[]; context: string }> {
  const [qv] = await embedTexts([question]);
  const SELECT = `SELECT c.id, c.content, c.page_or_slide, c.section_title,
                         d.id AS document_id, d.filename, d.file_type
                    FROM chunks c JOIN documents d ON d.id = c.document_id
                   WHERE c.is_outdated = FALSE AND d.status = 'completed'`;
  let rows: any[];
  if (isComparisonQuery(question)) {
    // Perbandingan: cari lebih luas, ragamkan per dokumen, lalu jamin tiap
    // tahun/entitas yang disebut (mis. RKP 2026 & 2027) punya chunk sendiri.
    const { rows: wide } = await pool.query(
      `${SELECT} ORDER BY c.embedding <=> $1::vector LIMIT $2`,
      [JSON.stringify(qv), config.vectorK + 6]
    );
    rows = capPerDocument(wide, 3);
    const seen = new Set<number>(rows.map((r) => r.id));
    for (const year of extractYears(question)) {
      const { rows: docs } = await pool.query(
        `SELECT id FROM documents
          WHERE status = 'completed' AND filename ILIKE '%' || $1::text || '%' LIMIT 3`,
        [String(year)]
      );
      for (const d of docs) {
        const { rows: extra } = await pool.query(
          `${SELECT} AND c.document_id = $2 ORDER BY c.embedding <=> $1::vector LIMIT 2`,
          [JSON.stringify(qv), d.id]
        );
        for (const r of extra) if (!seen.has(r.id)) {
          seen.add(r.id);
          rows.push(r);
        }
      }
    }
    rows = rows.slice(0, config.vectorK + 2 * extractYears(question).size);
  } else {
    const { rows: top } = await pool.query(
      `${SELECT} ORDER BY c.embedding <=> $1::vector LIMIT $2`,
      [JSON.stringify(qv), config.vectorK]
    );
    rows = top;
  }
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

export async function ask(
  question: string,
  history: ChatTurn[] = []
): Promise<{ answer: string; citations: Citation[] }> {
  const { labeled, context } = await search(question);
  const answer = await generateAnswer(question, context, history);
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

export async function* askStream(
  question: string,
  history: ChatTurn[] = []
): AsyncGenerator<{ delta: string } | { citations: Citation[] }> {
  const { labeled, context } = await search(question);
  let text = "";
  for await (const delta of streamAnswer(question, context, history)) {
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
