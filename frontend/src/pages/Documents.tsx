import { useEffect, useState, type FormEvent } from "react";
import { api, type DocumentRow } from "../api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  type BadgeTone,
} from "../components/ui";

const TONE: Record<string, BadgeTone> = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
};

function tone(status: string): BadgeTone {
  return TONE[status] ?? "neutral";
}

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

  async function upload(e: FormEvent) {
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
    <>
      <PageHeader eyebrow="REGISTER DOKUMEN" title="Dokumen" />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="space-y-6">
        <Card interactive={false} className="p-5">
          <p className="mb-3 text-sm font-extrabold text-slate-600">Tambah dokumen</p>
          <form onSubmit={upload}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <Input
                  type="file"
                  accept=".pptx,.pdf,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="w-44">
                <Select value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  <option value="">Otomatis</option>
                  <option value="paparan">Paparan</option>
                  <option value="laporan">Laporan</option>
                  <option value="lainnya">Lainnya</option>
                </Select>
              </div>
              <Button variant="primary" disabled={!file || busy}>Upload</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800" title={d.filename}>
                  {d.filename}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {d.file_type} · {d.chunk_count} chunk
                  {d.error_message && (d.status === "failed"
                    ? <span className="ml-2 text-red-600">{d.error_message}</span>
                    : <span className="ml-2 text-amber-600">{d.error_message}</span>)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={tone(d.status)}>
                  <span className="lowercase">{d.status}</span>
                </Badge>
                {d.status === "failed" && (
                  <Button variant="danger" disabled={busy} onClick={() => retry(d.id)}>
                    Ulangi
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {docs.length === 0 && <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
        </div>
      </div>
    </>
  );
}
