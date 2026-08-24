import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type User } from "../api";
import { Button, Card, ErrorBanner, Field, Input } from "../components/ui";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api.login(email, password);
      onLogin(r.user);
      navigate("/playground", { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 sm:p-6"
      style={{ background: "linear-gradient(135deg, #172554, #1e3a8a, #1e40af)" }}
    >
      <style>{`
        @keyframes card-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-enter { animation: card-fade 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .card-enter { animation: none; }
        }
      `}</style>

      <Card interactive={false} className="card-enter w-full max-w-md p-8 shadow-lg sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-widest text-amber-500">
          Portal Internal · Kedeputian Makro
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">
          Kedeputian Makro
        </h1>
        <p className="mt-2 text-slate-600">
          Tanya-jawab dokumen perencanaan makro
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full">
            Masuk
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Hanya untuk pegawai internal
        </p>
      </Card>
    </div>
  );
}
