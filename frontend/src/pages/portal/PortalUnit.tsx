import { Link } from "react-router-dom";
import { units, portalImages } from "../../data/portal";

/*
 * Detail Unit Kerja + Profil Pimpinan — reproduksi `renderUnitPage()` dan
 * `renderLeaderPage()` dari PMP Portal.html. Field berisi HTML mentah
 * dirender via dangerouslySetInnerHTML. `unit.image` adalah kunci ke
 * `portalImages`.
 *
 * Rute: `/profil/unit/:slug` (mode unit) dan
 *        `/profil/pimpinan/:slug` (mode leader, prop `mode="leader"`).
 */
export default function PortalUnit({
  slug,
  mode = "unit",
}: {
  slug: string;
  mode?: "unit" | "leader";
}) {
  const unit = units.find((u) => u.slug === slug);

  if (!unit) {
    return (
      <section className="section">
        <div className="container empty-page">
          <p className="eyebrow">PMP Portal</p>
          <h1 className="page-title">
            {mode === "leader" ? "Data pimpinan tidak ditemukan" : "Unit tidak ditemukan"}
          </h1>
          <p className="muted" style={{ maxWidth: 720, fontSize: "1.05rem", lineHeight: 1.8 }}>
            Silakan pilih {mode === "leader" ? "pejabat pimpinan" : "unit kerja"} dari menu Profil.
          </p>
        </div>
      </section>
    );
  }

  if (mode === "leader") {
    return (
      <>
        <section className="section" style={{ background: "white", paddingBottom: 40 }}>
          <div className="container">
            <p className="eyebrow">Profil Pimpinan Terkait</p>
            <h1 className="page-title">Profil Pejabat Struktural</h1>
          </div>
        </section>
        <section className="container unit-layout" style={{ paddingBottom: 80 }}>
          <div style={{ textAlign: "center" }}>
            <img
              className="unit-photo"
              src={portalImages[unit.image]}
              alt={unit.head}
              style={{ marginBottom: 16 }}
            />
            <Link
              to={`/profil/unit/${unit.slug}`}
              className="sidebar-link"
              style={{ justifyContent: "center", border: "1px solid var(--slate-200)", background: "white" }}
            >
              🏢 Lihat Profil Unit Kerja
            </Link>
          </div>
          <div className="card">
            <div className="card-body" style={{ padding: 40 }}>
              <span className="eyebrow" style={{ color: "var(--amber-500)", fontSize: "0.75rem" }}>
                {unit.position}
              </span>
              <h2 style={{ marginTop: 4, color: "var(--slate-900)", fontSize: "2.2rem", lineHeight: 1.2, marginBottom: 12 }}>
                {unit.head}
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 24,
                  color: "var(--slate-600)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                <span>✉️ Email:</span>
                <a
                  href={`mailto:${unit.email || "pimpinan@bappenas.go.id"}`}
                  style={{ color: "var(--blue-900)", textDecoration: "underline" }}
                >
                  {unit.email || "pimpinan@bappenas.go.id"}
                </a>
              </div>
              <div
                style={{
                  lineHeight: 1.9,
                  fontSize: "1.05rem",
                  color: "var(--slate-700)",
                  borderTop: "1px solid var(--slate-100)",
                  paddingTop: 20,
                }}
                dangerouslySetInnerHTML={{ __html: unit.profilPimpinanId }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="section" style={{ background: "white", paddingBottom: 40 }}>
        <div className="container">
          <p className="eyebrow">Profil Struktur</p>
          <h1 className="page-title">{unit.name}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Sub-bagian struktur dari Kedeputian Bidang Perencanaan Makro Pembangunan.
          </p>
        </div>
      </section>
      <div className="container service-layout" style={{ paddingBottom: 80 }}>
        <aside className="service-sidebar">
          <div className="sidebar-menu-title">Daftar Unit Kerja PMP</div>
          {units.map((u) => (
            <Link
              key={u.slug}
              className={`sidebar-link${u.slug === unit.slug ? " active" : ""}`}
              to={`/profil/unit/${u.slug}`}
            >
              {u.name}
            </Link>
          ))}
        </aside>
        <article className="card">
          <div className="card-body" style={{ padding: 40 }}>
            <h2 style={{ marginTop: 0, color: "var(--slate-900)", borderBottom: "2px solid var(--slate-100)", paddingBottom: 12 }}>
              Tugas Utama Unit Kerja
            </h2>
            <p style={{ lineHeight: 1.9, fontSize: "1.05rem", marginBottom: 32 }}>{unit.tugasUnitKerjaId}</p>
            <h2 style={{ marginTop: 40, color: "var(--slate-900)", borderBottom: "2px solid var(--slate-100)", paddingBottom: 12 }}>
              Fungsi Unit Kerja
            </h2>
            <div style={{ lineHeight: 1.9, fontSize: "1.05rem" }} dangerouslySetInnerHTML={{ __html: unit.fungsiUnitKerjaId }} />
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px dashed var(--slate-200)" }}>
              <Link to={`/profil/pimpinan/${unit.slug}`} className="button primary" style={{ minHeight: 38, fontSize: "0.9rem" }}>
                Lihat Profil Pimpinan Unit ➔
              </Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}