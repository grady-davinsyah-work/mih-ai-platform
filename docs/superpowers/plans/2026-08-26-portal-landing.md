# Landpage PMP sebagai Landing sebelum Login MIH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan landpage publik PMP (dari `PMP Portal.html`) sebagai halaman masuk (`/`) aplikasi MIH sebelum login, dengan konten statis di frontend dan login mengarah ke halaman Login MIH.

**Architecture:** Konten landpage (units, news, publications, services, menus, dashboard links) diekstrak dari file statis ke `frontend/src/data/portal.ts`. Komponen React merender landpage dengan CSS asli (disalin ke `portal.css`). Routing di `App.tsx`: belum login → route publik `/` + `/login`; sudah login → app internal + `/dashboard/:slug` (iframe eksternal).

**Tech Stack:** React 19, Vite, TypeScript, react-router-dom v7, Tailwind (app internal), CSS kustom (landing).

**Spec:** `docs/superpowers/specs/2026-08-26-portal-landing-design.md`

## Global Constraints

- Semua konten teks (kutipan, paragraf berita/publikasi) dipertahankan verbatim dari `PMP Portal.html`.
- CSS landpage disalin ke `frontend/src/portal.css`, di-import **hanya** oleh komponen landing (bukan global) untuk menghindari bentrok Tailwind.
- URL gambar absolut (Google Drive thumbnails, Unsplash) dipertahankan di data.
- File `PMP Portal.html` dan `PMP Portal_files/` tidak disentuh dan tidak masuk git.
- Login user membuka `/` → redirect ke `/playground`.
- Build wajib lolos: `cd frontend && npm run build` (tsc -b + vite build) dan `npm run lint`.
- Bahasa antarmuka: Indonesia (mengikuti app dan landpage).

---

### Task 1: Ekstrak CSS landpage ke `portal.css`

**Files:**
- Create: `frontend/src/portal.css`
- Reference (read-only): `PMP Portal.html` (blok `<style>` utama, baris 9–998)

**Interfaces:**
- Consumes: CSS asli dari `<style>` pertama file HTML.
- Produces: `frontend/src/portal.css` berisi semua aturan CSS class landing (`.topbar`, `.site-header`, `.hero-carousel-section`, `.carousel-slide`, `.section`, `.container`, `.card`, `.unit-layout`, `.service-layout`, `.gallery-grid`, `.article-hero`, `.article-body`, `.footer`, dll) + variabel `:root`.

- [ ] **Step 1: Salin blok CSS utama**

Buka `PMP Portal.html`. Blok `<style>` utama dimulai di baris 9 (`<style>`) dan berakhir di baris 998 (`</style>`). Salin **seluruh isi di antara** tag tersebut ke `frontend/src/portal.css`. Pertahankan apa adanya termasuk `:root` variabel, media queries, dan keyframes.

Catatan: jangan salin blok `<style>` kedua (baris ~1000+, yang merupakan ekstensi browser/antd shadowroot) — hanya blok pertama.

- [ ] **Step 2: Verifikasi CSS tersalin utuh**

