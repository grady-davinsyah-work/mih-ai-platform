import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, Link } from "react-router-dom";
import { api, type User } from "./api";
import Login from "./pages/Login";
import Playground from "./pages/Playground";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-[15px] font-bold transition-colors ${
    isActive ? "text-blue-900" : "text-slate-700 hover:text-blue-900"
  }`;

/* Blue-950 strip with today's date + language pill (mirrors template .topbar) */
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
          Portal Dokumen Kedeputian Makro
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
        <Link to="/playground" className="flex items-center gap-3">
          <img src="/favicon.svg" alt="PMP Logo" className="h-11 w-auto" />
          <span className="leading-tight">
            <span className="block text-base font-extrabold text-slate-900">
              Kedeputian Bidang Perencanaan Makro
            </span>
            <span className="block text-xs font-semibold text-blue-900">
              Portal Dokumen & Playground AI
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          <NavLink to="/playground" className={navClass}>Playground</NavLink>
          <NavLink to="/documents" className={navClass}>Dokumen</NavLink>
          {user.is_admin && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
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
            <Link to="/playground" className="text-slate-300 hover:text-white">Playground</Link>
            <Link to="/documents" className="text-slate-300 hover:text-white">Dokumen</Link>
            <Link to="/admin" className="text-slate-300 hover:text-white">Admin</Link>
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
          <span>© {new Date().getFullYear()} Kedeputian Makro. All rights reserved.</span>
          <span>Developed by PMP</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Memuat…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen">
      <Topbar />
      <SiteHeader
        user={user}
        onLogout={() => api.logout().finally(() => setUser(null))}
      />
      <main className="container pt-10">
        <Routes>
          <Route path="/" element={<Navigate to="/playground" />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/admin" element={user.is_admin ? <Admin /> : <Navigate to="/playground" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
