import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { api, type User } from "./api";
import Login from "./pages/Login";
import Playground from "./pages/Playground";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Memuat…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="flex items-center gap-4 bg-slate-800 px-6 py-3 text-white">
        <span className="font-semibold">MVP MIH</span>
        <NavLink to="/playground" className="hover:underline">Playground</NavLink>
        <NavLink to="/documents" className="hover:underline">Dokumen</NavLink>
        {user.is_admin && <NavLink to="/admin" className="hover:underline">Admin</NavLink>}
        <span className="ml-auto text-sm">
          {user.name} ·{" "}
          <button className="underline" onClick={() => api.logout().finally(() => setUser(null))}>Keluar</button>
        </span>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/playground" />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/admin" element={user.is_admin ? <Admin /> : <Navigate to="/playground" />} />
      </Routes>
    </div>
  );
}
