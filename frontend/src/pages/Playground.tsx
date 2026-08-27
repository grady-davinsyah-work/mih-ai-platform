import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatEvent, type ChatMessage, type Conversation } from "../api";
import {
  Button,
  Card,
  CitationPin,
  ErrorBanner,
  Textarea,
} from "../components/ui";

export default function Playground() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations());
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function newChat() {
    setError("");
    try {
      const { id } = await api.createConversation();
      setActiveId(id);
      setDraftId(id);
      setMessages([]);
      setSidebarOpen(false);
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openConversation(id: number) {
    setError("");
    try {
      const msgs = await api.conversationMessages(id);
      setActiveId(id);
      setDraftId(null);
      setMessages(msgs);
      setSidebarOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeConversation(id: number) {
    if (!window.confirm("Hapus percakapan ini?")) return;
    try {
      await api.deleteConversation(id);
      if (activeId === id) { setActiveId(null); setDraftId(null); setMessages([]); }
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function onEvent(evt: ChatEvent) {
    if (evt.event === "meta") {
      setActiveId(evt.data.conversation_id);
      setDraftId(null);
    } else if (evt.event === "delta") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.id === -1) {
          copy[copy.length - 1] = { ...last, content: last.content + evt.data.text };
        } else {
          copy.push({ id: -1, role: "assistant", content: evt.data.text, citations: [], created_at: "" });
        }
        return copy;
      });
    } else if (evt.event === "citations") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.id === -1) copy[copy.length - 1] = { ...last, citations: evt.data.citations };
        return copy;
      });
    } else if (evt.event === "error") {
      setError(evt.data.message ?? "terjadi kesalahan");
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || streaming) return;
    setError("");
    setQuestion("");
    setStreaming(true);
    setMessages((prev) => [...prev, { id: -2, role: "user", content: q, citations: [], created_at: "" }]);
    try {
      await api.chat(q, activeId ?? draftId, onEvent);
      loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-10.25rem)]">
      <style>{`
        @keyframes chat-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; } }
        .chat-fade-in { animation: chat-fade 0.25s ease-out; }
        @media (prefers-reduced-motion: reduce) { .chat-fade-in { animation: none; } }
      `}</style>

      {/* Sidebar percakapan */}
      <aside className={`${sidebarOpen ? "flex" : "hidden"} md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white`}>
        <div className="p-3">
          <Button variant="primary" className="w-full" onClick={newChat} disabled={streaming}>+ Chat baru</Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                activeId === c.id ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => openConversation(c.id)}
            >
              <span className="truncate">{c.title || "Percakapan baru"}</span>
              <button
                className="hidden text-xs text-red-500 group-hover:block"
                onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }}
                aria-label="Hapus percakapan"
              >
                ✕
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Belum ada percakapan.</p>
          )}
        </nav>
      </aside>

      {/* Area chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Button variant="secondary" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</Button>
          <p className="text-sm font-semibold text-slate-700">Playground</p>
        </div>

        {error && <div className="px-4 pt-3"><ErrorBanner>{error}</ErrorBanner></div>}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && !streaming && (
            <div className="mx-auto max-w-2xl pt-16 text-center">
              <p className="text-2xl font-bold text-slate-800">Tanya-Jawab Dokumen</p>
              <p className="mt-2 text-sm text-slate-500">
                Ajukan pertanyaan tentang dokumen kedeputian. Jawaban disertai rujukan, dan riwayat
                percakapan tersimpan per pengguna.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={m.id === -1 || m.id === -2 ? `tmp-${i}` : m.id} message={m} />
          ))}
          {streaming && <StreamingCursor />}
        </div>

        <form onSubmit={send} className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              rows={1}
              placeholder="Tulis pertanyaan… (Enter untuk kirim, Shift+Enter baris baru)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <Button variant="primary" onClick={send} disabled={!question.trim() || streaming}>
              {streaming ? "…" : "Kirim"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`chat-fade-in mx-auto flex max-w-3xl ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[80%]" : "w-full"}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-blue-900 px-4 py-3 text-white">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
          </div>
        ) : (
          <Card interactive={false} className="p-5">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
              {message.content || "…"}
            </p>
            {message.citations.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500">Rujukan</p>
                <div className="mt-2 space-y-2">
                  {message.citations.map((c, i) => (
                    <p key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-slate-500">
                      <CitationPin index={i + 1} />
                      <span>
                        <a
                          href={`/api/documents/${c.document_id}/file`}
                          download
                          className="font-medium text-blue-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.filename}
                        </a>
                        {c.page_or_slide != null && <span> — halaman/slide {c.page_or_slide}</span>}
                        {c.section_title && <span> — {c.section_title}</span>}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-1 text-slate-400">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
      </div>
    </div>
  );
}
