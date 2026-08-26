import { Link } from "react-router-dom";
import { portalImages } from "../../data/portal";

/*
 * Footer publik landpage — reproduksi `renderFooter()` dari PMP Portal.html.
 * `logoLight` dipakai di footer; link pakai react-router Link.
 */
export default function PortalFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <img src={portalImages.logoLight} alt="PMP Logo" style={{ maxWidth: 140, marginBottom: 8 }} />
          <p style={{ lineHeight: 1.8 }}>
            Portal resmi PMP untuk menyediakan informasi publik, publikasi,
            layanan internal, dan dashboard monitoring.
          </p>
        </div>
        <div>
          <h3>Navigasi</h3>
          <div className="footer-links">
            <Link to="/">Beranda</Link>
            <Link to="/profil/kedeputian">Profil</Link>
            <Link to="/berita">Berita</Link>
            <Link to="/publikasi">Publikasi</Link>
          </div>
        </div>
        <div>
          <h3>Kontak</h3>
          <div className="footer-links">
            <p>Jl. Taman Suropati No. 2 Jakarta Pusat</p>
            <p>(021) 12345678</p>
            <p>pmp@bappenas.go.id</p>
          </div>
        </div>
        <div>
          <h3>Sosial Media</h3>
          <div className="footer-links">
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://www.facebook.com" target="_blank" rel="noreferrer">
              Facebook
            </a>
            <a href="https://www.youtube.com" target="_blank" rel="noreferrer">
              YouTube
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>&copy; {new Date().getFullYear()} PMP Portal. All rights reserved.</span>
          <span>Developed by PMP</span>
        </div>
      </div>
    </footer>
  );
}