Cek bahwa `frontend/src/portal.css` berisi variabel `:root` dengan `--blue-900: #1e3a8a`, dan mengandung selector kunci seperti `.hero-carousel-section`, `.carousel-slide`, `.unit-layout`, `.service-layout`, `.footer`. Jika ada yang hilang, salin lagi.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/portal.css
git commit -m "feat(portal): salin CSS landpage PMP ke portal.css"
```

---

### Task 2: Buat data statis `portal.ts`

**Files:**
- Create: `frontend/src/data/portal.ts`
- Reference (read-only): `PMP Portal.html` (data di baris 1166–1756)

**Interfaces:**
- Consumes: Data mentah dari file HTML (dashboards, units, services, news, publications, menus, IMAGE_DATA).
- Produces: Ekspor bernama berikut yang dipakai task-tasks selanjutnya:
  - `export interface Unit { slug; name; head; position; email; image; profil; tugas; fungsi }`
  - `export interface News { slug; title; excerpt; image; category; author; date; gallery: string[]; content: string[] }`
  - `export interface Publication { slug; title; excerpt; image; category; author; date; documentUrl; documentName; content: string[] }`
  - `export interface ServiceDoc { type: "pdf" | "image"; title: string; url: string }`
  - `export interface Service { slug; name; description; documents: ServiceDoc[] }`
  - `export interface DashboardLink { slug; title; url; status: "public" | "private" }`
  - `export interface PortalMenuItem { name: string; path?: string; children?: { name; path }[] }`
  - `export const units: Unit[]`
  - `export const news: News[]`
  - `export const publications: Publication[]`
  - `export const services: Service[]`
  - `export const portalImages: Record<string, string>`
  - `export const portalMenus: PortalMenuItem[]`
  - `export const externalDashboards: DashboardLink[]`

- [ ] **Step 1: Salin data units, news, publications, services**

Dari file HTML, salin array `units` (baris 1191–1510), `services` (1511–1537), `news` (1539–1692), `publications` (1693–1726) ke `portal.ts` sebagai konstanta bertipe. Pertahankan nilai verbatim.

Untuk `units`: peta field. File HTML memakai `head`, `position`, `email`, `image` (nama kunci di IMAGE_DATA), `profilPimpinanId` → `profil`, `tugasUnitKerjaId` → `tugas`, `fungsiUnitKerjaId` → `fungsi`.

- [ ] **Step 2: Salin IMAGE_DATA dan dashboards**

Salin `IMAGE_DATA` (baris 2618–2628) ke `portalImages`. Salin `dashboards` (baris 1166–1185) ke `externalDashboards` (tipe `DashboardLink[]`; field `url` tersedia).

- [ ] **Step 3: Bangun `portalMenus`**

Berdasarkan `menus` (baris 1729–1756), bangun struktur menu publik saja (Beranda, Profil→units, Data→Berita/Publikasi, Layanan→services). Menu `Dashboard` (private) **tidak** masuk `portalMenus` — dashboard eksternal di-handle terpisah di app internal.

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (tidak ada error tipe). Jika ada error pada field yang belum ada, perbaiki interface.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/portal.ts
git commit -m "feat(portal): tambah data statis landpage portal.ts"
```

---

### Task 3: Routing publik + internal di `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `PortalHome` (Task 5), `Login` (existing), `PortalDashboard` (Task 8), `PortalLayout` (Task 4).
- Produces: `App` mengekspor routing baru. `PortalHome` tidak menerima props; `Login` menerima `{ onLogin }` (existing). `PortalDashboard` tidak menerima props (membaca user dari context).

> **Catatan dependensi:** Task 4 (PortalLayout) harus selesai **sebelum** Task 3, karena Task 3 langsung memakai `PortalLayout` sebagai induk rute publik. Urutan eksekusi: Task 1 → 2 → 4 → 5 → 3 → 6 → 7 → 8 → 9 → 10. (Task 3 dan 7 digabung efektif; Task 3 membangun struktur routing awal memakai `PortalLayout`, Task 7 menambahkan rute anak detail setelah komponennya ada.)

- [ ] **Step 1: Restrukturisasi render saat belum login**

Di `App.tsx`, ganti return saat `!user` (sekarang `<Login onLogin={setUser} />`) menjadi blok routing publik memakai `PortalLayout`:

```tsx
if (!user)
  return (
    <Routes>
      <Route element={<PortalLayout />}>
        <Route path="/" element={<PortalHome />} />
      </Route>
      <Route path="/login" element={<Login onLogin={setUser} />} />
      <Route path="/dashboard/:slug" element={<Login onLogin={setUser} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
```

Catatan: `/dashboard/:slug` saat belum login → arahkan ke Login (guard; Login MIH bisa redirect ke dashboard setelah sukses). Impor `PortalHome`, `PortalLayout`, dan `Navigate`. Rute anak detail (`/profil/*`, `/berita/*`, dll) ditambahkan di Task 7.

- [ ] **Step 2: Tambah rute internal dashboard**

Di blok `<Routes>` internal (sesudah login), tambahkan rute:

```tsx
<Route path="/dashboard/:slug" element={<PortalDashboard />} />
```

Dan di `main` container, pastikan `PortalDashboard` dirender tanpa header publik (hanya header internal MIH + iframe). Jika rute internal sudah ada untuk `/` → `/playground`, biarkan.

- [ ] **Step 3: Login redirect ke dashboard bila perlu**

