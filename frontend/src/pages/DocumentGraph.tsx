import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { api, type GraphCluster, type GraphEdge, type GraphNode } from "../api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  PageHeader,
  Select,
} from "../components/ui";

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
  return (
    0.4 + Math.max((e.semantic ?? 0) * 1.2, Math.min(e.citations ?? 0, 5) * 0.4)
  );
}
// Level 1: bobot agregat (jumlah skor) — skala logaritmik agar tak ekstrem tebal.
function clusterEdgeWidth(e: GraphEdge): number {
  return (
    1 + Math.min((e.semantic ?? 0) / 4, 4) + Math.min((e.citations ?? 0) / 2, 3)
  );
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
// Jari-jari disc dokumen: kecil → besar, ∝ jumlah relasi (derajat).
function docRadius(n: any, deg: Map<number, number>): number {
  return 4 + Math.min(deg.get(Number(n.id)) ?? 1, 30) / 2;
}
// Force collide sebaris d3.forceCollide: dorong node yang tumpang tindih
// (jarak pusat < jumlah jari-jari + padding) — kunci anti-tumpuk (pola Hilirisasi).
function collideForce(
  getNodes: () => any[],
  radius: (n: any) => number,
  pad: number,
) {
  return (alpha: number) => {
    const nodes = getNodes();
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = (b.x ?? 0) - (a.x ?? 0);
        let dy = (b.y ?? 0) - (a.y ?? 0);
        const l2 = dx * dx + dy * dy;
        const minD = radius(a) + radius(b) + pad;
        if (l2 > 0 && l2 < minD * minD) {
          const l = Math.sqrt(l2);
          const push = ((minD - l) / l) * alpha;
          a.vx = (a.vx ?? 0) - dx * push;
          a.vy = (a.vy ?? 0) - dy * push;
          b.vx = (b.vx ?? 0) + dx * push;
          b.vy = (b.vy ?? 0) + dy * push;
        }
      }
    }
  };
}
// Force batas kotak: jaga node tetap di dalam viewport.
function boundsForce(
  getNodes: () => any[],
  radius: (n: any) => number,
  w: number,
  h: number,
  m: number,
) {
  return (alpha: number) => {
    const k = 0.15 * alpha;
    for (const n of getNodes()) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const r = radius(n) + 12;
      if (x < m + r) n.vx = (n.vx ?? 0) + (m + r - x) * k;
      if (x > w - m - r) n.vx = (n.vx ?? 0) - (x - (w - m - r)) * k;
      if (y < m + r) n.vy = (n.vy ?? 0) + (m + r - y) * k;
      if (y > h - m - r) n.vy = (n.vy ?? 0) - (y - (h - m - r)) * k;
    }
  };
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
  const [level, setLevel] = useState<number | null>(null); // klaster terpilih (drilldown)
  const [view, setView] = useState<"map" | "all" | "cluster">("map"); // map = peta klaster, all = semua dokumen, cluster = drilldown
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null); // ring highlight hasil pencarian
  const [search, setSearch] = useState("");
  const fgRef = useRef<any>(null);
  // Cermin graphData aktif — dipakai getter force (bounds/collide/clusterX/Y).
  // Menghindari g.graphData() pada instance yang ternyata bukan fungsi di tick.
  const graphDataRef = useRef<any>({ nodes: [], links: [] });
  // ForceGraph2D default lebar/tinggi = window.innerWidth/innerHeight, bukan ukuran
  // kontainer → canvas membesar (mis. 1400×900) melebihi kotak visible sehingga node
  // terpotong dan tak bisa diklik. Ukur kotak graf dan teruskan sebagai prop.
  const graphBoxRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 560 });
  useEffect(() => {
    const el = graphBoxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0)
        setGraphSize({
          width: Math.round(r.width),
          height: Math.round(r.height),
        });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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
      nodes: clusters.map((c) => ({
        id: c.id,
        name: c.name,
        doc_count: c.doc_count,
      })),
      links: clusterEdges.filter(passFilter),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clusters, clusterEdges, showSem, showCit, minSemNum],
  );

  // Level 2: dokumen dalam satu klaster + edge antar mereka.
  const docNodes = useMemo(
    () => (level == null ? [] : nodes.filter((n) => n.cluster === level)),
    [nodes, level],
  );
  const docGraph = useMemo(
    () => ({
      nodes: docNodes.map((n) => ({ ...n, id: Number(n.id) })),
      links: edges
        .filter((e) => passFilter(e))
        .filter(
          (e) =>
            docNodes.some((n) => Number(n.id) === Number(e.source)) &&
            docNodes.some((n) => Number(n.id) === Number(e.target)),
        )
        .map((e) => ({
          ...e,
          source: Number(e.source),
          target: Number(e.target),
        })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docNodes, edges, showSem, showCit, minSemNum],
  );

  // Mode "Semua Dokumen": semua dokumen lintas klaster + semua edge yang lolos
  // filter. Backend sudah mengirim cluster per node + edge lintas dokumen.
  const allDocGraph = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n, id: Number(n.id) })),
      links: edges
        .filter((e) => passFilter(e))
        .map((e) => ({
          ...e,
          source: Number(e.source),
          target: Number(e.target),
        })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, showSem, showCit, minSemNum],
  );

  // Fokus untuk highlight lingkungan: node hover (atau dokumen terpilih di Level 2).
  const focusId = hovered ?? selected;
  const neighborIds = useMemo(() => {
    if (focusId == null) return null;
    const links =
      view === "map"
        ? clusterGraph.links
        : view === "all"
          ? allDocGraph.links
          : docGraph.links;
    const s = new Set<number>([focusId]);
    for (const l of links as any[]) {
      const a = Number(l.source);
      const b = Number(l.target);
      if (a === focusId) s.add(b);
      if (b === focusId) s.add(a);
    }
    return s;
  }, [focusId, level, clusterGraph.links, allDocGraph.links, docGraph.links]);

  // Ukuran node ∝ jumlah relasi (derajat) — dokumen paling terhubung terlihat.
  const degree = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of docGraph.links as any[]) {
      m.set(Number(l.source), (m.get(Number(l.source)) ?? 0) + 1);
      m.set(Number(l.target), (m.get(Number(l.target)) ?? 0) + 1);
    }
    return m;
  }, [docGraph.links]);
  const degreeAll = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of allDocGraph.links as any[]) {
      m.set(Number(l.source), (m.get(Number(l.source)) ?? 0) + 1);
      m.set(Number(l.target), (m.get(Number(l.target)) ?? 0) + 1);
    }
    return m;
  }, [allDocGraph.links]);

  // Konfigurasi force per mode. Ditempatkan setelah memo degree/degreeAll karena
  // deps effect mereferensinya (deps dievaluasi saat render → TDZ bila di atas).
  useEffect(() => {
    const g = fgRef.current;
    if (!g) return;
    if (view === "map") {
      // Level 1 (klaster): bubble renggang supaya edge antar-klaster terlihat.
      // Charge sebanding jari-jari (bubble besar tolak lebih kuat) + link panjang
      // dengan tarikan lemah + collide agar bubble tak saling tumpuk.
      const radius = (n: any) => 16 + Math.min(n.doc_count ?? 1, 45) / 1.5;
      g.d3Force("charge")?.strength((n: any) => -6 * radius(n));
      g.d3Force("link")?.distance(
        (l: any) => 100 + Math.min((l.semantic ?? 0) / 4, 40),
      );
      g.d3Force("link")?.strength(0.05);
      g.d3Force("x", null);
      g.d3Force("y", null);
      g.d3Force("clusterX", null);
      g.d3Force("clusterY", null);
      g.d3Force(
        "bounds",
        boundsForce(
          () => graphDataRef.current.nodes,
          radius,
          graphSize.width,
          graphSize.height,
          40,
        ),
      );
      g.d3Force(
        "collide",
        collideForce(() => graphDataRef.current.nodes, radius, 14),
      );
    } else if (view === "all") {
      // Mode "Semua Dokumen" — combined network ala Dashboard Hilirisasi.
      // Semua dokumen lintas klaster dalam satu graf: charge kuat + link panjang
      // + collide radius+10 agar node tak menumpuk, ditambah forceX/Y per klaster
      // supaya dokumen tiap klaster tersusun dalam kolom yang mudah dibaca.
      const radius = (n: any) => docRadius(n, degreeAll);
      g.d3Force("charge")?.strength(-300);
      g.d3Force("link")?.distance(100);
      g.d3Force("link")?.strength(0.8);
      g.d3Force("center", null);
      // Kolom klaster dihitung dari data memo, bukan g.graphData() — instance
      // graph belum tentu siap saat effect berjalan (lihat g.graphData bukan fungsi).
      const ids = (
        [
          ...new Set(allDocGraph.nodes.map((n: any) => n.cluster as number)),
        ] as number[]
      ).sort((a, b) => a - b);
      const mX = 70;
      const colX = (c: number) =>
        ids.length <= 1
          ? graphSize.width / 2
          : (ids.indexOf(c) / (ids.length - 1)) * (graphSize.width - 2 * mX) +
            mX;
      g.d3Force("clusterX", (alpha: number) => {
        const k = 0.09 * alpha;
        for (const n of graphDataRef.current.nodes) {
          const tx = colX(n.cluster as number);
          n.vx = (n.vx ?? 0) + (tx - (n.x ?? 0)) * k;
        }
      });
      g.d3Force("clusterY", (alpha: number) => {
        // Stagger dua baris per kolom agar kolom tak jadi satu garis datar.
        const k = 0.06 * alpha;
        const h = graphSize.height;
        for (const n of graphDataRef.current.nodes) {
          const ty =
            h / 2 + (((n.cluster as number) % 2 === 0 ? 1 : -1) * h) / 8;
          n.vy = (n.vy ?? 0) + (ty - (n.y ?? 0)) * k;
        }
      });
      g.d3Force(
        "bounds",
        boundsForce(
          () => graphDataRef.current.nodes,
          radius,
          graphSize.width,
          graphSize.height,
          30,
        ),
      );
      g.d3Force(
        "collide",
        collideForce(() => graphDataRef.current.nodes, radius, 10),
      );
    } else {
      // Level 2 (dokumen satu klaster): spacing standar + collide & bounds
      // agar dokumen tak menumpuk (sebelumnya collide di-null → node bertumpuk).
      const radius = (n: any) => docRadius(n, degree);
      g.d3Force("charge")?.strength(-70);
      g.d3Force("link")?.distance(45);
      g.d3Force("link")?.strength(0.25);
      g.d3Force("x", null);
      g.d3Force("y", null);
      g.d3Force("clusterX", null);
      g.d3Force("clusterY", null);
      g.d3Force(
        "bounds",
        boundsForce(
          () => graphDataRef.current.nodes,
          radius,
          graphSize.width,
          graphSize.height,
          30,
        ),
      );
      g.d3Force(
        "collide",
        collideForce(() => graphDataRef.current.nodes, radius, 10),
      );
    }
  }, [view, level, graphSize, degree, degreeAll]);

  // Pencarian dokumen (drilldown klaster atau mode semua dokumen).
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (view === "map" || q.length < 2) return [];
    const hay = view === "all" ? nodes : docNodes;
    return hay.filter((n) => n.filename.toLowerCase().includes(q)).slice(0, 6);
  }, [search, view, nodes, docNodes]);

  // Relasi terkuat untuk panel insight (peta klaster = antar-klaster, selain itu antar-dokumen).
  const topRelations = useMemo(() => {
    const links =
      view === "map"
        ? clusterGraph.links
        : view === "all"
          ? allDocGraph.links
          : docGraph.links;
    const nameOf = (id: number) => {
      if (view === "map")
        return clusters.find((c) => c.id === id)?.name ?? `#${id}`;
      return nodes.find((n) => Number(n.id) === id)?.filename ?? `#${id}`;
    };
    return (links as GraphEdge[])
      .map((l) => ({
        a: nameOf(Number((l as any).source)),
        b: nameOf(Number((l as any).target)),
        sem: l.semantic,
        cit: l.citations,
        score: Math.max(l.semantic ?? 0, l.citations ?? 0),
      }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 5);
  }, [
    view,
    clusterGraph.links,
    allDocGraph.links,
    docGraph.links,
    clusters,
    nodes,
  ]);

  const hoveredCluster =
    view === "map" && hovered != null
      ? (clusters.find((c) => c.id === hovered) ?? null)
      : null;

  // Ring highlight pencarian hilang setelah beberapa detik.
  useEffect(() => {
    if (flashId == null) return;
    const t = setTimeout(() => setFlashId(null), 3000);
    return () => clearTimeout(t);
  }, [flashId]);

  const centerOnNode = (id: number) => {
    setSearch("");
    setSelected(id);
    setFlashId(id);
    const n = fgRef.current
      ?.graphData()
      .nodes.find((x: any) => Number(x.id) === id);
    if (n && n.x != null) fgRef.current?.centerAt(n.x, n.y, 900);
  };

  const activeCluster = clusters.find((c) => c.id === level) ?? null;
  const selectedNode = useMemo(
    () => nodes.find((n) => Number(n.id) === selected) ?? null,
    [nodes, selected],
  );

  const related = useMemo(() => {
    if (selected == null) return [];
    return edges
      .filter(
        (e) => Number(e.source) === selected || Number(e.target) === selected,
      )
      .map((e) => {
        const otherId =
          Number(e.source) === selected ? Number(e.target) : Number(e.source);
        return {
          doc: nodes.find((n) => Number(n.id) === otherId),
          sem: e.semantic,
          cit: e.citations,
        };
      })
      .filter(
        (x): x is { doc: GraphNode; sem: number | null; cit: number | null } =>
          x.doc != null,
      )
      .sort(
        (a, b) =>
          Math.max(b.sem ?? 0, b.cit ?? 0) - Math.max(a.sem ?? 0, a.cit ?? 0),
      );
  }, [selected, edges, nodes]);

  const hasGraph = !loading && nodes.length > 0;
  // Cermin graphData aktif agar getter force selalu membaca data terkini.
  graphDataRef.current =
    view === "map" ? clusterGraph : view === "all" ? allDocGraph : docGraph;

  // Fit-to-view setelah layout menetap (onEngineStop), bukan timer tetap — saat
  // data pertama tiba node masih mengumpul di tengah, fit di 120ms terlalu cepat
  // lalu charge menyebarkan node keluar dari hasil zoom.
  const pendingFit = useRef(false);
  useEffect(() => {
    if (hasGraph) pendingFit.current = true;
  }, [hasGraph]);
  useEffect(() => {
    if (hasGraph) pendingFit.current = true;
  }, [view, level, hasGraph]);

  return (
    <>
      <PageHeader eyebrow="RELASI DOKUMEN" title="Relasi Dokumen" />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card interactive={false}>
          <div
            ref={graphBoxRef}
            className="relative h-[560px] overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
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
                width={graphSize.width}
                height={graphSize.height}
                graphData={
                  view === "map"
                    ? clusterGraph
                    : view === "all"
                      ? allDocGraph
                      : docGraph
                }
                backgroundColor="rgba(255,255,255,0)"
                nodeLabel={(n: any) =>
                  view === "map"
                    ? `${n.name} — ${n.doc_count} dokumen`
                    : n.filename
                }
                nodeCanvasObject={(n: any, ctx, globalScale) => {
                  const x = n.x ?? 0;
                  const y = n.y ?? 0;
                  const id = Number(n.id);
                  // Redupkan yang bukan node fokus / tetangganya → struktur terbaca.
                  const dim =
                    focusId != null && id !== focusId && !neighborIds?.has(id);
                  if (view === "map") {
                    // Bubble klaster.
                    const r = 16 + Math.min(n.doc_count ?? 1, 45) / 1.5;
                    if (dim) ctx.globalAlpha = 0.2;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, 2 * Math.PI);
                    ctx.fillStyle = CLUSTER_COLOR[n.id] ?? DEFAULT_NODE_COLOR;
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#ffffff";
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    if (flashId === id) {
                      ctx.beginPath();
                      ctx.arc(x, y, r + 6, 0, 2 * Math.PI);
                      ctx.lineWidth = 3;
                      ctx.strokeStyle = "#0f172a";
                      ctx.stroke();
                    }
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.globalAlpha = dim ? 0.35 : 1;
                    ctx.font = "700 12px system-ui, sans-serif";
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(truncate(String(n.name), 26), x, y - 4);
                    ctx.font = "600 10px system-ui, sans-serif";
                    ctx.fillStyle = "rgba(255,255,255,0.9)";
                    ctx.fillText(`${n.doc_count} dokumen`, x, y + 12);
                    ctx.globalAlpha = 1;
                    return;
                  }
                  // Dokumen: disc warna + label. Ukuran ∝ jumlah relasi (derajat).
                  // Mode "Semua Dokumen": warna per klaster; drilldown: warna tipe file.
                  const r = docRadius(n, view === "all" ? degreeAll : degree);
                  if (dim) ctx.globalAlpha = 0.2;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI);
                  ctx.fillStyle =
                    view === "all"
                      ? (CLUSTER_COLOR[n.cluster as number] ??
                        DEFAULT_NODE_COLOR)
                      : nodeColor(n.file_type);
                  ctx.fill();
                  ctx.lineWidth = 1.5;
                  ctx.strokeStyle = "#ffffff";
                  ctx.stroke();
                  ctx.globalAlpha = 1;
                  if (selected === id) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#0f172a";
                    ctx.stroke();
                  }
                  if (flashId === id) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "#f59e0b";
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
                    ctx.fillStyle = dim ? "#94a3b8" : "#1e293b";
                    ctx.fillText(label, x, y + r + 2);
                  }
                }}
                nodePointerAreaPaint={(n: any, color, ctx) => {
                  const x = n.x ?? 0;
                  const y = n.y ?? 0;
                  ctx.beginPath();
                  ctx.arc(x, y, view === "map" ? 22 : 12, 0, 2 * Math.PI);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
                linkColor={(l: any) => {
                  if (focusId != null) {
                    const a = Number(l.source);
                    const b = Number(l.target);
                    if (a !== focusId && b !== focusId)
                      return "rgba(148,163,184,0.08)";
                  }
                  return edgeColor(l as GraphEdge);
                }}
                linkWidth={(l: any) =>
                  view === "map"
                    ? clusterEdgeWidth(l as GraphEdge)
                    : edgeWidth(l as GraphEdge)
                }
                linkLabel={(l: any) => {
                  const parts: string[] = [];
                  if (l.semantic != null)
                    parts.push(`Kemiripan ${Number(l.semantic).toFixed(2)}`);
                  if ((l.citations ?? 0) > 0)
                    parts.push(`${l.citations}× dikutip bersama`);
                  const pair = parts.join(" · ");
                  if (view === "map") {
                    const a =
                      clusters.find((c) => c.id === Number(l.source))?.name ??
                      "";
                    const b =
                      clusters.find((c) => c.id === Number(l.target))?.name ??
                      "";
                    return pair ? `${a} ↔ ${b}\n${pair}` : `${a} ↔ ${b}`;
                  }
                  return pair || "terhubung";
                }}
                linkCurvature={0.2}
                linkDirectionalParticles={(l: any) =>
                  (l.citations ?? 0) > 0 ? 2 : 0
                }
                // Tanpa ini, loop repaint berhenti setelah layout menetap dan perubahan
                // nodeCanvasObject/linkColor (hover dim) tak pernah digambar ulang.
                autoPauseRedraw={false}
                d3VelocityDecay={0.35}
                // Engine stop default = 15s (cooldownTime) → fit-to-view selalu telat
                // 15 detik. Turunkan agar layout membingkai diri ~4s setelah data/level
                // berubah (d3AlphaMin default 0, jadi cooldownTime satu-satunya penghenti).
                cooldownTime={4000}
                onNodeHover={(n: any) =>
                  setHovered(n == null ? null : Number(n.id))
                }
                onEngineStop={() => {
                  if (pendingFit.current) {
                    pendingFit.current = false;
                    fgRef.current?.zoomToFit(500, 40);
                  }
                }}
                onNodeClick={(n: any) => {
                  if (view === "map") {
                    setSelected(null);
                    setLevel(Number(n.id));
                    setView("cluster");
                  } else {
                    setSelected(Number(n.id));
                  }
                }}
                onBackgroundClick={() => setSelected(null)}
              />
            )}

            {/* Breadcrumb kembali ke peta klaster */}
            {hasGraph && view !== "map" && (
              <button
                onClick={() => {
                  setView("map");
                  setLevel(null);
                  setSelected(null);
                }}
                className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/85 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur hover:bg-white"
              >
                {view === "all" ? (
                  <>
                    Semua Klaster <span className="text-slate-400">▸</span>{" "}
                    Semua Dokumen
                  </>
                ) : (
                  <>
                    Semua Klaster <span className="text-slate-400">▸</span>
                    <span style={{ color: CLUSTER_COLOR[level ?? 1] }}>
                      {activeCluster?.name}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Toolbar kaca mengambang */}
            {hasGraph && (
              <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-white/60 bg-white/85 px-4 py-3 shadow-lg backdrop-blur">
                <button
                  onClick={() => {
                    setView(view === "map" ? "all" : "map");
                    setSelected(null);
                    setLevel(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  {view === "map" ? "Semua Dokumen" : "Peta Klaster"}
                </button>
                <span className="h-4 w-px bg-slate-200" />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showSem}
                    onChange={(e) => setShowSem(e.target.checked)}
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: C_SEM }}
                  />
                  Semantik
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showCit}
                    onChange={(e) => setShowCit(e.target.checked)}
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: C_CIT }}
                  />
                  Dikutip bersama
                </label>
                {view !== "map" && (
                  <div className="w-32">
                    <Select
                      value={minSem}
                      onChange={(e) => setMinSem(e.target.value)}
                    >
                      <option value="0.3">Ambang 0.3</option>
                      <option value="0.4">Ambang 0.4</option>
                      <option value="0.5">Ambang 0.5</option>
                      <option value="0.6">Ambang 0.6</option>
                      <option value="0.7">Ambang 0.7</option>
                    </Select>
                  </div>
                )}
                {view !== "map" && (
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari dokumen…"
                      className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchMatches.length > 0 && (
                      <div className="absolute bottom-full left-0 z-30 mb-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                        {searchMatches.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => centerOnNode(Number(m.id))}
                            className="block w-full truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
                          >
                            {m.filename}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span
                  className="cursor-help text-xs font-bold text-slate-400 hover:text-slate-600"
                  title={
                    'Skor semantik = kemiripan makna antar dokumen (0–1), dihitung dari embedding teks.\n"Dikutip bersama" = kedua dokumen muncul bersama dalam jawaban AI yang sama.'
                  }
                >
                  ⓘ
                </span>
                <span className="text-[11px] text-slate-400">
                  {view === "map"
                    ? `${clusters.length} klaster · ${clusterEdges.filter(passFilter).length} relasi`
                    : view === "all"
                      ? `${allDocGraph.nodes.length} dokumen · ${allDocGraph.links.length} relasi`
                      : `${docNodes.length} dokumen · ${docGraph.links.length} relasi`}
                </span>
              </div>
            )}

            {/* Legend: makna warna edge & node */}
            {hasGraph && (
              <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-white/60 bg-white/85 px-3 py-2 text-[11px] text-slate-600 shadow-lg backdrop-blur">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-[3px] w-5 rounded"
                      style={{ background: C_SEM }}
                    />{" "}
                    semantik
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-[3px] w-5 rounded"
                      style={{ background: C_CIT }}
                    />{" "}
                    dikutip bersama
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-[3px] w-5 rounded"
                      style={{ background: "#059669" }}
                    />{" "}
                    keduanya
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {view === "map" ? (
                    <span>ukuran bubble = jumlah dokumen</span>
                  ) : view === "all" ? (
                    <>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: "#94a3b8" }}
                        />{" "}
                        warna = klaster tematik
                      </span>
                      <span>ukuran = jumlah relasi</span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: "#1d4ed8" }}
                        />{" "}
                        paparan
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: "#047857" }}
                        />{" "}
                        laporan
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: "#64748b" }}
                        />{" "}
                        lainnya
                      </span>
                      <span>ukuran = jumlah relasi</span>
                    </>
                  )}
                </div>
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
              {view === "map" ? (
                <>
                  <p className="text-sm text-slate-500">
                    Peta {clusters.length} klaster tematik. Hover klaster untuk
                    ringkasan; klik untuk membuka dokumen di dalamnya. Klik
                    "Semua Dokumen" untuk menggabungkan seluruh dokumen lintas
                    klaster dalam satu jaringan.
                  </p>
                  {hoveredCluster && (
                    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background:
                              CLUSTER_COLOR[hoveredCluster.id] ??
                              DEFAULT_NODE_COLOR,
                          }}
                        />
                        {hoveredCluster.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {hoveredCluster.doc_count} dokumen
                      </p>
                      {hoveredCluster.keywords &&
                        hoveredCluster.keywords.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {hoveredCluster.keywords.map((k) => (
                              <span
                                key={k}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                  {topRelations.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-extrabold text-slate-700">
                        Relasi Terkuat Antar Klaster
                      </p>
                      <ul className="space-y-2">
                        {topRelations.map((r, i) => (
                          <li
                            key={i}
                            className="rounded-md border border-slate-100 px-3 py-2"
                          >
                            <p
                              className="truncate text-xs font-semibold text-slate-800"
                              title={`${r.a} ↔ ${r.b}`}
                            >
                              {r.a} ↔ {r.b}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {r.sem != null && (
                                <span style={{ color: C_SEM }}>
                                  semantik {r.sem.toFixed(2)}
                                </span>
                              )}
                              {r.sem != null && r.cit != null && (
                                <span> · </span>
                              )}
                              {r.cit != null && (
                                <span style={{ color: C_CIT }}>
                                  {r.cit}× dikutip bersama
                                </span>
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
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
                    <Badge tone="completed">
                      {selectedNode.chunk_count} chunk
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Sumber: {selectedNode.source}
                  </p>
                  <a href={`/api/documents/${selectedNode.id}/file`} download>
                    <Button variant="secondary" className="mt-4 w-full">
                      Unduh file
                    </Button>
                  </a>
                  {related.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm font-extrabold text-slate-700">
                        Dokumen terkait
                      </p>
                      <ul className="space-y-2">
                        {related.slice(0, 8).map((r) => (
                          <li
                            key={r.doc.id}
                            className="rounded-md border border-slate-100 px-3 py-2"
                          >
                            <p
                              className="truncate text-xs font-semibold text-slate-800"
                              title={r.doc.filename}
                            >
                              {r.doc.filename}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {r.sem != null && (
                                <span style={{ color: C_SEM }}>
                                  semantik {r.sem.toFixed(2)}
                                </span>
                              )}
                              {r.sem != null && r.cit != null && (
                                <span> · </span>
                              )}
                              {r.cit != null && (
                                <span style={{ color: C_CIT }}>
                                  {r.cit}× dikutip bersama
                                </span>
                              )}
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
              {view !== "map" && topRelations.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-extrabold text-slate-700">
                    Relasi Terkuat{" "}
                    {view === "all" ? "Antar Dokumen" : "dalam Klaster"}
                  </p>
                  <ul className="space-y-2">
                    {topRelations.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-slate-100 px-3 py-2"
                      >
                        <p
                          className="truncate text-xs font-semibold text-slate-800"
                          title={`${r.a} ↔ ${r.b}`}
                        >
                          {r.a} ↔ {r.b}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {r.sem != null && (
                            <span style={{ color: C_SEM }}>
                              semantik {r.sem.toFixed(2)}
                            </span>
                          )}
                          {r.sem != null && r.cit != null && <span> · </span>}
                          {r.cit != null && (
                            <span style={{ color: C_CIT }}>
                              {r.cit}× dikutip bersama
                            </span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
