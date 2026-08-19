import { pool } from "../src/db";
import { hashPassword } from "../src/lib/passwords";

const base = "http://localhost:3000";
const email = (process.env.ADMIN_EMAIL ?? "admin@kedeputian.go.id").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "change-me";
const SAMPLE = "paparan-rencana.pptx";

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("ok:", msg);
}

async function main() {
  // 1) seed admin (idempotent)
  await pool.query(
    `INSERT INTO users (name,email,unit_kerja,password_hash,is_admin)
     VALUES ('Admin',$1,'Kedeputian',$2,TRUE)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE`,
    [email, hashPassword(password)]
  );
  console.log("ok: admin seed");

  // 2) login
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(login.status === 200, "login admin");
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  // 3) buat token
  const users = (await (await fetch(`${base}/api/admin/users`, { headers: { Cookie: cookie } })).json()) as any[];
  const uid = users[0].id;
  const created = (await (await fetch(`${base}/api/admin/users/${uid}/tokens`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "smoke" }),
  })).json()) as { token: string };
  assert(created.token?.startsWith("mih_"), "token dibuat");

  // 4) tunggu ingestion sampel selesai
  const deadline = Date.now() + 120_000;
  let sample: any = null;
  while (Date.now() < deadline) {
    const docs = (await (await fetch(`${base}/api/admin/documents`, { headers: { Cookie: cookie } })).json()) as any[];
    sample = docs.find((d: any) => d.filename === SAMPLE) ?? null;
    if (sample?.status === "completed") break;
    if (sample?.status === "failed") { console.error("FAIL: ingest gagal:", sample.error_message); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert(sample !== null, `sampel ${SAMPLE} terdaftar`);
  assert(sample.status === "completed", "sampel ter-ingest");
  assert(sample.chunk_count > 0, "chunk > 0");

  // 5) tanya-jawab
  const ask = (await (await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${created.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Apa prioritas rencana pembangunan makro?" }),
  })).json()) as any;
  assert(ask.answer?.length > 0, "ada jawaban");
  assert(Array.isArray(ask.citations) && ask.citations.length > 0, "ada sitasi sumber");

  console.log("SMOKE PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
