import { pool } from "../db";
import { config } from "../config";
import { generateAnswer } from "./llm";
import { embedTexts } from "./embeddings";

export interface Citation {
  document_id: number;
  filename: string;
  file_type: string;
  page_or_slide: number | null;
  section_title: string | null;
}

export function extractCitedIndices(answer: string): Set<number> {
  const set = new Set<number>();
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) set.add(Number(m[1]));
  return set;
}

export async function ask(question: string): Promise<{ answer: string; citations: Citation[] }> {
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

  const answer = await generateAnswer(question, context);
  const cited = extractCitedIndices(answer);
  const citations: Citation[] = labeled
    .filter((r) => cited.has(r.label))
    .map((r) => ({
      document_id: r.document_id,
      filename: r.filename,
      file_type: r.file_type,
      page_or_slide: r.page_or_slide,
      section_title: r.section_title,
    }));
  return { answer, citations };
}
