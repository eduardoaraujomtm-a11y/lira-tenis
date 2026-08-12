"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo-100anos.png"
            alt="Lira Tênis Clube — 100 Anos"
            width={1000}
            height={417}
            priority
            className="h-16 w-auto"
          />
          <h1 className="text-lg font-extrabold">Painel do organizador</h1>
          <p className="text-sm text-muted">Acesso restrito à mesa e à organização.</p>
        </div>

        <label className="mb-1 block text-xs font-semibold text-muted">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-lira-purple"
          placeholder="voce@exemplo.com"
        />

        <label className="mb-1 block text-xs font-semibold text-muted">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-lira-purple"
          placeholder="••••••••"
        />

        {error && <p className="mb-3 text-sm font-medium text-live">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-lira-purple py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
