import { createContext, useContext } from "react";
import { Outlet } from "react-router-dom";
import portalCss from "../../portal.css?inline";
import PortalHeader from "./PortalHeader";
import PortalFooter from "./PortalFooter";
import type { User } from "../../api";

/*
 * Layout publik landpage.
 *
 * CSS asli PMP Portal (portal.css) disuntikkan sebagai <style> DI SINI, bukan
 * di-import global. Alasan: portal.css mendefinisikan selector global umum
 * (.container, .card, .button, .section, dll) yang akan berkonflik dengan
 * Tailwind internal app (Playground, Documents, Admin). Dengan injeksi inline,
 * style otomatis dihapus saat komponen unmount.
 *
 * user/onLogout opsional: saat login, landing tetap tampil (sesuai desain debug)
 * dan menu/tautan private ikut muncul. user null = mode publik.
 */

export interface PortalAuth {
  user: User | null;
  onLogout: () => void;
}

export const PortalAuthContext = createContext<PortalAuth>({
  user: null,
  onLogout: () => {},
});

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

export default function PortalLayout({ user, onLogout }: Partial<PortalAuth>) {
  return (
    <PortalAuthContext.Provider value={{ user: user ?? null, onLogout: onLogout ?? (() => {}) }}>
      <div>
        <style dangerouslySetInnerHTML={{ __html: portalCss }} />
        <PortalHeader />
        <main>
          <Outlet />
        </main>
        <PortalFooter />
      </div>
    </PortalAuthContext.Provider>
  );
}
