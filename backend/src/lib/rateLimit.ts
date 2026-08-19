import { pool } from "../db";

export async function getTodayUsage(tokenId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM usage_logs
      WHERE token_id = $1 AND created_at >= date_trunc('day', now())`,
    [tokenId]
  );
  return rows[0].n;
}
