import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, type Token, type User } from "../api";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
} from "../components/ui";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
  const [tokenUser, setTokenUser] = useState(0);
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser(newUser);
      setNewUser({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    setBusy(true);
    try {
      const r = await api.createToken(tokenUser, { name: tokenName || undefined });
      setFreshToken(r.token);
      setTokenName("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setBusy(true);
    try {
      await api.revokeToken(id);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="KONTROL AKSES" title="Admin" />

      <div className="space-y-8">
        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* Buat user */}
        <Card interactive={false} className="p-5">
          <h2 className="text-sm font-extrabold text-slate-600">Buat user</h2>
          <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nama">
              <Input placeholder="Nama" value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
            </Field>
            <Field label="Email">
              <Input type="email" placeholder="Email" value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
            </Field>
            <Field label="Unit kerja">
              <Input placeholder="Unit kerja" value={newUser.unit_kerja}
                onChange={(e) => setNewUser({ ...newUser, unit_kerja: e.target.value })} />
            </Field>
            <Field label="Password">
              <Input type="password" placeholder="Password" value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
            </Field>
            <label className="flex h-full items-end gap-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
                checked={newUser.is_admin}
                onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} />
              Admin
            </label>
            <div className="flex h-full items-end">
              <Button variant="primary" type="submit" disabled={busy}>Simpan</Button>
            </div>
          </form>
        </Card>

        {/* Generate token */}
        <Card interactive={false} className="p-5">
          <h2 className="text-sm font-extrabold text-slate-600">Generate token</h2>
          <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto]">
            <Field label="User">
              <Select value={tokenUser} onChange={(e) => setTokenUser(Number(e.target.value))}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </Select>
            </Field>
            <Field label="Nama token">
              <Input placeholder="Nama token" value={tokenName}
                onChange={(e) => setTokenName(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={createToken} disabled={busy}>Generate</Button>
          </div>
          {freshToken && (
            <div className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-slate-700">Simpan token ini — tidak akan tampil lagi:</p>
              <code className="mt-1 block break-all font-sans text-slate-800">{freshToken}</code>
            </div>
          )}
        </Card>

        {/* Token aktif */}
        <Card interactive={false} className="p-5">
          <h2 className="text-sm font-extrabold text-slate-600">Token aktif</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left">
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Nama</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">User</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Scope</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Batas/hari</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-3 py-2 text-slate-700">{t.name}</td>
                    <td className="px-3 py-2 text-slate-700">{t.email}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{t.scope}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{t.daily_limit}</td>
                    <td className="px-3 py-2">
                      {t.revoked_at
                        ? <span className="text-xs font-semibold text-red-600">revoked</span>
                        : <span className="text-xs font-semibold text-emerald-600">aktif</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!t.revoked_at && (
                        <button
                          className="text-xs font-bold text-red-600 underline underline-offset-2 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy}
                          onClick={() => revoke(t.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Log pemakaian */}
        <Card interactive={false} className="p-5">
          <h2 className="text-sm font-extrabold text-slate-600">Log pemakaian</h2>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left">
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Waktu</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Token</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Pertanyaan</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Latensi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-200 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{l.token_name}</td>
                    <td className="px-3 py-2 text-slate-700">{l.question}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{l.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
