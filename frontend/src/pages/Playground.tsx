import { useState } from "react";
import { api, type AskResult } from "../api";
import {
  Button,
  Card,
  CitationPin,
  ErrorBanner,
  Field,
  PageHeader,
  Textarea,
} from "../components/ui";

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
    <>
      {/* Subtle fade-in for the survey report; honours reduced motion. */}
      <style>{`
        @keyframes survey-fade {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .survey-fade-in { animation: survey-fade 0.4s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .survey-fade-in { animation: none; }
        }
      `}</style>

      <PageHeader eyebrow="RAG · TANYA-JAWAB" title="Tanya-Jawab Dokumen" />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Question composer */}
          <Card interactive={false} className="p-5">
            <Field label="Pertanyaan">
              <Textarea
                rows={4}
                placeholder="Tulis pertanyaan tentang dokumen kedeputian…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </Field>
            <div className="mt-3 flex justify-end">
              <Button variant="primary" onClick={ask} disabled={loading}>
                {loading ? "Memproses…" : "Tanya"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="mt-4">
              <ErrorBanner>{error}</ErrorBanner>
            </div>
          )}

          {!result && !error && (
            <p className="mt-4 text-sm text-slate-500">
              Ajukan pertanyaan untuk memperoleh jawaban beserta rujukan dokumen.
            </p>
          )}

          {result && (
            <div className="survey-fade-in mt-6">
              <Card interactive={false} className="p-6">
                <p className="text-sm font-semibold text-slate-600">
                  Laporan survei · {result.citations.length} sumber
                </p>
                <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                  {result.answer}
                </p>

                {result.citations.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-600">Rujukan</p>
                    <div className="mt-3 space-y-2">
                      {result.citations.map((c, i) => (
                        <p
                          key={i}
                          className="flex items-baseline gap-2 text-sm leading-relaxed text-slate-500"
                        >
                          <CitationPin index={i + 1} />
                          <span>
                            <span className="font-medium text-slate-800">{c.filename}</span>
                            {c.page_or_slide != null && (
                              <span> — halaman/slide {c.page_or_slide}</span>
                            )}
                            {c.section_title && <span> — {c.section_title}</span>}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        {result && result.citations.length > 0 && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-600">Legenda</p>
              <ul className="mt-3 space-y-3">
                {result.citations.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CitationPin index={i + 1} />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug text-slate-800">{c.filename}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {c.page_or_slide != null
                          ? `halaman/slide ${c.page_or_slide}`
                          : "—"}
                        {c.section_title ? ` · ${c.section_title}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
