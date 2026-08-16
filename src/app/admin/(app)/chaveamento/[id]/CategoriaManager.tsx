"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shortName, PHASE_LABEL } from "@/lib/tennis";
import { Bracket } from "@/components/Bracket";
import type { MatchView, Phase, CompetitorType, Format, ScoreRule } from "@/lib/types";
import {
  FORMAT_OPTIONS,
  TYPE_OPTIONS,
  RULE_PRESETS,
  presetIdFor,
  formatShort,
  hasGroupsPhase,
  hasKnockoutPhase,
} from "@/lib/rules";
import { computeGroupStandings, qualifiersSeeded } from "@/lib/standings";
import { bracketPositions } from "@/lib/bracket-layout";
import {
  generateKnockout,
  distributeGroups,
  generateGroupMatches,
  generateCustomQuarters,
  generateStructuredKO,
  groupSlotLabel,
  type GenMatch,
} from "@/lib/bracket";
import { DEFAULT_SLOTS, scheduleKnockout, type SlotPlan } from "@/lib/schedule";

interface Category {
  id: string;
  name: string;
  short_name: string;
  type: CompetitorType;
  format: Format;
  rule: ScoreRule;
  qualifiers_per_group: number;
}
interface Athlete {
  id: string;
  name: string;
}
interface Competitor {
  id: string;
  seed: number | null;
  group_id: string | null;
  athletes: { position: number; athlete: { id: string; name: string } | null }[];
}
interface RawMatch {
  id: string;
  phase: Phase;
  group_id: string | null;
  round: number | null;
  time: string;
  status: MatchView["status"];
  sets: { a: number; b: number; tbA?: number; tbB?: number }[];
  winner_id: string | null;
  competitor_a: string | null;
  competitor_b: string | null;
  label_a: string | null;
  label_b: string | null;
  next_match_id: string | null;
  next_slot: "A" | "B" | null;
}