Di `Login.tsx`, setelah login sukses, redirect ke `location.state?.from ?? "/playground"` alih-alih hardcode. (Kecil; opsional — jika ingin tetap sederhana, biarkan `/playground`.)

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Login.tsx
git commit -m "feat(portal): routing publik landpage + login MIH"
```

---

### Task 4: Komponen layout publik (Header + Footer + Layout)

**Files:**
- Create: `frontend/src/pages/portal/PortalLayout.tsx`
- Create: `frontend/src/pages/portal/PortalHeader.tsx`
- Create: `frontend/src/pages/portal/PortalFooter.tsx`

**Interfaces:**
- Consumes: `portalImages`, `portalMenus` (Task 2); react-router `Link`, `useNavigate`.
- Produces:
  - `PortalLayout` — komponen pembungkus: `<PortalHeader />` + `<Outlet />` + `<PortalFooter />`, meng-import `portal.css`.
  - `PortalHeader` — Topbar (tanggal hari ini id-ID, pill "ID Indonesia"), site-header (logo → `/`, nav publik dropdown, tombol **Login** → `/login`, menu mobile). Props: none.
  - `PortalFooter` — footer publik (logo, Navigasi, Kontak, Sosial Media), sesuai `renderFooter()`.

- [ ] **Step 1: Buat `PortalLayout` dengan import CSS**

```tsx
import { Outlet } from "react-router-dom";
import "../../portal.css";
import PortalHeader from "./PortalHeader";
import PortalFooter from "./PortalFooter";

export default function PortalLayout() {
  return (
    <div>
      <PortalHeader />
      <main>
        <Outlet />
      </main>
      <PortalFooter />
    </div>
  );
}
```

- [ ] **Step 2: Buat `PortalHeader`**

Reproduksi struktur dari `renderHeader()` file HTML sebagai JSX:
- Topbar: tanggal `new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })`, separator, pill "ID Indonesia".
- Site-header: logo (`<Link to="/">`), nav dropdown publik (`portalMenus`), tombol Login (`<Link to="/login" className="button primary">Login</Link>`), mobile toggle.

Ganti `onclick`/`location.hash` dengan `react-router` `Link`/`useNavigate`. Ganti `window.handleAuthAction()` dengan `Link` ke `/login` (karena ini halaman publik; autentikasi nyata ada di Login MIH).

Menu mobile: gunakan `useState` untuk toggle `open`, sesuai markup asli (`mobile-toggle`, `mobile-menu`).

- [ ] **Step 3: Buat `PortalFooter`**

Reproduksi `renderFooter()` sebagai JSX: logo (`portalImages.logoLight`), kolom Navigasi (`Link`s), Kontak (teks), Sosial Media. Footer-bottom dengan © tahun + "Developed by PMP".

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/portal/
git commit -m "feat(portal): layout, header, footer publik"
```

---

### Task 5: `PortalHome` — halaman beranda

**Files:**
- Create: `frontend/src/pages/portal/PortalHome.tsx`

**Interfaces:**
- Consumes: `PortalLayout` (Task 4), `news`, `publications`, `portalImages` (Task 2), react-router `Link`.
- Produces: `PortalHome` — komponen default yang merender seluruh section beranda, dipakai di rute `/` (Task 3).

- [ ] **Step 1: Buat carousel komponen**

Di `PortalHome`, buat state `currentSlide` (number). Reproduksi markup carousel dari `renderHomePage()`:
- `limitedNews = news.slice(0, 5)`.
- Slide: `carousel-slide` dengan `active` jika index === currentSlide; gambar + overlay (eyebrow, title, excerpt, tombol "Baca Selengkapnya ➔" → `/berita/${slug}`).
- Nav buttons prev/next + dots. Handler `switchSlide(index)` mengubah state dengan wrap-around (index >= length → 0; index < 0 → length-1).

Tidak ada auto-advance di file asli — hanya manual. Pertahankan itu.

- [ ] **Step 2: Buat section commodity + tautan eksternal**

Reproduksi:
- Section iframe `commodity.html` (`<iframe src="http://tokogd.com/commodity.html" ...>`), tingginya 65px. Pertahankan URL asli.
- Section "Tautan": scroller horizontal. Data eksternal links dari `renderHomePage()` (Bappenas, FMS, Indonesia Emas 2045, Perpustakaan PMP — public saja di halaman publik). Gunakan `useRef` + `scrollBy({ left: ±240, behavior: "smooth" })` untuk prev/next.
- Section iframe EWS Inflasi (`https://ewsinflasi.bappenas.go.id/inflasi.html`), aspect-ratio 16/9.

- [ ] **Step 3: Buat section publikasi**

Reproduksi section "Dokumen & Kajian" / Publikasi: grid `publications-grid-home`, tiap kartu → `/publikasi/${slug}`, dengan gambar 16/9, eyebrow amber, judul, tanggal.

