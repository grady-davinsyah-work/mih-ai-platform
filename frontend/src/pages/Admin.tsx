import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, type ContentItem, type Token, type User } from "../api";
import { RichTextEditor } from "../components/RichTextEditor";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
} from "../components/ui";
import {
  Button as FButton,
  Checkbox as FCheckbox,
  Dialog as FDialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown as FDropdown,
  Field as FField,
  FluentProvider,
  Input as FInput,
  Option as FOption,
  Textarea as FTextarea,
  webLightTheme,
} from "@fluentui/react-components";

interface ContentForm {
  type: "news" | "publication";
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  author: string;
  date: string;
  contentText: string;
  document_url: string;
  document_name: string;
  galleryText: string;
  is_published: boolean;
}

const EMPTY_CONTENT_FORM: ContentForm = {
  type: "news",
  slug: "",
  title: "",
  excerpt: "",
  image: "",
  category: "",
  author: "",
  date: "",
  contentText: "",
  document_url: "",
  document_name: "",
  galleryText: "",
  is_published: true,
};

function splitLines(s: string): string[] {
  return s.split("\n").map((l) => l.trim()).filter(Boolean);
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
  const [tokenUser, setTokenUser] = useState(0);
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [showContentForm, setShowContentForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [contentForm, setContentForm] = useState<ContentForm>(EMPTY_CONTENT_FORM);

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

  async function loadContents() {
    try {
      setContents(await api.adminContent());
    } catch (err: any) {
      setError(err.message);
    }
  }
  useEffect(() => { loadContents(); }, []);

  function openCreate() {
    setEditingId(null);
    setContentForm(EMPTY_CONTENT_FORM);
    setShowContentForm(true);
  }

  function openEdit(c: ContentItem) {
    setEditingId(c.id);
    setContentForm({
      type: c.type,
      slug: c.slug,
      title: c.title,
      excerpt: c.excerpt,
      image: c.image,
      category: c.category,
      author: c.author,
      date: c.date,
      contentText: c.content ?? "",
      document_url: c.document_url,
      document_name: c.document_name,
      galleryText: (c.gallery ?? []).join("\n"),
      is_published: c.is_published,
    });
    setShowContentForm(true);
  }

  async function saveContent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        type: contentForm.type,
        slug: contentForm.slug,
        title: contentForm.title,
        excerpt: contentForm.excerpt,
        image: contentForm.image,
        category: contentForm.category,
        author: contentForm.author,
        date: contentForm.date,
        content: contentForm.contentText,
        document_url: contentForm.document_url,
        document_name: contentForm.document_name,
        gallery: splitLines(contentForm.galleryText),
        is_published: contentForm.is_published,
      };
      if (editingId === null) await api.createContent(payload);
      else await api.updateContent(editingId, payload);
      setShowContentForm(false);
      loadContents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeContent(c: ContentItem) {
    if (!window.confirm(`Hapus konten "${c.title}"?`)) return;
    setBusy(true);
    try {
      await api.deleteContent(c.id);
      loadContents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser(newUser);
      setNewUser({ name: "", email: "", unit_kerja: "", password: "", is_admin: false });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openEditUser(u: User) {
    setEditingUserId(u.id);
    setUserForm({ name: u.name, email: u.email, unit_kerja: u.unit_kerja, password: "", is_admin: u.is_admin });
  }

  function cancelEditUser() {
    setEditingUserId(null);
  }

  async function saveUser(e: FormEvent) {
    e.preventDefault();
    if (editingUserId === null) return;
    setBusy(true);
    try {
      await api.updateUser(editingUserId, { ...userForm, password: userForm.password || undefined });
      setEditingUserId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(u: User) {
    if (!window.confirm(`Hapus user "${u.name}" (${u.email})?`)) return;
    setBusy(true);
    try {
      await api.deleteUser(u.id);
      load();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setBusy(true);
    try {
      await api.revokeToken(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="KONTROL AKSES" title="Admin" />

      <div className="space-y-8">
        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* Kelola konten publik */}
        <Card interactive={false} className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-600">Kelola Konten Publik</h2>
            <Button variant="primary" onClick={openCreate} disabled={busy}>Tambah Konten</Button>
          </div>

          {showContentForm && (
            <FluentProvider theme={webLightTheme}>
              <FDialog open onOpenChange={(_, d) => setShowContentForm(d.open)}>
                <DialogSurface>
                  <form onSubmit={saveContent}>
                    <DialogBody>
                      <DialogTitle>{editingId === null ? "Tambah Konten" : "Edit Konten"}</DialogTitle>
                      <DialogContent className="grid gap-4 sm:grid-cols-2">
                        <FField label="Jenis" required>
                          <FDropdown value={contentForm.type}
                            onOptionSelect={(_, d) => setContentForm({ ...contentForm, type: d.optionValue as "news" | "publication" })}>
                            <FOption value="news">Berita</FOption>
                            <FOption value="publication">Publikasi</FOption>
                          </FDropdown>
                        </FField>
                        <FField label="Slug" required>
                          <FInput placeholder="contoh: berita-triwulan-iii" value={contentForm.slug}
                            onChange={(_, d) => setContentForm({ ...contentForm, slug: d.value })} />
                        </FField>
                        <FField label="Judul" required>
                          <FInput placeholder="Judul" value={contentForm.title}
                            onChange={(_, d) => setContentForm({ ...contentForm, title: d.value })} />
                        </FField>
                        <FField label="Kategori">
                          <FInput placeholder="Berita, Pengumuman, ..." value={contentForm.category}
                            onChange={(_, d) => setContentForm({ ...contentForm, category: d.value })} />
                        </FField>
                        <FField label="Ringkasan" className="sm:col-span-2">
                          <FTextarea rows={2} placeholder="Ringkasan singkat (excerpt carousel)" value={contentForm.excerpt}
                            onChange={(_, d) => setContentForm({ ...contentForm, excerpt: d.value })} />
                        </FField>
                        <FField label="URL Gambar" className="sm:col-span-2">
                          <FInput placeholder="https://drive.google.com/..." value={contentForm.image}
                            onChange={(_, d) => setContentForm({ ...contentForm, image: d.value })} />
                        </FField>
                        {contentForm.type === "publication" && (
                          <>
                            <FField label="URL Dokumen">
                              <FInput placeholder="https://..." value={contentForm.document_url}
                                onChange={(_, d) => setContentForm({ ...contentForm, document_url: d.value })} />
                            </FField>
                            <FField label="Nama Dokumen">
                              <FInput placeholder="Laporan Triwulan III 2026.pdf" value={contentForm.document_name}
                                onChange={(_, d) => setContentForm({ ...contentForm, document_name: d.value })} />
                            </FField>
                          </>
                        )}
                        <FField label="Isi" className="sm:col-span-2">
                          <RichTextEditor
                            value={contentForm.contentText}
                            onChange={(html) => setContentForm({ ...contentForm, contentText: html })}
                            placeholder="Tulis isi konten di sini..."
                          />
                        </FField>
                        <FField label="Galeri" className="sm:col-span-2">
                          <FTextarea rows={4} placeholder="Satu URL gambar per baris" value={contentForm.galleryText}
                            onChange={(_, d) => setContentForm({ ...contentForm, galleryText: d.value })} />
                        </FField>
                        <FCheckbox label="Publish" checked={contentForm.is_published}
                          onChange={(_, d) => setContentForm({ ...contentForm, is_published: d.checked === true })} />
                      </DialogContent>
                      <DialogActions>
                        <FButton appearance="primary" type="submit" disabled={busy}>Simpan</FButton>
                        <FButton appearance="secondary" type="button" onClick={() => setShowContentForm(false)} disabled={busy}>Batal</FButton>
                      </DialogActions>
                    </DialogBody>
                  </form>
                </DialogSurface>
              </FDialog>
            </FluentProvider>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left">
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Tipe</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Judul</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Kategori</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-3 py-2 text-xs text-slate-600">{c.type === "news" ? "Berita" : "Publikasi"}</td>
                    <td className="px-3 py-2 text-slate-700">{c.title}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.category}</td>
                    <td className="px-3 py-2">
                      {c.is_published
                        ? <span className="text-xs font-semibold text-emerald-600">published</span>
                        : <span className="text-xs font-semibold text-amber-600">draft</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        className="text-xs font-bold text-blue-900 underline underline-offset-2 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        className="ml-3 text-xs font-bold text-red-600 underline underline-offset-2 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() => removeContent(c)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Manajemen user */}
        <Card interactive={false} className="p-5">
          <h2 className="text-sm font-extrabold text-slate-600">Manajemen User</h2>
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

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left">
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Nama</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Email</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Unit kerja</th>
                  <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-600">Peran</th>
                  <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) =>
                  editingUserId === u.id ? (
                    <tr key={u.id}>
                      <td colSpan={5} className="px-3 py-2">
                        <form onSubmit={saveUser} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,10rem)_auto]">
                          <Field label="Nama">
                            <Input value={userForm.name}
                              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                          </Field>
                          <Field label="Email">
                            <Input type="email" value={userForm.email}
                              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                          </Field>
                          <Field label="Unit kerja">
                            <Input value={userForm.unit_kerja}
                              onChange={(e) => setUserForm({ ...userForm, unit_kerja: e.target.value })} />
                          </Field>
                          <Field label="Password baru">
                            <Input type="password" placeholder="Kosong = tetap" value={userForm.password}
                              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                          </Field>
                          <label className="flex items-end gap-2 pb-1 text-sm text-slate-700">
                            <input type="checkbox" className="accent-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
                              checked={userForm.is_admin}
                              onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })} />
                            Admin
                          </label>
                          <div className="flex items-end gap-2">
                            <Button variant="primary" type="submit" disabled={busy}>Simpan</Button>
                            <Button variant="secondary" type="button" onClick={cancelEditUser} disabled={busy}>Batal</Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{u.name}</td>
                      <td className="px-3 py-2 text-slate-700">{u.email}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{u.unit_kerja}</td>
                      <td className="px-3 py-2">
                        {u.is_admin
                          ? <span className="text-xs font-semibold text-emerald-600">Admin</span>
                          : <span className="text-xs font-semibold text-slate-500">Staf</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button
                          className="text-xs font-bold text-blue-900 underline underline-offset-2 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy}
                          onClick={() => openEditUser(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="ml-3 text-xs font-bold text-red-600 underline underline-offset-2 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy}
                          onClick={() => removeUser(u)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
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
