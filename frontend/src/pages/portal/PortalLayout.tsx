import { Outlet } from "react-router-dom";
import portalCss from "../../portal.css?inline";
import PortalHeader from "./PortalHeader";
import PortalFooter from "./PortalFooter";

/*
 * Layout publik landpage.
 *
 * CSS asli PMP Portal (portal.css) disuntikkan sebagai <style> DI SINI, bukan
 * di-import global. Alasan: portal.css mendefinisikan selector global umum
 * (.container, .card, .button, .section, dll) yang akan berkonflik dengan
 * Tailwind internal app (Playground, Documents, Admin). Dengan injeksi inline,
 * style otomatis dihapus saat komponen unmount — yaitu setelah user login dan
 * beralih ke internal app.
 */
export default function PortalLayout() {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: portalCss }} />
      <PortalHeader />
      <main>
        <Outlet />
      </main>
      <PortalFooter />
    </div>
  );
}