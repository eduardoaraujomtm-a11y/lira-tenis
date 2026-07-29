"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CompetitorType, Format } from "@/lib/types";
import { FORMAT_OPTIONS, TYPE_OPTIONS, RULE_PRESETS, formatShort } from "@/lib/rules";

interface Cat {
  id: string;
  name: string;
  short_name: string;
  type: CompetitorType;
  format: Format;
  sort_order: number;
}

export function CategoriasManager() {
  const [supabase] = useState(() => createClient());
  const [cats, setCats] = useState<Cat[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // form
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<CompetitorType>("duplas");
  const [format, setFormat] = useState<Format>("grupos_mata_mata");
  const [presetId, setPresetId] = useState("best3");

  const load = useCallback(async () => {
    const [catRes, tourRes] = await Promise.all([
      supabase.from("categories").select("id,name,short_name,type,format,sort_order").order("sort_order"),
      supabase.from("tournaments").select("id").limit(1).single(),
    ]);
    setCats((catRes.data as Cat[]) ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTournamentId(((tourRes.data as any)?.id as string) ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return setError("Dê um nome à categoria.");
    setBusy(true);
    setError(null);
    const rule = RULE_PRESETS.find((p) => p.id === presetId)!.rule;
    const nextOrder = (cats.at(-1)?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("categories").insert({
      tournament_id: tournamentId,
      name: nm,
      short_name: shortName.trim() || nm,
      type,
      format,
      rule,
      sort_order: nextOrder,
    });
    if (error) {
      setError("Erro ao criar. Você rodou a migração e está logado?");
      setBusy(false);
      return;
    }
    setName("");
    setShortName("");
    setOpen(false);
    await load();
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Monte as duplas e gere as chaves de cada categoria.</p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-lira-purple px-3 py-1.5 text-sm font-bold text-white"
        >
          {open ? "Fechar" : "＋ Nova categoria"}
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="mb-4 rounded-xl border border-border bg-card p-3">
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Masculino - 1ª Classe"
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Nome curto</label>
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="Ex: Masc 1ª (opcional)"
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CompetitorType)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-muted">Regra de placar</label>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              {RULE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="mb-2 text-sm text-live">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Criar categoria
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : cats.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma categoria ainda. Crie a primeira acima.</p>
      ) : (
        <div className="space-y-2">
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/admin/chaveamento/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <p className="text-sm font-bold">{c.name}</p>
                <p className="text-xs text-muted">
                  {c.type === "duplas" ? "Duplas" : "Simples"} · {formatShort(c.format)}
                </p>
              </div>
              <span className="text-lira-purple">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
