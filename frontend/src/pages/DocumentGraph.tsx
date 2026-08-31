import { useEffect, useMemo, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { api, type GraphEdge, type GraphNode } from "../api";
import { Badge, Button, Card, ErrorBanner, PageHeader, Select } from "../components/ui";

const TYPE_COLOR: Record<string, string> = {
  paparan: "#1d4ed8",
  laporan: "#047857",
  lainnya: "#64748b",
};
const DEFAULT_NODE_COLOR = "#475569";
const C_SEM = "#2563eb"; // biru: edge semantik saja
const C_CIT = "#d97706"; // amber: edge kutipan saja
const C_BOTH = "#059669"; // emerald: keduanya

function nodeColor(t: string): string {
  return TYPE_COLOR[t] ?? DEFAULT_NODE_COLOR;
}
function edgeColor(e: GraphEdge): string {
  const hasSem = e.semantic !== null;
  const hasCit = (e.citations ?? 0) > 0;
  if (hasSem && hasCit) return C_BOTH;
  if (hasSem) return C_SEM;
  return C_CIT;
}
function edgeWidth(e: GraphEdge): number {
  return 0.5 + Math.max((e.semantic ?? 0) * 3, Math.min(e.citations ?? 0, 5) * 0.6);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function DocumentGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [minSem, setMinSem] = useState("0.5");
  const [showSem, setShowSem] = useState(true);
  const [showCit, setShowCit] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

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

  return (
    <>
      <PageHeader eyebrow="RELASI DOKUMEN" title="Relasi Dokumen" />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={showSem} onChange={(e) => setShowSem(e.target.checked)} />
          <span style={{ color: C_SEM }}>●</span> Semantik
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={showCit} onChange={(e) => setShowCit(e.target.checked)} />
          <span style={{ color: C_CIT }}>●</span> Kutipan
        </label>
        <div className="w-48">
          <Select value={minSem} onChange={(e) => setMinSem(e.target.value)}>
            <option value="0.3">Ambang 0.3</option>
            <option value="0.4">Ambang 0.4</option>
            <option value="0.5">Ambang 0.5</option>
            <option value="0.6">Ambang 0.6</option>
            <option value="0.7">Ambang 0.7</option>
          </Select>
        </div>
        <span className="text-sm text-slate-500">
          {nodes.length} dokumen · {links.length} relasi
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card interactive={false}>
          <div className="h-[560px]">
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
                  const r = 3 + Math.min(n.chunk_count ?? 1, 40) / 3;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI);
                  ctx.fillStyle =
                    selected != null && Number(n.id) !== selected
                      ? "#cbd5e1"
                      : nodeColor(n.file_type);
                  ctx.fill();
                  ctx.lineWidth = 1;
                  ctx.strokeStyle = "#ffffff";
                  ctx.stroke();
                  if (globalScale >= 1) {
                    ctx.font = "10px system-ui, sans-serif";
                    ctx.fillStyle = "#0f172a";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.fillText(truncate(String(n.filename), 18), x, y + r + 2);
                  }
                }}
                linkColor={(l: any) => edgeColor(l as GraphEdge)}
                linkWidth={(l: any) => edgeWidth(l as GraphEdge)}
                linkDirectionalParticles={(l: any) => ((l.citations ?? 0) > 0 ? 2 : 0)}
                onNodeClick={(n: any) => setSelected(Number(n.id))}
                onBackgroundClick={() => setSelected(null)}
              />
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