/** Distribui um índice em horário simples a partir das 09:00, saltos de 90min. */
function slotTime(i: number, courtsCount: number): string {
  const cycle = courtsCount > 0 ? Math.floor(i / courtsCount) : i;
  const minutes = 9 * 60 + cycle * 90;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function CategoriaManager({ categoryId }: { categoryId: string }) {
  const [supabase] = useState(() => createClient());
  const [cat, setCat] = useState<Category | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [comps, setComps] = useState<Competitor[]>([]);
  const [courts, setCourts] = useState<{ id: string }[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotPlan>({ fallback: DEFAULT_SLOTS });
  const [matches, setMatches] = useState<RawMatch[]>([]);
  const matchCount = matches.length;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form de nova dupla
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [seed, setSeed] = useState("");
  const [numGroups, setNumGroups] = useState(2);

  const load = useCallback(async () => {
    const [catRes, athRes, compRes, courtRes, tourRes, matchRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name,short_name,type,format,rule,qualifiers_per_group")
        .eq("id", categoryId)
        .single(),
      supabase.from("athletes").select("id,name").order("name"),
      supabase
        .from("competitors")
        .select("id,seed,group_id,athletes:competitor_athletes(position,athlete:athletes(id,name))")
        .eq("category_id", categoryId),
      supabase.from("courts").select("id"),
      supabase.from("tournaments").select("days,slots,slots_by_day").limit(1).single(),
      supabase
        .from("matches")
        .select("id,phase,group_id,round,time,status,sets,winner_id,competitor_a,competitor_b,label_a,label_b,next_match_id,next_slot")
        .eq("category_id", categoryId),
    ]);
    setCat((catRes.data as Category) ?? null);
    setAthletes((athRes.data as Athlete[]) ?? []);
    setComps((compRes.data as unknown as Competitor[]) ?? []);
    setCourts((courtRes.data as { id: string }[]) ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tour = tourRes.data as any;
    setDays((tour?.days as string[]) ?? []);
    setSlots({
      fallback: (tour?.slots as string[])?.length ? (tour.slots as string[]) : DEFAULT_SLOTS,
      byDay: (tour?.slots_by_day as Record<string, string[]>) ?? undefined,
    });
    setMatches((matchRes.data as unknown as RawMatch[]) ?? []);
    setLoading(false);
  }, [supabase, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const compName = (c: Competitor) =>
    c.athletes
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((a) => shortName(a.athlete?.name ?? "?"))
      .join(" / ") || "—";

  // Constrói a visualização da chave a partir dos jogos + nomes das duplas
  const { bracketGroups, groupGames } = useMemo(() => {
    const nameById = new Map(comps.map((c) => [c.id, compName(c)]));
    const nameOf = (id: string | null) => (id ? nameById.get(id) ?? "?" : "A definir");
    const toView = (m: RawMatch): MatchView => {
      const side = (id: string | null, pick: "a" | "b") => ({
        competitorId: id ?? undefined,
        // Sem competidor definido, mostra a previsão ("2º do Grupo B").
        name: id ? nameOf(id) : (pick === "a" ? m.label_a : m.label_b) ?? "A definir",
        sets: (m.sets ?? []).map((s) => ({
          games: pick === "a" ? s.a : s.b,
          // Pontos do tie-break do próprio lado, não o menor dos dois.
          tb: pick === "a" ? s.tbA : s.tbB,
        })),
        winner: m.winner_id ? m.winner_id === id : false,
      });
      return {
        id: m.id,
        searchText: "",
        categoryId,
        categoryShort: "",
        phase: m.phase,
        phaseLabel: PHASE_LABEL[m.phase],
        groupId: m.group_id ?? undefined,
        day: "",
        time: m.time,
        status: m.status,
        isLive: m.status === "ao_vivo",
        a: side(m.competitor_a, "a"),
        b: side(m.competitor_b, "b"),
        nextMatchId: m.next_match_id ?? undefined,
        nextSlot: m.next_slot ?? undefined,
      };
    };

    const order: Phase[] = ["oitavas", "quartas", "semi", "final", "terceiro"];
    const knockoutViews = matches.filter((m) => m.phase !== "grupo").map(toView);
    const koPos = bracketPositions(knockoutViews);
    const bracketGroups = order
      .map((phase) => ({
        phase,
        phaseLabel: PHASE_LABEL[phase],
        matches: knockoutViews
          .filter((m) => m.phase === phase)
          .sort((a, b) => (koPos.get(a.id) ?? 0) - (koPos.get(b.id) ?? 0)),
      }))
      .filter((g) => g.matches.length > 0);

    const groupMatches = matches.filter((m) => m.phase === "grupo");
    const gids = Array.from(new Set(groupMatches.map((m) => m.group_id))).sort();
    const groupGames = gids.map((gid) => ({
      groupId: gid ?? "?",
      games: groupMatches
        .filter((m) => m.group_id === gid)
        .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
        .map(toView),
    }));

    return { bracketGroups, groupGames };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, comps, categoryId]);

  async function addDupla(e: React.FormEvent) {
    e.preventDefault();
    if (!cat) return;
    if (!a1 || (cat.type === "duplas" && !a2)) {
      setError("Selecione o(s) atleta(s).");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: comp, error: e1 } = await supabase
      .from("competitors")
      .insert({ category_id: categoryId, seed: seed ? Number(seed) : null })
      .select("id")
      .single();
    if (e1 || !comp) {
      setError("Erro ao criar a dupla: " + (e1?.message ?? "desconhecido"));
      setBusy(false);
      return;
    }
    const links = [{ competitor_id: comp.id, athlete_id: a1, position: 1 }];
    if (cat.type === "duplas" && a2)
      links.push({ competitor_id: comp.id, athlete_id: a2, position: 2 });
    await supabase.from("competitor_athletes").insert(links);
    setA1("");
    setA2("");
    setSeed("");
    await load();
    setBusy(false);
  }

  async function removeDupla(id: string) {
    if (!confirm("Excluir esta dupla?")) return;
    await supabase.from("competitors").delete().eq("id", id);
    await load();
  }

  async function insertGenerated(gen: GenMatch[]) {
    const keyToId = new Map<string, string>();
    gen.forEach((g) => keyToId.set(g.key, crypto.randomUUID()));
    const day = days[0] ?? new Date().toISOString().slice(0, 10);
    const sorted = [...gen].sort(
      (a, b) => a.round - b.round || a.indexInRound - b.indexInRound
    );
    // Mata-mata vai para os dois últimos dias, em ordem de fase; grupos ficam
    // provisórios no primeiro dia até o organizador rodar a agenda automática.
    const koPlan = scheduleKnockout(
      sorted
        .filter((g) => g.phase !== "grupo")
        .map((g) => ({ id: keyToId.get(g.key)!, phase: g.phase })),
      days,
      slots,
      Math.max(1, courts.length)
    );
    const rows = sorted.map((g, i) => {
      const id = keyToId.get(g.key)!;
      const ko = koPlan.get(id);
      return {
        id,
        category_id: categoryId,
        phase: g.phase,
        group_id: g.groupId ?? null,
        round: g.round ?? null,
        day: ko?.day ?? day,
        time: ko?.time ?? slotTime(i, courts.length),
        court_id: courts.length ? courts[i % courts.length].id : null,
        status: "agendado",
        competitor_a: g.competitorA ?? null,
        competitor_b: g.competitorB ?? null,
        label_a: g.labelA ?? null,
        label_b: g.labelB ?? null,
        next_match_id: g.nextKey ? keyToId.get(g.nextKey)! : null,
        next_slot: g.nextSlot ?? null,
      };
    });
    const { error } = await supabase.from("matches").insert(rows);
    if (error) throw error;
  }

  async function clearMatches(onlyKnockout = false) {
    let q = supabase.from("matches").delete().eq("category_id", categoryId);
    if (onlyKnockout) q = q.neq("phase", "grupo");
    await q;
  }

  const label = cat?.type === "duplas" ? "duplas" : "jogadores";

  async function generateKO() {
    if (comps.length < 2) return setError(`Cadastre pelo menos 2 ${label}.`);
    if (!confirm("Isso apaga os jogos atuais desta categoria e gera a chave. Continuar?")) return;
    setBusy(true);
    setError(null);
    try {
      await clearMatches();
      const gen = generateKnockout(comps.map((c) => ({ id: c.id, seed: c.seed })), { rng: Math.random });
      await insertGenerated(gen);
      await load();
    } catch {
      setError("Erro ao gerar a chave.");
    }
    setBusy(false);
  }

  async function generateGroups() {
    if (comps.length < numGroups * 2)
      return setError(`Cadastre pelo menos ${numGroups * 2} ${label} para ${numGroups} grupos.`);
    if (!confirm("Isso apaga os jogos atuais e gera a fase de grupos. Continuar?")) return;
    setBusy(true);
    setError(null);
    try {
      await clearMatches();
      const groups = distributeGroups(comps.map((c) => ({ id: c.id, seed: c.seed })), numGroups);
      // grava o grupo de cada competidor
      for (const g of groups)
        for (const cid of g.competitorIds)
          await supabase.from("competitors").update({ group_id: g.groupId }).eq("id", cid);
      const gen = generateGroupMatches(groups);
      await insertGenerated(gen);
      await load();
    } catch {
      setError("Erro ao gerar os grupos.");
    }
    setBusy(false);
  }

  async function generateQualifierKO() {
    const standInput = matches
      .filter((m) => m.phase === "grupo")
      .map((m) => ({
        groupId: m.group_id,
        aId: m.competitor_a,
        bId: m.competitor_b,
        sets: (m.sets ?? []).map((s) => ({ a: s.a, b: s.b })),
        winnerId: m.winner_id,
        finished: m.status === "finalizado" || m.status === "wo",
      }));
    const standings = computeGroupStandings(
      comps.map((c) => ({ id: c.id, groupId: c.group_id })),
      standInput
    );
    const qualifiers = qualifiersSeeded(standings, cat?.qualifiers_per_group ?? 2);
    if (qualifiers.length < 2) return setError("Classificados insuficientes para o mata-mata.");
    const allDone = standInput.length > 0 && standInput.every((m) => m.finished);
    if (!allDone && !confirm("Nem todos os jogos de grupo terminaram. Gerar o mata-mata com a classificação PARCIAL?")) return;

    const koMatches = matches.filter((m) => m.phase !== "grupo");
    const hasExistingKO = koMatches.length > 0;

    if (hasExistingKO) {
      // Substituir labels pelos classificados reais, preservando agenda e cruzamentos
      if (!confirm("Isso substitui as posições previstas pelos classificados reais, mantendo os horários e cruzamentos. Continuar?")) return;
      setBusy(true);
      setError(null);
      try {
        // Mapear "Xº do Grupo Y" → competitorId
        const labelToComp = new Map<string, string>();
        for (const g of standings) {
          g.rows.forEach((row, rank) => {
            labelToComp.set(groupSlotLabel(rank + 1, g.groupId), row.competitorId);
          });
        }
        // Atualizar cada jogo de mata-mata da 1ª rodada
        for (const m of koMatches) {
          const updates: Record<string, string | null> = {};
          if (m.label_a && labelToComp.has(m.label_a)) {
            updates.competitor_a = labelToComp.get(m.label_a)!;
            updates.label_a = null;
          }
          if (m.label_b && labelToComp.has(m.label_b)) {
            updates.competitor_b = labelToComp.get(m.label_b)!;
            updates.label_b = null;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("matches").update(updates).eq("id", m.id);
          }
        }
        await load();
      } catch {
        setError("Erro ao substituir pelos classificados.");
      }
      setBusy(false);
    } else {
      // Sem mata-mata existente: gerar do zero (determinístico, sem sorteio)
      if (!confirm("Isso cria o mata-mata a partir dos classificados. Os jogos de grupo são mantidos. Continuar?")) return;
      setBusy(true);
      setError(null);
      try {
        const gen = generateKnockout(qualifiers);
        await insertGenerated(gen);
        await load();
      } catch {
        setError("Erro ao gerar o mata-mata dos classificados.");
      }
      setBusy(false);
    }
  }

  /** Tamanho de cada grupo já formado nesta categoria. */
  const groupSizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comps) if (c.group_id) m.set(c.group_id, (m.get(c.group_id) ?? 0) + 1);
    return [...m.entries()]
      .map(([groupId, size]) => ({ groupId, size }))
      .sort((a, b) => a.groupId.localeCompare(b.groupId));
  }, [comps]);

  /** A entrada escalonada só faz sentido com 3 grupos e um deles menor que os
   *  outros dois — é o grupo menor que manda 1º e 2º para as quartas. */
  const canEscalonada =
    groupSizes.length === 3 &&
    groupSizes.filter((g) => g.size === Math.min(...groupSizes.map((x) => x.size)))
      .length === 1;

  /** Monta a chave só com as posições (1º do A, 2º do B…), antes dos grupos. */
  async function generateStructure(kind: "padrao" | "escalonada") {
    if (
      !confirm(
        "Isso (re)cria o mata-mata como PREVISÃO, por posição (ex.: 2º do Grupo B × 1º do Grupo A). Os jogos de grupo são mantidos. Continuar?"
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const gen =
        kind === "escalonada"
          ? generateCustomQuarters(groupSizes)
          : generateStructuredKO(
              groupSizes.map((g) => g.groupId),
              cat?.qualifiers_per_group ?? 2
            );
      if (!gen.length) throw new Error("Classificados insuficientes para montar a chave.");
      await clearMatches(true); // apaga só o mata-mata, mantém os grupos
      await insertGenerated(gen);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar a chave prevista.");
    }
    setBusy(false);
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (!cat) return <p className="text-sm text-live">Categoria não encontrada.</p>;

  const isDuplas = cat.type === "duplas";
  const showGroups = hasGroupsPhase(cat.format);
  const showKnockout = hasKnockoutPhase(cat.format);
  const hasGroupMatches = matches.some((m) => m.phase === "grupo");

  return (
    <div>
      <Link href="/admin/chaveamento" className="mb-2 inline-block text-xs font-semibold text-accent">
        ← Categorias
      </Link>
      <h1 className="text-lg font-extrabold">{cat.name}</h1>
      <p className="mb-4 text-xs text-muted">
        {isDuplas ? "Duplas" : "Simples"} · {formatShort(cat.format)}
      </p>

      <CategoriaSettings cat={cat} groupCount={groupSizes.length} onSaved={load} />

      {/* Adicionar dupla */}
      <form onSubmit={addDupla} className="mb-4 rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-sm font-bold">Adicionar {isDuplas ? "dupla" : "jogador"}</p>
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <select
            value={a1}
            onChange={(e) => setA1(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">{isDuplas ? "Atleta 1…" : "Atleta…"}</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {isDuplas && (
            <select
              value={a2}
              onChange={(e) => setA2(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="">Atleta 2…</option>
              {athletes.filter((a) => a.id !== a1).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))}
            placeholder="Cabeça (opcional)"
            className="w-40 rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Adicionar
          </button>
        </div>
        {athletes.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            Cadastre atletas primeiro em <Link href="/admin/atletas" className="underline">Atletas</Link>.
          </p>
        )}
      </form>

      {error && <p className="mb-2 text-sm text-live">{error}</p>}

      {/* Lista de duplas */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
          {comps.length} {isDuplas ? "duplas" : "jogadores"}
        </p>
        {comps.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma dupla ainda.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {comps.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  {c.seed != null && (
                    <span className="rounded bg-lira-yellow px-1.5 text-[11px] font-bold text-lira-purple-dark">
                      {c.seed}
                    </span>
                  )}
                  {c.group_id && (
                    <span className="rounded bg-lira-purple-soft px-1.5 text-[11px] font-bold text-accent">
                      G{c.group_id}
                    </span>
                  )}
                  <span className="truncate font-medium">{compName(c)}</span>
                </span>
                <button onClick={() => removeDupla(c.id)} className="shrink-0 text-muted hover:text-live">
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Geração de chave */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-sm font-bold">Gerar chave</p>
        {matchCount > 0 && (
          <p className="mb-2 rounded-lg bg-lira-yellow/20 px-2 py-1 text-xs text-lira-purple-dark">
            ⚠ Esta categoria já tem {matchCount} jogo(s). Gerar de novo apaga e recria.
          </p>
        )}
        {/* Formato: só grupos, só mata-mata, ou grupos + mata-mata */}
        {showGroups && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted">Nº de grupos:</label>
            <select
              value={numGroups}
              onChange={(e) => setNumGroups(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={generateGroups}
              disabled={busy}
              className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {hasGroupMatches ? "Regerar grupos" : "Gerar fase de grupos"}
            </button>
          </div>
        )}

        {showKnockout && !showGroups && (
          <button
            onClick={generateKO}
            disabled={busy}
            className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Gerar mata-mata
          </button>
        )}

        {showGroups && showKnockout && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => generateStructure("padrao")}
              disabled={busy || !hasGroupMatches}
              className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Gerar chave prevista (por posição)
            </button>
            {canEscalonada && (
              <button
                onClick={() => generateStructure("escalonada")}
                disabled={busy}
                className="rounded-lg border border-lira-purple px-4 py-2 text-sm font-bold text-accent disabled:opacity-40"
              >
                Gerar chave prevista com entrada escalonada
              </button>
            )}
            <button
              onClick={generateQualifierKO}
              disabled={busy || !hasGroupMatches}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted disabled:opacity-40"
            >
              Substituir pelos classificados reais
            </button>
          </div>
        )}

        <p className="mt-2 text-xs text-muted">
          {showGroups && showKnockout
            ? "A chave prevista mostra os cruzamentos por posição (2º do Grupo B × 1º do Grupo A) e já ocupa os dois últimos dias do torneio. Quando os grupos terminarem, use “Substituir pelos classificados reais” para trocar as posições pelos nomes. Na entrada escalonada, o 1º dos grupos maiores vai direto à semifinal e os 2º disputam as quartas com o grupo menor."
            : showGroups
            ? "Todos jogam contra todos dentro de cada grupo."
            : "Sorteio no padrão das federações: 1 e 2 em lados opostos; 3 e 4 sorteadas para enfrentá-las nas semis; os demais também sorteados. Gerar de novo re-sorteia a chave."}
        </p>
      </div>

      {/* Criar match customizado */}
      {showKnockout && hasGroupMatches && (
        <CreateCustomMatch
          categoryId={categoryId}
          comps={comps}
          compName={compName}
          supabase={supabase}
          days={days}
          courts={courts}
          onCreated={load}
        />
      )}

      {/* Pré-visualização da chave/grupos gerados */}
      {matchCount > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Chave gerada
            </h2>
            <Link href="/chaves" className="text-xs font-semibold text-accent">
              Ver no site →
            </Link>
          </div>

          {groupGames.length > 0 && (
            <div className="mb-5 space-y-4">
              {groupGames.map((g) => (
                <div key={g.groupId} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="bg-lira-purple-soft px-3 py-1.5 text-xs font-bold text-accent">
                    Grupo {g.groupId} · {g.games.length} jogo{g.games.length === 1 ? "" : "s"}
                  </div>
                  <ul className="divide-y divide-border">
                    {g.games.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="truncate">
                          {m.a.name} <span className="text-muted">x</span> {m.b.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted">{m.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {bracketGroups.length > 0 && <Bracket groups={bracketGroups} />}
        </div>
      )}
    </div>
  );
}

/** Criar um match customizado (para bracket com seeding especial). */
function CreateCustomMatch({
  categoryId,
  comps,
  compName,
  supabase,
  days,
  courts,
  onCreated,
}: {
  categoryId: string;
  comps: Competitor[];
  compName: (c: Competitor) => string;
  supabase: ReturnType<typeof createClient>;
  days: string[];
  courts: { id: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [compA, setCompA] = useState("");
  const [compB, setCompB] = useState("");
  const [phase, setPhase] = useState<Phase>("quartas");
  const [day, setDay] = useState(days[0] ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!compA || !compB || compA === compB) {
      setMsg("Selecione dois competidores diferentes.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const courtId = courts.length ? courts[0].id : null;
    const { error } = await supabase.from("matches").insert({
      id: crypto.randomUUID(),
      category_id: categoryId,
      phase,
      group_id: null,
      round: 1,
      day,
      time,
      status: "agendado",
      competitor_a: compA,
      competitor_b: compB,
      court_id: courtId,
      sets: [],
      next_match_id: null,
      next_slot: null,
    });
    setBusy(false);
    if (error) {
      setMsg("Erro ao criar: " + error.message);
      return;
    }
    setMsg("Match criado!");
    setCompA("");
    setCompB("");
    setTimeout(() => {
      setOpen(false);
      onCreated();
    }, 500);
  }

  const availableComps = comps.filter((c) => c.group_id); // só qualificados (têm group)

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-bold"
      >
        {open ? "▾" : "▸"} Criar match customizado (quartelas/semis/final)
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">
            Para criar quartas com seeding especial, crie os matches manualmente.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Competidor A</label>
              <select
                value={compA}
                onChange={(e) => setCompA(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">Selecionar…</option>
                {availableComps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {compName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Competidor B</label>
              <select
                value={compB}
                onChange={(e) => setCompB(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">Selecionar…</option>
                {availableComps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {compName(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Rodada</label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as Phase)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="oitavas">Oitavas</option>
                <option value="quartas">Quartas</option>
                <option value="semi">Semi</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Dia</label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Hora</label>
              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                type="time"
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              />
            </div>
          </div>
          {msg && <p className="text-xs font-semibold text-accent">{msg}</p>}
          <button
            onClick={create}
            disabled={busy}
            className="w-full rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Criando…" : "Criar match"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Rodada em que a chave começa, dado o total de classificados. */
function firstRoundLabel(total: number): string {
  if (total < 2) return "sem mata-mata";
  if (total === 2) return "final direta";
  if (total <= 4) return "semifinais";
  if (total <= 8) return "quartas de final";
  return "oitavas de final";
}

/** Painel de configurações da categoria (tipo, formato, regra) + excluir. */
function CategoriaSettings({
  cat,
  groupCount,
  onSaved,
}: {
  cat: Category;
  groupCount: number;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cat.name);
  const [shortName, setShortName] = useState(cat.short_name);
  const [type, setType] = useState<CompetitorType>(cat.type);
  const [format, setFormat] = useState<Format>(cat.format);
  const [presetId, setPresetId] = useState(presetIdFor(cat.rule));
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(cat.qualifiers_per_group ?? 2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const rule = RULE_PRESETS.find((p) => p.id === presetId)!.rule;
    const { error } = await supabase
      .from("categories")
      .update({
        name,
        short_name: shortName || name,
        type,
        format,
        rule,
        qualifiers_per_group: qualifiersPerGroup,
      })
      .eq("id", cat.id);
    setBusy(false);
    if (error) return setMsg("Erro ao salvar.");
    setMsg("Salvo!");
    onSaved();
  }

  async function del() {
    if (!confirm(`Excluir a categoria "${cat.name}"? Isso apaga também suas duplas e jogos.`)) return;
    setBusy(true);
    await supabase.from("categories").delete().eq("id", cat.id);
    router.replace("/admin/chaveamento");
    router.refresh();
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-accent"
      >
        {open ? "▾ Ocultar configurações" : "▸ Configurações da categoria"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-card p-3">
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Nome curto</label>
              <input value={shortName} onChange={(e) => setShortName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </div>
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as CompetitorType)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Formato</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Regra de placar</label>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                {RULE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">
                Classificados por grupo
              </label>
              <select
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {[1, 2, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 (só o 1º)" : `${n} primeiros`}
                    {groupCount
                      ? ` — ${n * groupCount} classificados, ${firstRoundLabel(n * groupCount)}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mb-3 text-[11px] text-muted">
            Define quantos avançam de cada grupo
            {groupCount ? ` (esta categoria tem ${groupCount} grupo${groupCount > 1 ? "s" : ""})` : ""}.
            A chave se ajusta sozinha ao total de classificados. O 1º e o 2º de um
            mesmo grupo entram em metades opostas, então só podem se reencontrar
            na final.
          </p>
          {msg && <p className="mb-2 text-xs font-semibold text-accent">{msg}</p>}
          <div className="flex items-center justify-between">
            <button onClick={save} disabled={busy} className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              Salvar
            </button>
            <button onClick={del} disabled={busy} className="text-sm font-semibold text-live">
              Excluir categoria
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
