import { pool } from "../src/db";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@kedeputian.go.id").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-me";
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, unit_kerja, password_hash, is_admin)
     VALUES ($1,$2,$3,$4,TRUE)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE
     RETURNING id, email`,
    ["Admin", email, "Kedeputian", hashPassword(password)]
  );
  console.log("admin siap:", rows[0].email);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
