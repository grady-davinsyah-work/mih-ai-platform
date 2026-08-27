import OpenAI from "openai";
import { config } from "../config";

const SYSTEM_PROMPT = [
  "Anda adalah asisten AI internal Kedeputian Perencanaan Makro Pembangunan.",
  "Jawab dalam Bahasa Indonesia, gunakan HANYA konteks yang diberikan.",
  "Jika konteks tidak cukup, jawab 'Saya tidak menemukan informasi tersebut dalam dokumen yang tersedia.'",
  "Wajib merujuk sumber dengan format [n] sesuai daftar konteks, contoh: 'Menurut [1] ...'.",
].join("\n");

export async function generateAnswer(question: string, context: string): Promise<string> {
  if (config.llmProvider === "mock") {
    return `Jawaban (mock) berdasarkan [1]: ${question}`;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const resp = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}

export async function* streamAnswer(question: string, context: string): AsyncGenerator<string> {
  if (config.llmProvider === "mock") {
    yield `Jawaban (mock) berdasarkan [1]: ${question}`;
    return;
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const stream = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` },
    ],
    stream: true,
  });
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