- [ ] **Step 4: Verifikasi build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/portal/PortalHome.tsx
git commit -m "feat(portal): halaman beranda (carousel, tautan, publikasi)"
```

---

### Task 6: Halaman Profil unit, Berita, Publikasi, Layanan

**Files:**
- Create: `frontend/src/pages/portal/PortalUnit.tsx`
- Create: `frontend/src/pages/portal/PortalNews.tsx`
- Create: `frontend/src/pages/portal/PortalPublication.tsx`
- Create: `frontend/src/pages/portal/PortalService.tsx`

**Interfaces:**
- Consumes: `units`, `news`, `publications`, `services` (Task 2); `PortalLayout`; react-router `useParams`, `Link`.
- Produces: komponen default yang dipakai route:
  - `PortalUnit` — rute `/profil/unit/:slug`.
  - `PortalNews` — dua mode: list (`/berita`) & detail (`/berita/:slug`). Pakai `useParams` untuk deteksi.
  - `PortalPublication` — list (`/publikasi`) & detail (`/publikasi/:slug`).
  - `PortalService` — rute `/layanan/:slug`.

- [ ] **Step 1: `PortalUnit`**

Reproduksi `renderUnitPage(slug)` + `renderLeaderPage(slug)` sebagai komponen. Sidebar daftar unit (`sidebar-link` aktif), konten tugas/fungsi, tombol "Lihat Profil Pimpinan Unit ➔". Pada mode leader, tampilkan biodata `profil` + email. Gunakan `useParams` untuk `slug`, `units.find(u => u.slug === slug)`. Jika tidak ditemukan, render pesan "Unit tidak ditemukan".

- [ ] **Step 2: `PortalNews`**

List (`useParams().slug` undefined) → grid `grid-2` kartu berita. Detail (slug ada) → reproduksi `renderNewsDetailPage`: `article-hero`, gambar, `article-body`, excerpt blockquote, paragraf `content`, gallery `gallery-grid` dengan lightbox, berita terkait (kategori sama, max 3, jika tidak ada → placeholder). Lightbox: state boolean + img src, overlay klik untuk tutup, Escape untuk tutup.

- [ ] **Step 3: `PortalPublication`**

List → grid kartu publikasi. Detail → reproduksi `renderPublicationDetailPage`: `article-hero` gradient, gambar, excerpt (border-left hijau), `download-box` dengan "Akses Dokumen" (target `_blank`), paragraf.

- [ ] **Step 4: `PortalService`**

Reproduksi `renderServicePage`: sidebar daftar layanan, deskripsi, lampiran dokumen (PDF iframe height 550px; image `gallery-grid`). Gunakan `useParams` untuk slug.

- [ ] **Step 5: Verifikasi build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/portal/
git commit -m "feat(portal): halaman profil, berita, publikasi, layanan"
```

---

### Task 7: Register rute publik di `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `PortalUnit`, `PortalNews`, `PortalPublication`, `PortalService`, `PortalLayout` (Task 4/6).
- Produces: Rute publik lengkap di `App.tsx` saat `!user`.

- [ ] **Step 1: Tambah rute anak di bawah `PortalLayout`**

Ganti route `/` yang merender `PortalHome` langsung dengan route induk ber-`PortalLayout`:

```tsx
if (!user)
  return (
    <Routes>
      <Route element={<PortalLayout />}>
        <Route path="/" element={<PortalHome />} />
        <Route path="/profil/unit/:slug" element={<PortalUnit />} />
        <Route path="/profil/pimpinan/:slug" element={<PortalUnit mode="leader" />} />
        <Route path="/berita" element={<PortalNews />} />
        <Route path="/berita/:slug" element={<PortalNews />} />
        <Route path="/publikasi" element={<PortalPublication />} />
        <Route path="/publikasi/:slug" element={<PortalPublication />} />
        <Route path="/layanan/:slug" element={<PortalService />} />
      </Route>
      <Route path="/login" element={<Login onLogin={setUser} />} />
      <Route path="/dashboard/:slug" element={<Login onLogin={setUser} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
```

Catatan: `PortalUnit` menerima prop opsional `mode?: "leader"`. Jika tidak mau props, gunakan dua route → komponen sama (mode dideteksi dari path via `useParams` pada parent, atau sederhanakan: rute `/profil/pimpinan/:slug` juga render `PortalUnit` yang mengecek path). Pilih pendekatan yang konsisten dengan implementasi Task 6.

- [ ] **Step 2: Verifikasi build + manual**

