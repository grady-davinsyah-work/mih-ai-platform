import { useEffect, useState } from "react";
import { api, type DocumentRow } from "../api";

const BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function Documents() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setDocs(await api.documents());
    } catch (err: any) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      await api.uploadDocument(file, fileType || undefined);
      setFile(null);
      setFileType("");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: number) {
    setError("");
    setBusy(true);
    try {
      await api.retryDocument(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dokumen</h1>
      {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={upload} className="rounded border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <input type="file" accept=".pptx,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <select className="rounded border px-2 py-1 text-sm" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="">Otomatis</option>
            <option value="paparan">Paparan</option>
            <option value="laporan">Laporan</option>
            <option value="lainnya">Lainnya</option>
          </select>
          <button className="rounded bg-blue-600 px-4 py-1 text-white hover:bg-blue-700" disabled={!file || busy}>Upload</button>
        </div>
      </form>

      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="rounded border bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{d.filename}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${BADGE[d.status] ?? "bg-slate-100"}`}>{d.status}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {d.file_type} · {d.chunk_count} chunk
              {d.error_message && (d.status === "failed"
                ? <span className="ml-2 text-red-600">{d.error_message}</span>
                : <span className="ml-2 text-amber-600">{d.error_message}</span>)}
              {d.status === "failed" && (
                <button
                  className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                  disabled={busy}
                  onClick={() => retry(d.id)}
                >Ulangi</button>
              )}
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
      </div>
    </div>
  );
}
