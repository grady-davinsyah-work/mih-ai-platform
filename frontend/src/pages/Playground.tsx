import { useState } from "react";
import { api, type AskResult } from "../api";

export default function Playground() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResult(await api.ask(question));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Tanya-jawab dokumen</h1>
      <textarea
        className="w-full rounded border px-3 py-2"
        rows={4}
        placeholder="Tulis pertanyaan tentang dokumen kedeputian…"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button
        className="mt-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        onClick={ask}
        disabled={loading}
      >
        {loading ? "Memproses…" : "Tanya"}
      </button>
      {error && <p className="mt-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Jawaban</h2>
          <p className="mt-2 whitespace-pre-wrap rounded border bg-white p-4">{result.answer}</p>
          {result.citations.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold">Sumber rujukan</h3>
              <ul className="mt-2 space-y-1">
                {result.citations.map((c, i) => (
                  <li key={i} className="rounded border bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{c.filename}</span>
                    {c.page_or_slide != null && <span> — halaman/slide {c.page_or_slide}</span>}
                    {c.section_title && <span> — {c.section_title}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
