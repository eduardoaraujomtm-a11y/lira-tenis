"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Athlete {
  id: string;
  name: string;
}

export function AtletasManager() {
  const [supabase] = useState(() => createClient());
  const [list, setList] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("athletes").select("id,name").order("name");
    setList((data as Athlete[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("athletes").insert({ name: n });
    if (error) setError("Erro ao salvar. Você está logado?");
    else setName("");
    await load();
    setBusy(false);
  }

  async function save(id: string) {
    const n = editName.trim();
    if (!n) return;
    await supabase.from("athletes").update({ name: n }).eq("id", id);
    setEditing(null);
    await load();
  }

  async function remove(id: string, nm: string) {
    if (!confirm(`Excluir "${nm}"? As duplas com este atleta também podem ser afetadas.`)) return;
    await supabase.from("athletes").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do atleta"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-lira-purple"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Adicionar
        </button>
      </form>

      {error && <p className="mb-2 text-sm text-live">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">Nenhum atleta cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
              {editing === a.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => save(a.id)} className="text-sm font-semibold text-accent">
                    Salvar
                  </button>
                  <button onClick={() => setEditing(null)} className="text-sm text-muted">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="truncate text-sm font-medium">{a.name}</span>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => {
                        setEditing(a.id);
                        setEditName(a.name);
                      }}
                      className="text-sm text-muted hover:text-accent"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(a.id, a.name)}
                      className="text-sm text-muted hover:text-live"
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        {list.length} atleta{list.length === 1 ? "" : "s"} cadastrado{list.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
