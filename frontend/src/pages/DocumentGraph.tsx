import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { api, type GraphEdge, type GraphNode } from "../api";
import { Badge, Button, Card, ErrorBanner, PageHeader, Select } from "../components/ui";

const TYPE_COLOR: Record<string, string> = {
  paparan: "#1d4ed8",
  laporan: "#047857",
  lainnya: "#64748b",
};
const DEFAULT_NODE_COLOR = "#475569";
const C_SEM = "#2563eb"; // biru: edge semantik
const C_CIT = "#d97706"; // amber: edge kutipan
const C_BOTH = "#059669"; // emerald: keduanya

function nodeColor(t: string): string {
  return TYPE_COLOR[t] ?? DEFAULT_NODE_COLOR;
}
function edgeColor(e: GraphEdge): string {
  const hasSem = e.semantic !== null;
  const hasCit = (e.citations ?? 0) > 0;
  if (hasSem && hasCit) return "rgba(5,150,105,0.75)";
  if (hasSem) {
    // Opasitas mengikuti skor — edge lemah nyaris tak terlihat, yang kuat menonjol.
    const s = e.semantic ?? 0;
    const a = Math.max(0.15, Math.min(0.85, (s - 0.45) * 2.2));
    return `rgba(37,99,235,${a.toFixed(2)})`;
  }
  return "rgba(217,119,6,0.65)";
}
function edgeWidth(e: GraphEdge): number {
  return 0.4 + Math.max((e.semantic ?? 0) * 1.2, Math.min(e.citations ?? 0, 5) * 0.4);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function DocumentGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [minSem, setMinSem] = useState("0.6");
  const [showSem, setShowSem] = useState(true);
  const [showCit, setShowCit] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const fgRef = useRef<any>(null);

  // Fisika layout — react-force-graph mengekspos charge/link force hanya lewat
  // metode kapsule (d3Force), bukan React props. Repulsi lebih kuat + pegas
  // longgar agar node menyebar dan edge tidak menumpuk.
  useEffect(() => {
    const g = fgRef.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-70);
    g.d3Force("link")?.distance(45);
    g.d3Force("link")?.strength(0.25);
  }, []);

  useEffect(() => {
    api
      .documentGraph()
      .then((r) => {
        setNodes(r.nodes);
        setEdges(r.edges);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const minSemNum = Number(minSem);

  const links = useMemo(
    () =>
      edges
        .filter(
          (e) =>
            (showSem && e.semantic !== null && e.semantic >= minSemNum) ||
            (showCit && (e.citations ?? 0) > 0)
        )
        .map((e) => ({ ...e, source: Number(e.source), target: Number(e.target) })),
    [edges, showSem, showCit, minSemNum]
  );

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n, id: Number(n.id) })),
      links,
    }),
    [nodes, links]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => Number(n.id) === selected) ?? null,
    [nodes, selected]
  );

  const related = useMemo(() => {
    if (selected == null) return [];
    return edges
      .filter((e) => Number(e.source) === selected || Number(e.target) === selected)
      .map((e) => {
        const otherId = Number(e.source) === selected ? Number(e.target) : Number(e.source);
        return {
          doc: nodes.find((n) => Number(n.id) === otherId),
          sem: e.semantic,
          cit: e.citations,
        };
      })
      .filter(
        (x): x is { doc: GraphNode; sem: number | null; cit: number | null } => x.doc != null
      )
      .sort(
        (a, b) => Math.max(b.sem ?? 0, b.cit ?? 0) - Math.max(a.sem ?? 0, a.cit ?? 0)
      );
  }, [selected, edges, nodes]);

  const hasGraph = !loading && nodes.length > 0;

  return (
    <>
      <PageHeader eyebrow="RELASI DOKUMEN" title="Relasi Dokumen" />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card interactive={false}>
          <div
            className="relative h-[560px] overflow-hidden"
            style={{
              backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Memuat…
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Belum ada dokumen dengan embedding untuk digambarkan.
              </div>
            ) : (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                backgroundColor="rgba(255,255,255,0)"
                nodeColor={(n: any) =>
                  selected != null && Number(n.id) !== selected ? "#cbd5e1" : nodeColor(n.file_type)
                }
                nodeVal={(n: any) => 2 + Math.min(n.chunk_count, 40) / 3}
                nodeLabel={(n: any) => n.filename}
                nodeCanvasObject={(n: any, ctx, globalScale) => {
                  const x = n.x ?? 0;
                  const y = n.y ?? 0;
                  const isDim = selected != null && Number(n.id) !== selected;
                  const r = 4 + Math.min(n.chunk_count ?? 1, 40) / 4;
                  // Disc berwarna dengan border putih.
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI);
                  ctx.fillStyle = isDim ? "#e2e8f0" : nodeColor(n.file_type);
                  ctx.fill();
                  ctx.lineWidth = 1.5;
                  ctx.strokeStyle = "#ffffff";
                  ctx.stroke();
                  // Ring saat dipilih.
                  if (selected === Number(n.id)) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#0f172a";
                    ctx.stroke();
                  }
                  // Label tebal dengan halo putih agar terbaca di atas edge.
                  if (globalScale >= 0.5) {
                    ctx.font = "600 10px system-ui, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    const label = truncate(String(n.filename), 16);
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "rgba(255,255,255,0.85)";
                    ctx.strokeText(label, x, y + r + 2);
                    ctx.fillStyle = isDim ? "#94a3b8" : "#1e293b";
                    ctx.fillText(label, x, y + r + 2);
                  }
                }}
                nodePointerAreaPaint={(n: any, _color, ctx) => {
                  const x = n.x ?? 0;
                  const y = n.y ?? 0;
                  ctx.beginPath();
                  ctx.arc(x, y, 12, 0, 2 * Math.PI);
                  ctx.fillStyle = "#fff";
                  ctx.fill();
                }}
                linkColor={(l: any) => edgeColor(l as GraphEdge)}
                linkWidth={(l: any) => edgeWidth(l as GraphEdge)}
                linkCurvature={0.2}
                linkDirectionalParticles={(l: any) => ((l.citations ?? 0) > 0 ? 2 : 0)}
                d3VelocityDecay={0.35}
                onNodeClick={(n: any) => setSelected(Number(n.id))}
                onBackgroundClick={() => setSelected(null)}
              />
            )}

            {/* Toolbar kaca mengambang — filter semantik/kutipan + ambang */}
            {hasGraph && (
              <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/60 bg-white/85 px-4 py-3 shadow-lg backdrop-blur">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showSem}
                    onChange={(e) => setShowSem(e.target.checked)}
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: C_SEM }} />
                  Semantik
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showCit}
                    onChange={(e) => setShowCit(e.target.checked)}
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: C_CIT }} />
                  Kutipan
                </label>
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: C_BOTH }} />
                  keduanya
                </span>
                <div className="w-32">
                  <Select value={minSem} onChange={(e) => setMinSem(e.target.value)}>
                    <option value="0.3">Ambang 0.3</option>
                    <option value="0.4">Ambang 0.4</option>
                    <option value="0.5">Ambang 0.5</option>
                    <option value="0.6">Ambang 0.6</option>
                    <option value="0.7">Ambang 0.7</option>
                  </Select>
                </div>
                <span className="text-[11px] text-slate-400">
                  {nodes.length} dok · {links.length} relasi
                </span>
              </div>
            )}

            {/* Kontrol zoom */}
            {hasGraph && (
              <div className="absolute right-4 top-4 z-10 flex flex-col gap-1">
                <button
                  onClick={() => fgRef.current?.zoomIn()}
                  title="Perbesar"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/85 text-lg font-bold text-slate-700 shadow hover:bg-white"
                >
                  +
                </button>
                <button
                  onClick={() => fgRef.current?.zoomOut()}
                  title="Perkecil"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/85 text-lg font-bold text-slate-700 shadow hover:bg-white"
                >
                  −
                </button>
                <button
                  onClick={() => fgRef.current?.zoomToFit(400)}
                  title="Pas ke layar"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/85 text-base font-bold text-slate-700 shadow hover:bg-white"
                >
                  ⤢
                </button>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card interactive={false}>
            <div className="p-5">
              {selectedNode ? (
                <>
                  <p
                    className="truncate text-sm font-extrabold text-slate-900"
                    title={selectedNode.filename}
                  >
                    {selectedNode.filename}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{selectedNode.file_type}</Badge>
                    <Badge tone="completed">{selectedNode.chunk_count} chunk</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Sumber: {selectedNode.source}</p>
                  <a href={`/api/documents/${selectedNode.id}/file`} download>
                    <Button variant="secondary" className="mt-4 w-full">
                      Unduh file
                    </Button>
                  </a>
                  {related.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm font-extrabold text-slate-700">Dokumen terkait</p>
                      <ul className="space-y-2">
                        {related.slice(0, 8).map((r) => (
                          <li key={r.doc.id} className="rounded-md border border-slate-100 px-3 py-2">
                            <p
                              className="truncate text-xs font-semibold text-slate-800"
                              title={r.doc.filename}
                            >
                              {r.doc.filename}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {r.sem != null && <span style={{ color: C_SEM }}>semantik {r.sem.toFixed(2)}</span>}
                              {r.sem != null && r.cit != null && <span> · </span>}
                              {r.cit != null && <span style={{ color: C_CIT }}>{r.cit}× kutipan</span>}
                              {r.sem == null && r.cit == null && <span>—</span>}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Klik node untuk melihat detail dan dokumen terkait.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
