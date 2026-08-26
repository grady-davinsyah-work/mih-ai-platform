import { Link } from "react-router-dom";
import { publications } from "../../data/portal";

/*
 * Daftar Publikasi + Detail Publikasi — reproduksi `renderPublicationListPage()`
 * dan `renderPublicationDetailPage()` dari PMP Portal.html.
 *
 * Rute: `/publikasi` (list) dan `/publikasi/:slug` (detail).
 */
export function PortalPublication() {
  return (
    <section className="section" style={{ background: "white" }}>
      <div className="container">
        <p className="eyebrow">Publikasi Resmi</p>
        <h1 className="page-title">Publikasi</h1>
        <div className="grid-2" style={{ marginTop: 40 }}>
          {publications.map((item) => (
            <Link to={`/publikasi/${item.slug}`} className="card" key={item.slug}>
              <img
                className="headline-image"
                style={{ height: 260 }}
                src={item.image}
                alt={item.title}
                loading="lazy"
              />
              <div className="card-body">
                <p className="meta">
                  {item.date} - {item.category}
                </p>
                <h2 style={{ fontSize: "1.28rem", color: "var(--slate-900)" }}>{item.title}</h2>
                <p className="muted">{item.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PortalPublicationDetail({ slug }: { slug: string }) {
  const item = publications.find((p) => p.slug === slug);

  if (!item) {
    return (
      <section className="section">
        <div className="container empty-page">
          <p className="eyebrow">PMP Portal</p>
          <h1 className="page-title">Publikasi tidak ditemukan</h1>
          <p className="muted" style={{ maxWidth: 720, fontSize: "1.05rem", lineHeight: 1.8 }}>
            Silakan pilih publikasi dari daftar Publikasi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="article-hero section" style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
        <div className="container">
          <p className="language-pill" style={{ background: "var(--amber-500)" }}>
            {item.category}
          </p>
          <h1 style={{ maxWidth: 960, fontSize: "clamp(2rem,4.5vw,3.8rem)", lineHeight: 1.08 }}>
            {item.title}
          </h1>
          <p>
            {item.date} • Oleh {item.author}
          </p>
        </div>
      </section>
      <section className="section" style={{ background: "white", paddingTop: 0 }}>
        <div className="container">
          <img className="article-image" src={item.image} alt={item.title} />
          <div className="article-body">
            <p
              style={{
                padding: 22,
                borderRadius: "var(--radius-lg)",
                background: "#f0fdf4",
                color: "#166534",
                borderLeft: "5px solid #22c55e",
              }}
            >
              {item.excerpt}
            </p>
            <div className="download-box">
              <div className="download-info">
                <span className="download-icon">📄</span>
                <div>
                  <h4 style={{ margin: 0, color: "var(--slate-900)" }}>{item.documentName}</h4>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
                    Klik tombol di kanan untuk mengakses berkas lengkap publikasi.
                  </p>
                </div>
              </div>
              <a
                href={item.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="button primary"
                style={{ minHeight: 38, fontSize: "0.9rem" }}
              >
                Akses Dokumen
              </a>
            </div>
            {item.content.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}