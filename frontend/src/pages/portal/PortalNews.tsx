import { Link } from "react-router-dom";
import { usePortalContent } from "./usePortalContent";

/*
 * Daftar Berita + Detail Berita — reproduksi `renderNewsListPage()` dan
 * `renderNewsDetailPage()` dari PMP Portal.html.
 *
 * Rute: `/berita` (list) dan `/berita/:slug` (detail).
 */
export function PortalNews() {
  const { news } = usePortalContent();
  return (
    <section className="section" style={{ background: "white" }}>
      <div className="container">
        <p className="eyebrow">Berita</p>
        <h1 className="page-title">Berita</h1>
        <div className="grid-2" style={{ marginTop: 40 }}>
          {news.map((item) => (
            <Link to={`/berita/${item.slug}`} className="card" key={item.slug}>
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

export function PortalNewsDetail({ slug }: { slug: string }) {
  const { news } = usePortalContent();
  const item = news.find((n) => n.slug === slug);

  if (!item) {
    return (
      <section className="section">
        <div className="container empty-page">
          <p className="eyebrow">PMP Portal</p>
          <h1 className="page-title">Berita tidak ditemukan</h1>
          <p className="muted" style={{ maxWidth: 720, fontSize: "1.05rem", lineHeight: 1.8 }}>
            Silakan pilih berita dari halaman Berita.
          </p>
        </div>
      </section>
    );
  }

  const relatedNews = news.filter((n) => n.slug !== item.slug && n.category === item.category);

  return (
    <>
      <section className="article-hero section">
        <div className="container">
          <p className="language-pill">{item.category}</p>
          <h1 style={{ maxWidth: 960, fontSize: "clamp(2rem,4.5vw,3.8rem)", lineHeight: 1.08 }}>
            {item.title}
          </h1>
          <p>
            {item.date} • {item.author}
          </p>
        </div>
      </section>
      <section className="section" style={{ background: "white", paddingTop: 0 }}>
        <div className="container">
          <img className="article-image" src={item.image} alt={item.title} />
          <div className="article-body">
            <p style={{ padding: 22, borderRadius: "var(--radius-lg)", background: "#eff6ff" }}>
              {item.excerpt}
            </p>
            {item.content.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            {item.gallery?.length ? (
              <div style={{ marginTop: 60 }}>
                <h2 style={{ marginBottom: 20, color: "var(--slate-900)" }}>📸 Galeri Pelaksanaan</h2>
                <div className="gallery-grid">
                  {item.gallery.map((image, i) => (
                    <img key={i} src={image} alt={item.title} loading="lazy" />
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 70 }}>
              <h2 style={{ marginBottom: 24, color: "var(--slate-900)" }}>Berita Terkait</h2>
              {relatedNews.length ? (
                <div className="grid-2">
                  {relatedNews.slice(0, 3).map((n) => (
                    <Link to={`/berita/${n.slug}`} className="card" key={n.slug}>
                      <img
                        className="headline-image"
                        style={{ height: 220 }}
                        src={n.image}
                        alt={n.title}
                        loading="lazy"
                      />
                      <div className="card-body">
                        <p className="meta">
                          {n.date} • {n.category}
                        </p>
                        <h3 style={{ marginTop: 8, color: "var(--slate-900)" }}>{n.title}</h3>
                        <p className="muted">{n.excerpt}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="card-body" style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>📄</div>
                    <h3 style={{ margin: "0 0 8px" }}>Belum Ada Berita Terkait</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Belum terdapat berita lain dengan kategori <strong>{item.category}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}