# Desain: Landpage Portal PMP sebagai Landing sebelum Login MIH

**Tanggal**: 2026-08-26
**Status**: Disetujui (design review)
**Scope**: Frontend React (MIH)

## 1. Tujuan

Menjadikan landpage publik Kedeputian Bidang Perencanaan Makro Pembangunan
(PMP Portal) sebagai halaman masuk (`/`) aplikasi MIH sebelum login. Klik
**Login** di landpage → form login MIH yang sudah ada. Setelah login, user
masuk aplikasi internal (Playground/Dokumen/Admin) dengan akses tambahan ke
dashboard eksternal (Kinerja, Arthakarya, Agent AI) lewat iframe.

## 2. Konteks Saat Ini

- `frontend/` = React 19 + Vite + Tailwind + react-router-dom.
- `App.tsx`: jika `!user` tampilkan `<Login />`, jika login tampilkan app
  internal (Topbar + SiteHeader + Footer) dengan rute `/playground`,
  `/documents`, `/admin` (rute `/` redirect ke `/playground`).
- Auth nyata via `api.login()`, `api.me()`, `api.logout()` (session cookie).
- `PMP Portal.html` (2.1 MB, disimpan dari `https://tokogd.com/web-pmp.html`)
  berisi landpage statis berbasis hash-router dengan data: units, news,
  publications, services, menus, dashboards, dan IMAGE_DATA. Tidak masuk git
  (`??`).

## 3. Arsitektur Routing (`frontend/src/App.tsx`)

**Belum login** (outer return):
```
/f        -> PortalHome (landing publik)
/login    -> Login MIH (form email+password)
*         -> Navigate ke /
```

**Sudah login** (app internal, seperti sekarang) + tambahan rute:
```
/playground
/documents
/admin        (hanya jika user.is_admin)
/dashboard/:slug -> PortalDashboard (iframe eksternal, guard login)
```

Aturan redirect:
- Login user membuka `/` → redirect ke `/playground`.
- Menghilangkan render `<Login />` langsung pada `!user`; diganti distribusi
  rute publik di atas.

## 4. Data Statis (`frontend/src/data/portal.ts`)

Diekstrak dari file HTML ke TypeScript. Tipe + konstanta:

- `Unit { slug, name, head, position, email, image, profil, tugas, fungsi }`
- `News { slug, title, excerpt, image, category, author, date, gallery, content[] }`
- `Publication { slug, title, excerpt, image, category, author, date, documentUrl, documentName, content[] }`
- `Service { slug, name, description, documents: {type,pdf,title,url}[] }`
- `portalMenus` — nav publik: Beranda, Profil (units), Data (Berita, Publikasi), Layanan (services)
- `portalImages` — peta nama → URL (logoDark, logoLight, avatar pimpinan)
- `externalDashboards: { slug, title, url }[]` (Kinerja, Arthakarya, Agent AI)

Konten (kutipan, paragraf) dipertahankan apa adanya dari file HTML.

## 5. Komponen Landing

Semua merender dengan class CSS asli (lihat §6).

- `PortalHome.tsx` — hero carousel, grid berita terbaru, publikasi terbaru,
  tautan eksternal. Header publik (Topbar + nav publik + tombol Login) +
  Footer di-render bersama. Carousel otomatis (auto-advance).
- `PortalUnit.tsx` — profil unit, biodata pimpinan, tugas/fungsi.
- `PortalNews.tsx` — list berita + detail berita (gallery + lightbox).
- `PortalPublication.tsx` — list + detail publikasi (view PDF via iframe/URL).
- `PortalService.tsx` — halaman layanan dengan dokumen PDF/gambar.
- `PortalDashboard.tsx` — iframe ke URL dashboard eksternal; guard login:
  jika `!user` redirect ke `/login`. Menu "Dashboard" ditambahkan di SiteHeader
  aplikasi internal (hanya saat login) memetakan `externalDashboards`.

Rute publik memakai path-landing di bawah `/` (tidak bentrok dgn app internal).
Contoh pemetaan:
- `/`             → PortalHome
- `/profil/:slug` → PortalUnit
- `/berita`       → list berita
- `/berita/:slug` → detail berita
- `/publikasi`    → list publikasi
- `/publikasi/:slug` → detail
- `/layanan/:slug` → PortalService
- `/login`        → Login

## 6. Styling

- Salin CSS dari `<style>` file HTML ke `frontend/src/portal.css`.
- `portal.css` di-import hanya oleh halaman landing (dari `PortalHome`/komponen
  landing) — bukan global — untuk menghindari bentrok Tailwind.
- Semua class komponen landing memakai CSS ini agar tampilan persis aslinya.

## 7. Aset

- URL absolut gambar (Google Drive thumbnails, Unsplash) dipertahankan di data.
- Aset lokal dari `PMP Portal_files/` (logo PMP, screenshot berita) disalin
  ke `frontend/public/portal/` (atau `src/assets/`).
- `PMP Portal.html` dan `PMP Portal_files/` tidak disentuh dan tidak masuk git
  (tetap untracked).

## 8. File yang Berubah / Dibuat

Baru:
- `frontend/src/data/portal.ts`
- `frontend/src/portal.css`
- `frontend/src/pages/PortalHome.tsx`
- `frontend/src/pages/PortalUnit.tsx`
- `frontend/src/pages/PortalNews.tsx`
- `frontend/src/pages/PortalPublication.tsx`
- `frontend/src/pages/PortalService.tsx`
- `frontend/src/pages/PortalDashboard.tsx`
- Aset lokal di `frontend/public/portal/`

Ubah:
- `frontend/src/App.tsx` (routing publik + internal, redirect `/` saat login)
- `frontend/src/pages/Login.tsx` (tambahkan tautan balik ke `/` landpage)
- `frontend/src/pages/... header internal` (opsional: menu Dashboard)

## 9. Pengujian

- `npm run build` (tsc -b + vite build) di `frontend/` lolos.
- `npm run lint` bersih.
- Manual (dev, `npm run dev` di frontend + backend):
  1. Buka `/` → landing tampil lengkap (hero, berita, publikasi, layanan).
  2. Klik Login → form login MIH.
  3. Login sukses → redirect `/playground`.
  4. Menu Dashboard tampil → buka iframe eksternal.
  5. Nav publik (Profil/Data/Layanan) utuh; detail berita & gallery berfungsi.

## 10. Di Luar Scope

- Update konten lewat backend/API (konten statis di frontend).
- Otentikasi dashboard eksternal (terserah app eksternal masing-masing).
- Migrasi data runtime dari MongoDB/Postgres.