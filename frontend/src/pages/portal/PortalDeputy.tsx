import { Link } from "react-router-dom";
import { units } from "../../data/portal";

/*
 * Prodi Kedeputian — reproduksi `renderDeputyPage()` dari PMP Portal.html.
 * Grid unit kerja dengan link detail unit + profil pimpinan.
 */
export default function PortalDeputy() {
  return (
    <section className="section" style={{ background: "white" }}>
      <div className="container">
        <p className="eyebrow">Profil Struktur</p>
        <h1 className="page-title">Kedeputian Bidang Perencanaan Makro Pembangunan</h1>
        <p className="muted" style={{ maxWidth: 850, fontSize: "1.05rem", lineHeight: 1.85 }}>
          Kedeputian ini mendukung perencanaan pembangunan nasional melalui koordinasi kebijakan
          makro, fiskal, moneter, sektor keuangan, hilirisasi, kerja sama ekonomi internasional,
          serta tata kelola perencanaan pembangunan.
        </p>
        <div className="grid-2" style={{ marginTop: 34 }}>
          {units.map((unit) => (
            <div className="card" key={unit.slug}>
              <div className="card-body">
                <h3 style={{ marginTop: 0, color: "var(--slate-900)" }}>{unit.name}</h3>
                <p className="muted" style={{ marginBottom: 16 }}>
                  Pimpinan: <strong>{unit.head}</strong>
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <Link
                    to={`/profil/unit/${unit.slug}`}
                    style={{ color: "var(--blue-900)", fontWeight: 700, fontSize: "0.9rem" }}
                  >
                    🏢 Detail Unit
                  </Link>
                  <span style={{ color: "var(--slate-300)" }}>|</span>
                  <Link
                    to={`/profil/pimpinan/${unit.slug}`}
                    style={{ color: "var(--amber-500)", fontWeight: 700, fontSize: "0.9rem" }}
                  >
                    👤 Profil Pimpinan
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}