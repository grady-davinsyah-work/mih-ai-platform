import { Link } from "react-router-dom";
import { externalDashboards } from "../../data/portal";

/*
 * Dashboard eksternal (iframe) — reproduksi `renderDashboardPage()` dari
 * PMP Portal.html.
 *
 * Rute `/dashboard/:slug` dipakai DI KEDUA branch:
 *  - guest  (PublicRoutes): semua dashboard private → menampilkan "Akses Ditolak".
 *  - user   (internal App) : iframe penuh 150vh setelah login.
 *
 * Komponen ini sengaja TIDAK bergantung pada portal.css (yang hanya aktif di
 * PortalLayout): menggunakan Tailwind utility agar styling benar di internal
 * app tempat portal.css tidak dimuat.
 */
export default function PortalDashboard({ slug }: { slug: string }) {
  const activeDash = externalDashboards.find((d) => d.slug === slug);

  if (!activeDash) {
    return (
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-900">
            PMP Portal
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
            Dashboard tidak ditemukan
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
            Silakan pilih dashboard monitoring yang tersedia pada menu.
          </p>
        </div>
      </section>
    );
  }

  if (activeDash.status === "private") {
    return (
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-900">
            PMP Portal
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Akses Ditolak</h1>
          <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
            Anda harus login terlebih dahulu untuk melihat {activeDash.title} ini.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-900 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800"
          >
            Login
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pb-5">
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-900">
          Monitoring Data
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{activeDash.title}</h1>
      </section>
      <div className="pb-20">
        <div className="overflow-hidden rounded-[22px] shadow-sm">
          <div className="relative w-full bg-slate-100">
            <iframe
              src={activeDash.url}
              width="100%"
              style={{ border: "none", display: "block", height: "150vh" }}
              allowFullScreen
              title={activeDash.title}
            />
          </div>
        </div>
      </div>
    </>
  );
}