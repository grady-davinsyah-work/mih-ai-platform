const sessionSecret = process.env.SESSION_SECRET ?? "";
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET harus berupa string acak minimal 32 karakter");
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://mih:mih@localhost:5432/mih",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1536),
  sessionSecret,
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? "/data",
  vectorK: Number(process.env.VECTOR_K ?? 8),
  llmProvider: process.env.LLM_PROVIDER ?? "openai", // "openai" | "mock"
};
