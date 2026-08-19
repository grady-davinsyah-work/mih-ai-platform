import OpenAI from "openai";
import { config } from "../config";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (config.llmProvider === "mock") {
    return texts.map(() => Array.from({ length: config.embeddingDim }, () => 0));
  }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const resp = await client.embeddings.create({ model: config.embeddingModel, input: batch });
    out.push(...resp.data.map((d) => d.embedding));
  }
  return out;
}
