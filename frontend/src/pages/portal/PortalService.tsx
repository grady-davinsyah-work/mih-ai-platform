import { Link } from "react-router-dom";
import { services } from "../../data/portal";

/*
 * Detail Layanan — reproduksi `renderServicePage()` dari PMP Portal.html.
 * Sidebar daftar layanan; dokumen pdf di-iframe, dokumen image ditampilkan.
 *
 * Rute: `/layanan/:slug`.
 */
export default function PortalService({ slug }: { slug: string }) {
  const activeService = services.find((s) => s.slug === slug) || services[0];

  return (
    <>
      <section className="section" style={{ background: "white", paddingBottom: 40 }}>
        <div className="container">
          <p className="eyebrow">Layanan Publik</p>
          <h1 className="page-title">{activeService.name}</h1>
        </div>
      </section>
      <div className="container service-layout" style={{ paddingBottom: 80 }}>
        <aside className="service-sidebar">
          <div className="sidebar-menu-title">Daftar Layanan PMP</div>
          {services.map((srv) => (
            <Link
              key={srv.slug}
              className={`sidebar-link${srv.slug === activeService.slug ? " active" : ""}`}
              to={`/layanan/${srv.slug}`}
            >
              {srv.name}
            </Link>
          ))}
        </aside>
        <article className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0, color: "var(--slate-900)", fontSize: "1.6rem", borderBottom: "1px solid var(--slate-100)", paddingBottom: 12 }}>
              Deskripsi Layanan
            </h2>
            <p className="muted" style={{ fontSize: "1.08rem", lineHeight: 1.85, marginBottom: 32 }}>
              {activeService.description}
            </p>
            <h2 style={{ color: "var(--slate-900)", fontSize: "1.6rem", marginTop: 40 }}>
              📂 Lampiran & Panduan Teknis
            </h2>
            {activeService.documents?.length ? (
              activeService.documents.map((doc, idx) =>
                doc.type === "pdf" ? (
                  <div className="document-viewer-card" key={idx}>
                    <div className="document-viewer-header">
                      <span>📄</span> {doc.title}
                    </div>
                    <div style={{ position: "relative", width: "100%", height: 550, background: "var(--slate-100)" }}>
                      <iframe
                        src={doc.url}
                        width="100%"
                        height="100%"
                        allow="autoplay"
                        title={doc.title}
                        style={{ border: "none" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="document-viewer-card" key={idx}>
                    <div className="document-viewer-header" style={{ background: "var(--blue-900)" }}>
                      <span>📸</span> {doc.title} (Klik gambar untuk memperbesar)
                    </div>
                    <div className="gallery-grid" style={{ marginTop: 0, gap: 0 }}>
                      <img
                        src={doc.url}
                        alt={doc.title}
                        style={{ borderRadius: 0, height: "auto", maxHeight: 500, width: "100%" }}
                      />
                    </div>
                  </div>
                )
              )
            ) : (
              <p className="muted">Belum ada dokumen lampiran untuk layanan ini.</p>
            )}
          </div>
        </article>
      </div>
    </>
  );
}