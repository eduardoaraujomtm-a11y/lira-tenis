"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "organizador" | "mesario";

interface Admin {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export function AdminsManager() {
  const [list, setList] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("mesario");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admins");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao carregar. A chave service_role está configurada?");
      setList([]);
    } else {
      setList(data.users ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar administrador.");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setMsg("Acesso criado!");
    load();
  }

  async function remove(a: Admin) {
    if (!confirm(`Remover o acesso de ${a.email}?`)) return;
    const res = await fetch(`/api/admins/${a.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Erro ao remover.");
    load();
  }

  return (
    <div>
      {/* Novo administrador */}
      <form onSubmit={create} className="mb-4 rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-sm font-bold">Novo administrador</p>
        <div className="mb-2 grid gap-2 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (opcional)"
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mín. 6)"
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
        </div>
        <div className="mb-2">
          <label className="mb-1 block text-xs font-semibold text-muted">Nível de acesso</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm sm:w-72"
          >
            <option value="mesario">Mesário — só lança placar dos jogos</option>
            <option value="organizador">Organizador — acesso total</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Criando…" : "Criar acesso"}
          </button>
          {msg && <span className="text-sm font-semibold text-accent">{msg}</span>}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          A pessoa entra em <b>/admin/login</b> com esse e-mail e senha. Combine a senha com ela e peça para trocar depois, se quiser.
        </p>
      </form>

      {error && <p className="mb-2 text-sm text-live">{error}</p>}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{a.name || a.email}</p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      a.role === "mesario"
                        ? "bg-lira-purple-soft text-accent"
                        : "bg-lira-yellow text-lira-purple-dark"
                    }`}
                  >
                    {a.role === "mesario" ? "Mesário" : "Organizador"}
                  </span>
                </div>
                {a.name && <p className="truncate text-xs text-muted">{a.email}</p>}
              </div>
              <button
                onClick={() => remove(a)}
                className="shrink-0 text-sm text-muted hover:text-live"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">{list.length} administrador(es).</p>
    </div>
  );
}
