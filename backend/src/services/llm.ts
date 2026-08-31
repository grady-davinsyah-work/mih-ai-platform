import OpenAI from "openai";
import { config } from "../config";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT = [
  "Anda adalah asisten AI internal Kedeputian Perencanaan Makro Pembangunan.",
  "Jawab dalam Bahasa Indonesia, gunakan HANYA konteks yang diberikan.",
  "Jika konteks tidak cukup, jawab 'Saya tidak menemukan informasi tersebut dalam dokumen yang tersedia.'",
  "Wajib merujuk sumber dengan format [n] sesuai daftar konteks, contoh: 'Menurut [1] ...'.",
].join("\n");

export const COMPARISON_SYSTEM_PROMPT = [
  "Anda adalah asisten AI internal Kedeputian Perencanaan Makro Pembangunan.",
  "Jawab dalam Bahasa Indonesia, gunakan HANYA konteks yang diberikan.",
  "Jika konteks tidak cukup, jawab 'Saya tidak menemukan informasi tersebut dalam dokumen yang tersedia.'",
  "Wajib merujuk sumber dengan format [n] sesuai daftar konteks, contoh: 'Menurut [1] ...'.",
  "",
  "INSTRUKSI KHUSUS UNTUK PERTANYAAN PERBANDINGAN:",
  "Pertanyaan ini membandingkan beberapa dokumen/entitas. Anda HARUS:",
  "1. Identifikasi dokumen mana yang membahas setiap sisi perbandingan (lihat heading 'Dokumen' di konteks).",
  "2. Sajikan jawaban dalam format terstruktur: tabel perbandingan, daftar berurutan, atau poin-poin per aspek.",
  "3. Untuk setiap aspek, tampilkan nilai/keadaan dari KEDUA sisi dengan rujukan [n] ke konteks yang sesuai.",
  "4. Jika suatu aspek hanya ada di satu sisi, nyatakan secara eksplisit.",
  "5. Akhiri dengan ringkasan perbedaan utama.",
  "Contoh format:",
  "| Aspek | RKP 2026 [1] | RKP 2027 [3] |",
  "|-------|--------------|--------------|",
  "| Pertumbuhan | 5,1% [1] | 5,3% [3] |",
  "Atau gunakan daftar poin per aspek bila tabel tidak cocok.",
].join("\n");

export function selectSystemPrompt(isComparison: boolean): string {
  return isComparison ? COMPARISON_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

export async function generateAnswer(
  question: string,
  context: string,
  history: ChatTurn[] = [],
  isComparison: boolean = false
): Promise<string> {
  if (config.llmProvider === "mock") {
    return `Jawaban (mock) berdasarkan [1]: ${question}`;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const model =
    isComparison && config.comparisonModel ? config.comparisonModel : config.openaiModel;
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: selectSystemPrompt(isComparison) },
      ...history,
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}

export async function* streamAnswer(
  question: string,
  context: string,
  history: ChatTurn[] = [],
  isComparison: boolean = false
): AsyncGenerator<string> {
  if (config.llmProvider === "mock") {
    yield `Jawaban (mock) berdasarkan [1]: ${question}`;
    return;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const model =
    isComparison && config.comparisonModel ? config.comparisonModel : config.openaiModel;
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: selectSystemPrompt(isComparison) },
      ...history,
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
    stream: true,
  });
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
