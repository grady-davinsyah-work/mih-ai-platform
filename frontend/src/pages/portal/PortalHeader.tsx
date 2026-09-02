import { useState } from "react";
import { Link } from "react-router-dom";
import {
  portalImages,
  portalMenus,
  type PortalMenuItem,
} from "../../data/portal";
import { usePortalAuth } from "./PortalLayout";

/*
 * Header publik landpage — reproduksi `renderHeader()` dari PMP Portal.html.
 * Dropdown memakai CSS hover asli (.dropdown:hover .dropdown-panel).
 * Login-aware: menu dengan status "private" hanya muncul saat user login,
 * tombol berubah Login → Logout, dan muncul tautan ke aplikasi internal.
 */
export default function PortalHeader() {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const { user, onLogout } = usePortalAuth();
  const isLoggedIn = !!user;

  const visibleMenus = portalMenus.filter(
    (m) => m.status === "public" || isLoggedIn,
  );

  const closeMobile = () => {
    setMobileOpen(false);
    setOpenSubmenu(null);
  };

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>{today}</span>
          <span
            style={{
              width: 1,
              height: 22,
              background: "rgba(255,255,255,.22)",
            }}
          />
          <span className="language-pill">
            <strong>ID</strong> Indonesia
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="flex items-center">
            <img className="logo" src={portalImages.logoDark} alt="PMP Logo" />
          </Link>

          <nav className="desktop-nav">
            {visibleMenus.map((menu) => renderMenuItem(menu))}
            {isLoggedIn && (
              <Link to="/playground" className="nav-link">
                Agen AI
              </Link>
            )}
          </nav>

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--slate-600)",
                }}
              >
                {user!.name}
              </span>
              <button onClick={onLogout} className="button primary">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="button primary">
              Login
            </Link>
          )}

          <button
            className="mobile-toggle"
            id="mobile-toggle"
            aria-label="Buka menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            Menu
          </button>
        </div>

        <nav
          className={`mobile-menu${mobileOpen ? " open" : ""}`}
          id="mobile-menu"
        >
          {visibleMenus.map((menu) =>
            renderMobileItem(menu, closeMobile, openSubmenu, setOpenSubmenu),
          )}
          {isLoggedIn && (
            <Link to="/playground" className="nav-link" onClick={closeMobile}>
              Agen AI
            </Link>
          )}
          {isLoggedIn ? (
            <button
              className="button primary"
              onClick={() => {
                closeMobile();
                onLogout();
              }}
            >
              Logout
            </button>
          ) : (
            <Link to="/login" className="button primary" onClick={closeMobile}>
              Login
            </Link>
          )}
        </nav>
      </header>

      <div className="integrity-marquee">
        <div className="integrity-marquee-track">
          <div className="integrity-marquee-content">
            <span>
              <strong className="marquee-red">Integritas</strong> dimulai dari
              diri sendiri. Patuhi{" "}
              <strong className="marquee-red">disiplin</strong> dan{" "}
              <strong className="marquee-red">
                kode etik ASN Kementerian PPN/Bappenas
              </strong>
              . Menemukan{" "}
              <strong className="marquee-red">dugaan penyimpangan</strong> atau{" "}
              <strong className="marquee-red">benturan kepentingan</strong>?{" "}
              <strong className="marquee-red">Laporkan</strong> melalui{" "}
              <strong className="marquee-red">WBS Bappenas</strong>{" "}
              <a
                href="https://wbs.bappenas.go.id"
                target="_blank"
                rel="noopener noreferrer"
                className="marquee-link"
              >
                (wbs.bappenas.go.id)
              </a>
              atau <strong className="marquee-red">SP4N-LAPOR!</strong>{" "}
              (lapor.go.id).
            </span>
          </div>

          {/* Duplicate supaya animasi berjalan terus tanpa jeda */}
          <div className="integrity-marquee-content" aria-hidden="true">
            <span>
              <strong className="marquee-red">Integritas</strong> dimulai dari
              diri sendiri. Patuhi{" "}
              <strong className="marquee-red">disiplin</strong> dan{" "}
              <strong className="marquee-red">
                kode etik ASN Kementerian PPN/Bappenas
              </strong>
              . Menemukan{" "}
              <strong className="marquee-red">dugaan penyimpangan</strong> atau{" "}
              <strong className="marquee-red">benturan kepentingan</strong>?{" "}
              <strong className="marquee-red">Laporkan</strong> melalui{" "}
              <strong className="marquee-red">WBS Bappenas</strong>{" "}
              (wbs.bappenas.go.id) atau{" "}
              <strong className="marquee-red">SP4N-LAPOR!</strong>{" "}
              (lapor.go.id).
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function renderMenuItem(menu: PortalMenuItem) {
  if (!menu.children) {
    return (
      <Link key={menu.name} to={menu.path!} className="nav-link">
        {menu.name}
      </Link>
    );
  }
  return (
    <div key={menu.name} className="dropdown">
      <button className="nav-link">{menu.name} </button>
      <div
        className="dropdown-panel"
        style={{ maxHeight: 450, overflowY: "auto" }}
      >
        <div className="dropdown-title">
          <strong>{menu.name}</strong>
          <p style={{ margin: "4px 0 0", color: "#dbeafe" }}>
            Pilih halaman {menu.name.toLowerCase()}
          </p>
        </div>
        <div className="dropdown-list">
          {menu.children.map((child) => (
            <Link key={child.path} to={child.path}>
              {child.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderMobileItem(
  menu: PortalMenuItem,
  close: () => void,
  openSubmenu: string | null,
  setOpenSubmenu: (name: string | null) => void,
) {
  if (!menu.children) {
    return (
      <Link key={menu.name} to={menu.path!} onClick={close}>
        {menu.name}
      </Link>
    );
  }
  const isOpen = openSubmenu === menu.name;
  return (
    <div key={menu.name}>
      <button
        data-mobile-parent={menu.name}
        onClick={() => setOpenSubmenu(isOpen ? null : menu.name)}
      >
        {menu.name} {isOpen ? "▲" : "v"}
      </button>
      <div
        className={`mobile-children${isOpen ? " open" : ""}`}
        data-mobile-children={menu.name}
      >
        {menu.children.map((child) => (
          <Link key={child.path} to={child.path} onClick={close}>
            {child.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
