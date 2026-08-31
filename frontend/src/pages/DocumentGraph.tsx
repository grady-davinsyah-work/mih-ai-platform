import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { api, type GraphCluster, type GraphEdge, type GraphNode } from "../api";
import { Badge, Button, Card, ErrorBanner, PageHeader, Select } from "../components/ui";

const TYPE_COLOR: Record<string, string> = {
  paparan: "#1d4ed8",
  laporan: "#047857",
  lainnya: "#64748b",
};
const DEFAULT_NODE_COLOR = "#475569";
// Palet per klaster (Level 1).
const CLUSTER_COLOR: Record<number, string> = {
  1: "#2563eb", // Makro & Statistik
  2: "#7c3aed", // Fiskal, Moneter & Keuangan
  3: "#d97706", // Hilirisasi & Kerjasama Ekonomi
  4: "#059669", // Produktivitas & Ekonomi Tematik
  5: "#db2777", // Perencanaan Pembangunan
  6: "#64748b", // Tata Kelola Internal
  7: "#94a3b8", // Lainnya
};
const C_SEM = "#2563eb";
const C_CIT = "#d97706";

function nodeColor(t: string): string {
  return TYPE_COLOR[t] ?? DEFAULT_NODE_COLOR;
}
function edgeColor(e: GraphEdge): string {
  const hasSem = e.semantic !== null;
  const hasCit = (e.citations ?? 0) > 0;
  if (hasSem && hasCit) return "rgba(5,150,105,0.75)";
  if (hasSem) {
    const s = e.semantic ?? 0;
    const a = Math.max(0.15, Math.min(0.85, (s - 0.45) * 2.2));
    return `rgba(37,99,235,${a.toFixed(2)})`;
  }
  return "rgba(217,119,6,0.65)";
}
function edgeWidth(e: GraphEdge): number {
  return 0.4 + Math.max((e.semantic ?? 0) * 1.2, Math.min(e.citations ?? 0, 5) * 0.4);
}
// Level 1: bobot agregat (jumlah skor) — skala logaritmik agar tak ekstrem tebal.
function clusterEdgeWidth(e: GraphEdge): number {
  return 1 + Math.min((e.semantic ?? 0) / 4, 4) + Math.min((e.citations ?? 0) / 2, 3);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function DocumentGraph() {
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusterEdges, setClusterEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [minSem, setMinSem] = useState("0.6");
  const [showSem, setShowSem] = useState(true);
  const [showCit, setShowCit] = useState(true);
  const [level, setLevel] = useState<number | null>(null); // null = peta klaster
  const [selected, setSelected] = useState<number | null>(null);
  const fgRef = useRef<any>(null);

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
        setClusters(r.clusters);
        setNodes(r.nodes);
        setEdges(r.edges);
        setClusterEdges(r.cluster_edges);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const minSemNum = Number(minSem);

  const passFilter = (e: GraphEdge) =>
    (showSem && e.semantic !== null && e.semantic >= minSemNum) ||
    (showCit && (e.citations ?? 0) > 0);

  // Level 1: node = klaster, link = edge antar-klaster.
  const clusterGraph = useMemo(
    () => ({
      nodes: clusters.map((c) => ({ id: c.id, name: c.name, doc_count: c.doc_count })),
      links: clusterEdges.filter(passFilter),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clusters, clusterEdges, showSem, showCit, minSemNum]
  );

  // Level 2: dokumen dalam satu klaster + edge antar mereka.
  const docNodes = useMemo(
    () => (level == null ? [] : nodes.filter((n) => n.cluster === level)),
    [nodes, level]
  );
  const docGraph = useMemo(
    () => ({
      nodes: docNodes.map((n) => ({ ...n, id: Number(n.id) })),
      links: edges
        .filter((e) => passFilter(e))
        .filter(
          (e) =>
            docNodes.some((n) => Number(n.id) === Number(e.source)) &&
            docNodes.some((n) => Number(n.id) === Number(e.target))
        )
        .map((e) => ({ ...e, source: Number(e.source), target: Number(e.target) })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docNodes, edges, showSem, showCit, minSemNum]
  );

  const activeCluster = clusters.find((c) => c.id === level) ?? null;
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

  // Fit-to-view saat data pertama tiba dan saat pindah level (bukan saat filter berubah).
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (!loading && hasGraph && !fitted) {
      setFitted(true);
      setTimeout(() => fgRef.current?.zoomToFit(500, 0.8), 120);
    }
  }, [loading, hasGraph, fitted]);
  useEffect(() => {
    if (fitted && !loading) setTimeout(() => fgRef.current?.zoomToFit(400, 0.7), 60);
  }, [level, fitted, loading]);

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
                graphData={level == null ? clusterGraph : docGraph}
                backgroundColor="rgba(255,255,255,0)"
                nodeLabel={(n: any) =>
                  level == null
                    ? `${n.name} — ${n.doc_count} dokumen`
                    : n.filename
                }
                nodeCanvasObject={(n: any, ctx, globalScale) => {
                  const x = n.x ?? 0;
                  const y = n.y ?? 0;
                  if (level == null) {
                    // Bubble klaster.
                    const r = 16 + Math.min(n.doc_count ?? 1, 45) / 1.5;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, 2 * Math.PI);
                    ctx.fillStyle = CLUSTER_COLOR[n.id] ?? DEFAULT_NODE_COLOR;
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#ffffff";
                    ctx.stroke();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = "700 12px system-ui, sans-serif";
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(truncate(String(n.name), 26), x, y - 4);
                    ctx.font = "600 10px system-ui, sans-serif";
                    ctx.fillStyle = "rgba(255,255,255,0.9)";
                    ctx.fillText(`${n.doc_count} dokumen`, x, y + 12);
                    return;
                  }
                  // Dokumen: disc warna + label (mode sekarang).
                  const isDim = selected != null && Number(n.id) !== selected;
                  const r = 4 + Math.min(n.chunk_count ?? 1, 40) / 4;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI);
                  ctx.fillStyle = isDim ? "#e2e8f0" : nodeColor(n.file_type);
                  ctx.fill();
                  ctx.lineWidth = 1.5;
                  ctx.strokeStyle = "#ffffff";
                  ctx.stroke();
                  if (selected === Number(n.id)) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#0f172a";
                    ctx.stroke();
                  }
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
                  ctx.arc(x, y, level == null ? 22 : 12, 0, 2 * Math.PI);
                  ctx.fillStyle = "#fff";
                  ctx.fill();
                }}
                linkColor={(l: any) => edgeColor(l as GraphEdge)}
                linkWidth={(l: any) =>
                  level == null
                    ? clusterEdgeWidth(l as GraphEdge)
                    : edgeWidth(l as GraphEdge)
                }
                linkCurvature={0.2}
                linkDirectionalParticles={(l: any) => ((l.citations ?? 0) > 0 ? 2 : 0)}
                d3VelocityDecay={0.35}
                onNodeClick={(n: any) => {
                  if (level == null) {
                    setSelected(null);
                    setLevel(Number(n.id));
                  } else {
                    setSelected(Number(n.id));
                  }
                }}
                onBackgroundClick={() => setSelected(null)}
              />
            )}

            {/* Breadcrumb saat di dalam klaster */}
            {hasGraph && level != null && (
              <button
                onClick={() => setLevel(null)}
                className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/85 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur hover:bg-white"
              >
                Semua Klaster <span className="text-slate-400">▸</span>
                <span style={{ color: CLUSTER_COLOR[level] }}>{activeCluster?.name}</span>
              </button>
            )}

            {/* Toolbar kaca mengambang */}
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
                {level != null && (
                  <div className="w-32">
                    <Select value={minSem} onChange={(e) => setMinSem(e.target.value)}>
                      <option value="0.3">Ambang 0.3</option>
                      <option value="0.4">Ambang 0.4</option>
                      <option value="0.5">Ambang 0.5</option>
                      <option value="0.6">Ambang 0.6</option>
                      <option value="0.7">Ambang 0.7</option>
                    </Select>
                  </div>
                )}
                <span className="text-[11px] text-slate-400">
                  {level == null
                    ? `${clusters.length} klaster · ${clusterEdges.filter(passFilter).length} relasi`
                    : `${docNodes.length} dokumen · ${docGraph.links.length} relasi`}
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
              {level == null ? (
                <p className="text-sm text-slate-500">
                  Dokumen dikelompokkan ke {clusters.length} klaster tematik. Klik sebuah klaster
                  untuk melihat dokumen dan relasi di dalamnya.
                </p>
              ) : selectedNode ? (
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
                  Klik node dokumen untuk melihat detail dan dokumen terkait.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
