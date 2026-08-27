import { readFileSync } from "node:fs";
import { Pool } from "pg";

export const testDb = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ?? "postgres://mih:mih@localhost:5432/mih_test",
});

export async function applySchema() {
  const sql = readFileSync(new URL("../../db/init.sql", import.meta.url), "utf8");
  await testDb.query(sql);
}

export async function truncateAll() {
  await testDb.query(
    "TRUNCATE usage_logs, api_tokens, chunks, documents, messages, conversations, users RESTART IDENTITY CASCADE"
  );
}
