import { useState } from "react";
import { api, type User } from "../api";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api.login(email, password);
      onLogin(r.user);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-800">
      <form onSubmit={submit} className="w-80 rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold">Masuk — MVP MIH</h1>
        {error && (
          <p className="mb-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm">
          Password
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="mt-4 w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          Masuk
        </button>
      </form>
    </div>
  );
}
