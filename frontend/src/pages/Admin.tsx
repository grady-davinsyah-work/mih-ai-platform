import { useEffect, useState } from "react";
import { api, type Token, type User } from "../api";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
  const [tokenUser, setTokenUser] = useState(0);
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);

  async function load() {
    try {
      const [u, t, l] = await Promise.all([api.users(), api.tokens(), api.usageLogs()]);
      setUsers(u); setTokens(t); setLogs(l);
      if (!tokenUser && u.length) setTokenUser(u[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    await api.createUser(newUser);
    setNewUser({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
    load();
  }

  async function createToken() {
    const r = await api.createToken(tokenUser, { name: tokenName || undefined });
    setFreshToken(r.token);
    setTokenName("");
    load();
  }

  async function revoke(id: number) {
    await api.revokeToken(id);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Buat user</h2>
        <form onSubmit={createUser} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Nama" value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
          <input className="rounded border px-3 py-2" type="email" placeholder="Email" value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          <input className="rounded border px-3 py-2" placeholder="Unit kerja" value={newUser.unit_kerja}
            onChange={(e) => setNewUser({ ...newUser, unit_kerja: e.target.value })} />
          <input className="rounded border px-3 py-2" type="password" placeholder="Password" value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newUser.is_admin}
              onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} />
            Admin
          </label>
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Simpan</button>
        </form>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Generate token</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            User
            <select className="ml-2 rounded border px-2 py-1" value={tokenUser} onChange={(e) => setTokenUser(Number(e.target.value))}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </label>
          <input className="rounded border px-3 py-1" placeholder="Nama token" value={tokenName}
            onChange={(e) => setTokenName(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-1 text-white hover:bg-blue-700" onClick={createToken}>Generate</button>
        </div>
        {freshToken && (
          <div className="mt-3 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm">
            <p className="font-semibold">Simpan token ini — tidak akan tampil lagi:</p>
            <code className="mt-1 block break-all">{freshToken}</code>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Token aktif</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b text-left"><th>Nama</th><th>User</th><th>Scope</th><th>Batas/hari</th><th>Status</th><th /></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-b">
                <td>{t.name}</td><td>{t.email}</td><td>{t.scope}</td>
                <td>{t.daily_limit}</td>
                <td>{t.revoked_at ? <span className="text-red-600">revoked</span> : <span className="text-green-600">aktif</span>}</td>
                <td>{!t.revoked_at && <button className="text-red-600 underline" onClick={() => revoke(t.id)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Log pemakaian</h2>
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th>Waktu</th><th>Token</th><th>Pertanyaan</th><th>Latensi</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.token_name}</td>
                  <td>{l.question}</td>
                  <td>{l.latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