Run: `cd frontend && npm run build` → PASS.
Manual (dev): buka `/`, klik Login, login, navigasi landing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(portal): register rute publik landpage"
```

---

### Task 8: Dashboard eksternal (iframe) + menu di app internal

**Files:**
- Create: `frontend/src/pages/PortalDashboard.tsx`
- Modify: `frontend/src/App.tsx` (header internal + rute)
- Modify: `frontend/src/components/ui.tsx` (opsional, jika perlu)

**Interfaces:**
- Consumes: `externalDashboards` (Task 2), user auth (dari `App.tsx` state), react-router `useParams`.
- Produces: `PortalDashboard` — komponen default merender iframe `externalDashboards` sesuai `slug`. Jika `!user` → `<Navigate to="/login" />`.

- [ ] **Step 1: Buat `PortalDashboard`**

```tsx
import { useParams, Navigate } from "react-router-dom";
import { externalDashboards } from "../data/portal";

export default function PortalDashboard() {
  const { slug } = useParams();
  const dash = externalDashboards.find((d) => d.slug === slug);
  if (!dash) return <p className="p-8 text-slate-600">Dashboard tidak ditemukan.</p>;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold text-slate-900">{dash.title}</h1>
      <iframe src={dash.url} title={dash.title} className="w-full" style={{ height: "150vh", border: "none" }} allowFullScreen />
    </div>
  );
}
```

- [ ] **Step 2: Tambah menu "Dashboard" di header internal**

Di `SiteHeader` (dalam `App.tsx`), tambahkan dropdown/nav "Dashboard" yang memetakan `externalDashboards` ke `<Link to={`/dashboard/${d.slug}`}>`. Pastikan `externalDashboards` di-import.

- [ ] **Step 3: Verifikasi build + manual**

Run: `cd frontend && npm run build` → PASS.
Manual: login, lihat menu Dashboard, buka iframe eksternal.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PortalDashboard.tsx frontend/src/App.tsx
git commit -m "feat(portal): dashboard eksternal iframe + menu"
```

---

### Task 9: Aset lokal & pembersihan

**Files:**
- Create: `frontend/public/portal/` (logo PMP, screenshot berita yang di-referensikan lokal)
- Modify (opsional): `.gitignore` untuk memastikan `PMP Portal.html` & `PMP Portal_files/` tidak ter-commit.

**Interfaces:**
- Consumes: aset dari `PMP Portal_files/` (logo PMP, gambar berita).
- Produces: aset tersedia di `frontend/public/portal/` untuk dipakai komponen (jika ada yang tidak pakai URL absolut).

- [ ] **Step 1: Salin aset lokal yang diperlukan**

Jika komponen memakai logo PMP lokal (`PMP Portal_files/Logo PMP Putih.png` untuk footer, dsb), salin ke `frontend/public/portal/` dan update referensi di data/komponen. Jika semua gambar sudah URL absolut, skip salin dan pastikan referensi lokal tidak dipakai.

- [ ] **Step 2: Update `.gitignore`**

Pastikan `PMP Portal.html` dan `PMP Portal_files/` masuk `.gitignore` (karena tidak boleh masuk repo). Tambahkan:

```
# Landpage asli (save-page) — tidak di-commit
/PMP Portal.html
/PMP Portal_files/
```

- [ ] **Step 3: Verifikasi build + git status**

Run: `cd frontend && npm run build` → PASS.
Run: `git status` → `PMP Portal.html` & `PMP Portal_files/` tidak muncul sebagai untracked (sudah di-ignore).

- [ ] **Step 4: Commit**

```bash
git add .gitignore frontend/public/portal/
git commit -m "chore(portal): aset lokal + ignore landpage asli"
```

---

### Task 10: Pengujian akhir & verifikasi

**Files:**
- (tidak ada perubahan file; hanya pengujian)

**Interfaces:**
- Konsumsi seluruh Task 1–9.

- [ ] **Step 1: Build produksi**

Run: `cd frontend && npm run build`
Expected: PASS tanpa error.

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS (atau hanya warning non-blokir; perbaiki error).

- [ ] **Step 3: Uji manual end-to-end**

Dengan backend berjalan (`cd backend && bun run dev`) dan frontend (`cd frontend && npm run dev`):
1. Buka `http://localhost:5173/` → landpage tampil lengkap (hero, carousel, tautan, EWS, publikasi).
2. Navigasi Profil/Data/Layanan → halaman detail berfungsi, gallery lightbox bekerja.
3. Klik **Login** → form login MIH.
4. Login sukses → redirect `/playground`.
5. Menu Dashboard tampil → buka iframe eksternal.
6. Logout → kembali ke `/` landpage publik.

- [ ] **Step 4: Uji perilaku login buka `/`**

Setelah login, ketik `/` di URL → redirect ke `/playground`.

- [ ] **Step 5: Commit final (jika ada perbaikan kecil)**

```bash
git add -A
git commit -m "fix(portal): penyempurnaan kecil pasca pengujian"
```
