import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { externalLinks } from "../../data/portal";
import { usePortalAuth } from "./PortalLayout";
import { usePortalContent } from "./usePortalContent";

/*
 * Beranda publik — reproduksi `renderHomePage()` dari PMP Portal.html.
 * - Carousel berita diambil 5 item pertama; navigasi via useState (bukan
 *   window.switchSlide global).
 * - Embed komoditas (iframe) & EWS inflasi (iframe) dipertahankan apa adanya.
 * - Link eksternal: tampilkan hanya yang public (lingkungan pra-login).
 * - Grid publikasi memakai `publications-grid-home`.
 */
export default function PortalHome() {
  const { user } = usePortalAuth();
  const { news, publications } = usePortalContent();
  const limitedNews = news.slice(0, 5);
  const [slide, setSlide] = useState(0);
  const linksScrollerRef = useRef<HTMLDivElement>(null);

  const switchSlide = (index: number) => {
    const n = limitedNews.length;
    if (index >= n) setSlide(0);
    else if (index < 0) setSlide(n - 1);
    else setSlide(index);
  };

  const visibleExternalLinks = externalLinks.filter(
    (l) => l.status === "public" || !!user,
  );

  const scrollLinks = (direction: "prev" | "next") => {
    linksScrollerRef.current?.scrollBy({
      left: direction === "next" ? 240 : -240,
      behavior: "smooth",
    });
  };

  return (
    <>
      {/* ===== Hero carousel ===== */}
      <section className="hero-carousel-section">
        <div className="carousel-container">
          {limitedNews.map((item, index) => (
            <div
              className={`carousel-slide${index === slide ? " active" : ""}`}
              key={item.slug}
            >
              <Link to={`/berita/${item.slug}`}>
                <img
                  className="carousel-image"
                  src={item.image}
                  alt={item.title}
                />
              </Link>
              <div className="carousel-overlay">
                <div className="container">
                  <div className="carousel-content">
                    <span className="eyebrow">{item.category}</span>
                    <h2 className="carousel-title">
                      <Link to={`/berita/${item.slug}`}>{item.title}</Link>
                    </h2>
                    <p className="carousel-excerpt">{item.excerpt}</p>
                    <Link to={`/berita/${item.slug}`} className="button amber">
                      Baca Selengkapnya ➔
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            className="carousel-nav-btn prev"
            onClick={() => switchSlide(slide - 1)}
            aria-label="Slide sebelumnya"
          >
            ❮
          </button>
          <button
            className="carousel-nav-btn next"
            onClick={() => switchSlide(slide + 1)}
            aria-label="Slide berikutnya"
          >
            ❯
          </button>
          <div className="carousel-dots">
            {limitedNews.map((_, index) => (
              <button
                key={index}
                className={`carousel-dot${index === slide ? " active" : ""}`}
                onClick={() => setSlide(index)}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Embed Iframe Komoditas ===== */}
      <section
        className="section"
        style={{ background: "#f8fafc", paddingTop: 40, paddingBottom: 20 }}
      >
        <div className="container">
          <div
            className="card"
            style={{
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--slate-200)",
            }}
          >
            <iframe
              src="http://tokogd.com/commodity.html"
              width="100%"
              style={{ border: "none", display: "block", height: 65 }}
              allowFullScreen
              title="Komoditas"
            />
          </div>
        </div>
      </section>

      {/* ===== Tautan Luar horizontal ===== */}
      <section
        className="section"
        style={{ background: "white", paddingTop: 20, paddingBottom: 40 }}
      >
        <div className="container">
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                margin: 0,
                color: "var(--slate-900)",
                fontSize: "1.6rem",
                fontWeight: 700,
              }}
            >
              Tautan
            </h2>
          </div>
          <div className="external-links-section">
            <button
              className="carousel-square-arrow-btn"
              onClick={() => scrollLinks("prev")}
              aria-label="Tautan sebelumnya"
            >
              ❮
            </button>
            <div ref={linksScrollerRef} className="links-carousel-wrapper">
              {visibleExternalLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-item-card"
                >
                  <div className="link-item-logo-container">
                    <img
                      src={link.label}
                      alt={link.name}
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        const fb = img.nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                    <div
                      style={{
                        display: "none",
                        width: "100%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "var(--slate-400)",
                        fontSize: "0.8rem",
                        background: "#f1f5f9",
                      }}
                    >
                      [Logo {link.name}]
                    </div>
                  </div>
                  <h4>{link.name}</h4>
                </a>
              ))}
            </div>
            <button
              className="carousel-square-arrow-btn"
              onClick={() => scrollLinks("next")}
              aria-label="Tautan berikutnya"
            >
              ❯
            </button>
          </div>
        </div>
      </section>

      {/* ===== Embed EWS Inflasi ===== */}
      <section
        className="section"
        style={{ background: "#f8fafc", paddingTop: 20, paddingBottom: 40 }}
      >
        <div className="container">
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                margin: 0,
                color: "var(--slate-900)",
                fontSize: "1.6rem",
                fontWeight: 700,
              }}
            >
              Early Warning System Inflasi
            </h2>
          </div>
          <div
            className="card"
            style={{
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--slate-200)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                background: "var(--slate-100)",
              }}
            >
              <iframe
                src="https://ewsinflasi.bappenas.go.id/inflasi.html"
                width="100%"
                height="100%"
                style={{ border: "none", display: "block" }}
                allowFullScreen
                title="EWS Inflasi"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Embed Dashboard Hilirisasi ===== */}
      <section
        className="section"
        style={{ background: "#f8fafc", paddingTop: 20, paddingBottom: 40 }}
      >
        <div className="container">
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                margin: 0,
                color: "var(--slate-900)",
                fontSize: "1.6rem",
                fontWeight: 700,
              }}
            >
              Hilirisasi 18 Komoditas Prioritas
            </h2>
          </div>
          <div
            className="card"
            style={{
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--slate-200)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                background: "var(--slate-100)",
              }}
            >
              <iframe
                src="https://hilirisasi.tatakelolapmp.workers.dev"
                width="100%"
                height="100%"
                style={{ border: "none", display: "block" }}
                allowFullScreen
                title="Hilirisasi 18 Komoditas Prioritas"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Publikasi ===== */}
      <section className="section" style={{ background: "white" }}>
        <div className="container">
          <div className="section-header">
            <div>
              <p className="eyebrow">Dokumen & Kajian</p>
              <h2>Publikasi</h2>
            </div>
            <Link to="/publikasi" className="button">
              Lihat Semua
            </Link>
          </div>
          <div className="publications-grid-home">
            {publications.map((pub) => (
              <article className="card" key={pub.slug}>
                <Link
                  to={`/publikasi/${pub.slug}`}
                  className="block overflow-hidden"
                  style={{ display: "block" }}
                >
                  <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
                    <img
                      src={pub.image}
                      alt={pub.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 300ms ease",
                      }}
                      loading="lazy"
                    />
                  </div>
                </Link>
                <div style={{ padding: 18 }}>
                  <p
                    className="eyebrow"
                    style={{
                      color: "var(--amber-500)",
                      marginBottom: 8,
                      fontSize: "0.75rem",
                    }}
                  >
                    {pub.category}
                  </p>
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      lineHeight: 1.4,
                      margin: "0 0 12px 0",
                      color: "var(--slate-900)",
                    }}
                  >
                    <Link
                      to={`/publikasi/${pub.slug}`}
                      style={{ color: "inherit" }}
                    >
                      {pub.title}
                    </Link>
                  </h3>
                  <time
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      color: "var(--slate-500)",
                    }}
                  >
                    {pub.date}
                  </time>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
