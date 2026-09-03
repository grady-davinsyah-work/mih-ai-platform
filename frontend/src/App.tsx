import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  Link,
  Outlet,
  useParams,
} from "react-router-dom";
import { api, type User } from "./api";
import Login from "./pages/Login";
import Playground from "./pages/Playground";
import Documents from "./pages/Documents";
import DocumentGraph from "./pages/DocumentGraph";
import Admin from "./pages/Admin";

import PortalLayout from "./pages/portal/PortalLayout";
import PortalHome from "./pages/portal/PortalHome";
import PortalDeputy from "./pages/portal/PortalDeputy";
import PortalUnit from "./pages/portal/PortalUnit";
import { PortalNews, PortalNewsDetail } from "./pages/portal/PortalNews";
import {
  PortalPublication,
  PortalPublicationDetail,
} from "./pages/portal/PortalPublication";
import PortalService from "./pages/portal/PortalService";
import PortalDashboard from "./pages/portal/PortalDashboard";
import { externalDashboards, portalImages } from "./data/portal";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-[15px] font-bold transition-colors ${
    isActive ? "text-blue-900" : "text-slate-700 hover:text-blue-900"
  }`;

/* ===== Route wrapper untuk path params ===== */
function NewsDetailRoute() {
  const { slug } = useParams();
  return <PortalNewsDetail slug={slug!} />;
}
function PublicationDetailRoute() {
  const { slug } = useParams();
  return <PortalPublicationDetail slug={slug!} />;
}
function UnitRoute() {
  const { slug } = useParams();
  return <PortalUnit slug={slug!} />;
}
function LeaderRoute() {
  const { slug } = useParams();
  return <PortalUnit slug={slug!} mode="leader" />;
}
function ServiceRoute() {
  const { slug } = useParams();
  return <PortalService slug={slug!} />;
}
function DashboardRoute() {
  const { slug } = useParams();
  return <PortalDashboard slug={slug!} />;
}

/* ===== Internal (logged-in) ===== */
function Topbar() {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="bg-blue-950 text-white">
      <div className="container flex min-h-[44px] items-center gap-[18px] text-sm">
        <span>{today}</span>
        <span aria-hidden className="h-[22px] w-px bg-white/20" />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1">
          <strong>ID</strong> Indonesia
        </span>
        <span className="ml-auto hidden text-xs text-slate-300 md:block">
          Macro Intelligence Hub (MIH) Kedeputian PMP
        </span>
      </div>
    </div>
  );
}

/* Sticky white site header with wordmark + nav + user (mirrors template .site-header) */
function SiteHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0_1px_12px_rgba(15,23,42,0.08)]">
      <div className="container flex min-h-[80px] items-center justify-between gap-6">
        <Link to="/" className="flex items-center">
          <img className="logo" src={portalImages.logoDark} alt="PMP Logo" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          <NavLink to="/playground" className={navClass}>
            Playground
          </NavLink>
          <div className="group relative">
            <button className="text-[15px] font-bold text-slate-700 transition-colors hover:text-blue-900">
              Dokumen ▾
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-56 rounded-lg border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
              <Link
                to="/documents"
                className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-900"
              >
                Daftar Dokumen
              </Link>
              <Link
                to="/documents/relasi"
                className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-900"
              >
                Relasi Dokumen
              </Link>
            </div>
          </div>
          {user.is_admin && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
          <div className="group relative">
            <button className="text-[15px] font-bold text-slate-700 transition-colors hover:text-blue-900">
              Dashboard ▾
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-56 rounded-lg border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
              {externalDashboards.map((d) => (
                <Link
                  key={d.slug}
                  to={`/dashboard/${d.slug}`}
                  className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-900"
                >
                  {d.title}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-semibold text-slate-600 sm:block">
            {user.name}
          </span>
          <button
            onClick={onLogout}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 transition-colors hover:border-blue-900 hover:text-blue-900"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}

/* Blue-950 footer with Navigasi/Kontak columns (mirrors template .footer) */
function Footer() {
  return (
    <footer className="mt-20 bg-blue-950 text-white">
      <div className="container grid gap-9 py-14 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="PMP Logo" className="h-11 w-auto" />
            <span className="text-lg font-extrabold">Kedeputian Makro</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Platform internal kedeputian untuk menjawab pertanyaan atas dokumen
            perencanaan makro pembangunan, mengelola koleksi dokumen, serta
            memantau kinerja layanan.
          </p>
        </div>
        <div>
          <h3 className="text-base font-extrabold">Navigasi</h3>
          <div className="mt-4 grid gap-2.5 text-sm">
            <Link to="/playground" className="text-slate-300 hover:text-white">
              Playground
            </Link>
            <Link to="/documents" className="text-slate-300 hover:text-white">
              Dokumen
            </Link>
            <Link to="/admin" className="text-slate-300 hover:text-white">
              Admin
            </Link>
          </div>
        </div>
        <div>
          <h3 className="text-base font-extrabold">Kontak</h3>
          <div className="mt-4 grid gap-2.5 text-sm text-slate-300">
            <p>Kedeputian Bidang Perencanaan Makro Pembangunan, Bappenas</p>
            <p>Jalan Taman Suropati No. 2, Jakarta Pusat</p>
            <p>makro@bappenas.go.id</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-wrap justify-between gap-4 py-4 text-sm text-slate-300">
          <span>
            © {new Date().getFullYear()} Kedeputian Makro. All rights reserved.
          </span>
          <span>Developed by PMP</span>
        </div>
      </div>
    </footer>
  );
}

/* Layout aplikasi internal (Playground/Documents/Admin) */
function InternalLayout({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen">
      <Topbar />
      <SiteHeader user={user} onLogout={onLogout} />
      <main className="container pt-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  /* ===Development By Pass Login === 
  const FRONTEND_ONLY = true;

  const MOCK_USER: User = {
    id: 1,
    name: "Admin Preview",
    email: "admin@localhost",
    unit_kerja: "Preview",
    is_admin: true,
  };

  const [user, setUser] = useState<User | null>(
    FRONTEND_ONLY ? MOCK_USER : null,
  );

  const [loading, setLoading] = useState(!FRONTEND_ONLY);

  useEffect(() => {
    if (FRONTEND_ONLY) return;

    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  ==== Development By Pass Login === */

  /* ===Production=== */
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /* ===== Production === */

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">Memuat…</div>
    );

  /* ===== Guest: landing publik + login ===== */
  if (!user) {
    return (
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/" element={<PortalHome />} />
          <Route path="/berita" element={<PortalNews />} />
          <Route path="/berita/:slug" element={<NewsDetailRoute />} />
          <Route path="/publikasi" element={<PortalPublication />} />
          <Route path="/publikasi/:slug" element={<PublicationDetailRoute />} />
          <Route path="/profil/kedeputian" element={<PortalDeputy />} />
          <Route path="/profil/unit/:slug" element={<UnitRoute />} />
          <Route path="/profil/pimpinan/:slug" element={<LeaderRoute />} />
          <Route path="/layanan/:slug" element={<ServiceRoute />} />
          <Route path="/dashboard/:slug" element={<DashboardRoute />} />
        </Route>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  /* ===== User: internal app ===== */
  const handleLogout = () => api.logout().finally(() => setUser(null));

  return (
    <Routes>
      {/* Landing page tetap tampil saat login — menu/tautan private ikut muncul.
          Dashboard route di sini agar halaman dashboard memakai chrome portal. */}
      <Route element={<PortalLayout user={user} onLogout={handleLogout} />}>
        <Route path="/" element={<PortalHome />} />
        <Route path="/berita" element={<PortalNews />} />
        <Route path="/berita/:slug" element={<NewsDetailRoute />} />
        <Route path="/publikasi" element={<PortalPublication />} />
        <Route path="/publikasi/:slug" element={<PublicationDetailRoute />} />
        <Route path="/profil/kedeputian" element={<PortalDeputy />} />
        <Route path="/profil/unit/:slug" element={<UnitRoute />} />
        <Route path="/profil/pimpinan/:slug" element={<LeaderRoute />} />
        <Route path="/layanan/:slug" element={<ServiceRoute />} />
        <Route path="/dashboard/:slug" element={<DashboardRoute />} />
      </Route>

      {/* Aplikasi internal (dari header landing via "Agen AI") */}
      <Route element={<InternalLayout user={user} onLogout={handleLogout} />}>
        <Route path="/playground" element={<Playground />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/relasi" element={<DocumentGraph />} />
        <Route
          path="/admin"
          element={user.is_admin ? <Admin /> : <Navigate to="/playground" />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
