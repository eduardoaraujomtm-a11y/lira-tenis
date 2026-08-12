"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CompetitorType, Format } from "@/lib/types";
import { FORMAT_OPTIONS, TYPE_OPTIONS, RULE_PRESETS, formatShort } from "@/lib/rules";
import { downloadTournamentPdf } from "@/lib/pdf/TournamentPdf";
import { shortName as shortenName } from "@/lib/tennis";

interface Cat {
  id: string;
  name: string;
  short_name: string;
  type: CompetitorType;
  format: Format;
  sort_order: number;
  qualifiers_per_group: number;
}

export function CategoriasManager() {
  const [supabase] = useState(() => createClient());
  const [cats, setCats] = useState<Cat[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reordering, setReordering] = useState(false);

  // form
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<CompetitorType>("duplas");
  const [format, setFormat] = useState<Format>("grupos_mata_mata");
  const [presetId, setPresetId] = useState("best3");

  const load = useCallback(async () => {
    const [catRes, tourRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name,short_name,type,format,sort_order,qualifiers_per_group")
        .order("sort_order"),
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
      setError("Erro ao criar categoria: " + error.message);
      setBusy(false);
      return;
    }
    setName("");
    setShortName("");
    setOpen(false);
    await load();
    setBusy(false);
  }

  /**
   * Troca a categoria de lugar e renumera todas de 1..n. Renumerar (em vez de
   * só trocar os dois valores) conserta buracos e empates deixados por
   * categorias excluídas e recriadas, que entram sempre no fim da fila.
   */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const next = [...cats];
    [next[index], next[target]] = [next[target], next[index]];
    setCats(next); // resposta imediata; o banco confirma logo em seguida
    setReordering(true);
    setError(null);
    const results = await Promise.all(
      next.map((c, i) =>
        supabase.from("categories").update({ sort_order: i + 1 }).eq("id", c.id)
      )
    );
    setReordering(false);
    if (results.some((r) => r.error)) {
      setError("Não foi possível salvar a nova ordem.");
      await load(); // volta ao que está gravado, para a tela não mentir
    }
  }

  async function generatePdf() {
    setGeneratingPdf(true);
    setError(null);
    try {
      const [tourRes, compRes, matchRes] = await Promise.all([
        supabase.from("tournaments").select("name,edition").limit(1).single(),
        supabase
          .from("competitors")
          .select("id,category_id,group_id,athletes:competitor_athletes(position,athlete:athletes(name))"),
        supabase
          .from("matches")
          .select(
            "id,category_id,phase,group_id,day,time,status,competitor_a,competitor_b,label_a,label_b,sets,winner_id,court:courts(name)"
          ),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawComps = (compRes.data as any[]) ?? [];
      const competitors = rawComps.map((c) => ({
        id: c.id as string,
        categoryId: c.category_id as string,
        groupId: (c.group_id as string) ?? null,
        name:
          (c.athletes ?? [])
            .slice()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((x: any, y: any) => x.position - y.position)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((a: any) => shortenName(a.athlete?.name ?? "?"))
            .join(" / ") || "—",
      }));
      const nameById = new Map(competitors.map((c) => [c.id, c.name]));
      // Sem competidor definido, cai na previsão gravada ("2º do Grupo B").
      const nameOf = (id: string | null, label?: string | null) =>
        id ? nameById.get(id) ?? "?" : label || "A definir";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMatches = (matchRes.data as any[]) ?? [];
      const matches = rawMatches.map((m) => ({
        id: m.id as string,
        categoryId: m.category_id as string,
        phase: m.phase,
        groupId: (m.group_id as string) ?? null,
        day: m.day as string,
        time: m.time as string,
        status: m.status as string,
        courtName: (m.court?.name as string) ?? null,
        aId: (m.competitor_a as string) ?? null,
        bId: (m.competitor_b as string) ?? null,
        nameA: nameOf(m.competitor_a, m.label_a),
        nameB: nameOf(m.competitor_b, m.label_b),
        sets: ((m.sets as { a: number; b: number; tbA?: number; tbB?: number }[]) ?? []).map(
          (s) => ({ a: s.a, b: s.b, tbA: s.tbA, tbB: s.tbB })
        ),
        winnerId: (m.winner_id as string) ?? null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tour = tourRes.data as any;
      const tournamentLabel = [tour?.name, tour?.edition].filter(Boolean).join(" ") || "Torneio";

      await downloadTournamentPdf({
        tournamentLabel,
        categories: cats.map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.short_name,
          type: c.type,
          format: c.format,
          qualifiersPerGroup: c.qualifiers_per_group ?? 2,
        })),
        competitors,
        matches,
        fileName: `${tournamentLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      });
    } catch {
      setError("Erro ao gerar o PDF. Tente novamente.");
    }
    setGeneratingPdf(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Monte as duplas e gere as chaves de cada categoria.</p>
        <div className="flex gap-2">
          <button
            onClick={generatePdf}
            disabled={generatingPdf || cats.length === 0}
            className="rounded-lg border border-lira-purple px-3 py-1.5 text-sm font-bold text-accent disabled:opacity-60"
          >
            {generatingPdf ? "Gerando…" : "📄 Gerar PDF"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-lira-purple px-3 py-1.5 text-sm font-bold text-white"
          >
            {open ? "Fechar" : "＋ Nova categoria"}
          </button>
        </div>
      </div>

      {error && !open && <p className="mb-3 text-sm text-live">{error}</p>}

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
        <>
          <p className="mb-1 text-xs text-muted">
            Esta ordem vale para o app, o PDF e os filtros. Use as setas para
            reordenar.
          </p>
          <div className="space-y-2">
            {cats.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reordering}
                    aria-label={`Mover ${c.short_name} para cima`}
                    className="px-1 text-xs leading-tight text-accent disabled:opacity-25"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === cats.length - 1 || reordering}
                    aria-label={`Mover ${c.short_name} para baixo`}
                    className="px-1 text-xs leading-tight text-accent disabled:opacity-25"
                  >
                    ▼
                  </button>
                </div>
                <Link
                  href={`/admin/chaveamento/${c.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="text-xs text-muted">
                      {c.type === "duplas" ? "Duplas" : "Simples"} · {formatShort(c.format)}
                    </p>
                  </div>
                  <span className="shrink-0 text-accent">→</span>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
