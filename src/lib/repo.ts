import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type {
  CategoryView,
  Champion,
  Format,
  GroupView,
  MatchView,
  Phase,
  CompetitorType,
  MatchStatus,
  SideView,
  StandingRow,
} from "./types";
import { shortName, PHASE_LABEL, setsWon } from "./tennis";
import { computeRanking, DEFAULT_POINTS, type PlacementBonus, type RankMatch, type RankPhase } from "./ranking";
import { bracketPositions } from "./bracket-layout";
import { computeGroupStandings } from "./standings";

export interface RankingEntry {
  athleteId: string;
  name: string;
  points: number;
  played: number;
  wins: number;
  titles: number;
}

// ---- Formas das linhas cruas vindas do Supabase ----
interface RawCompetitor {
  id: string;
  category_id: string;
  seed: number | null;
  group_id: string | null;
  athletes: { position: number; athlete: { id: string; name: string } | null }[];
}
interface RawSet {
  a: number;
  b: number;
  tbA?: number;
  tbB?: number;
}
interface RawMatch {
  id: string;
  category_id: string;
  phase: Phase;
  group_id: string | null;
  round: number | null;
  day: string;
  time: string;
  status: MatchStatus;
  competitor_a: string | null;
  competitor_b: string | null;
  label_a: string | null;
  label_b: string | null;
  sets: RawSet[];
  live: { server?: "A" | "B"; a: string; b: string } | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_slot: "A" | "B" | null;
  court: { name: string } | null;
}
interface RawCategory {
  id: string;
  name: string;
  short_name: string;
  type: CompetitorType;
  format: Format;
  sort_order: number;
  qualifiers_per_group: number;
}

/** Nome de exibição de uma dupla/jogador a partir dos atletas. */
function nameOf(c?: RawCompetitor): string {
  if (!c) return "A definir";
  return [...c.athletes]
    .sort((x, y) => x.position - y.position)
    .map((a) => shortName(a.athlete?.name ?? "?"))
    .join(" / ");
}

/**
 * Busca tudo que a UI precisa em uma única passada (memoizado por request).
 * Uma fonte de verdade para nomes de duplas, categorias e quadras.
 */
export const getData = cache(async () => {
  const supabase = await createClient();

  const [catRes, compRes, matchRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,short_name,type,format,sort_order,qualifiers_per_group")
      .order("sort_order"),
    supabase
      .from("competitors")
      .select(
        "id,category_id,seed,group_id,athletes:competitor_athletes(position,athlete:athletes(id,name))"
      ),
    supabase
      .from("matches")
      .select(
        "id,category_id,phase,group_id,round,day,time,status,competitor_a,competitor_b,label_a,label_b,sets,live,winner_id,next_match_id,next_slot,court:courts(name)"
      )
      .order("day")
      .order("time"),
  ]);

  const categories = (catRes.data ?? []) as RawCategory[];
  const competitors = (compRes.data ?? []) as unknown as RawCompetitor[];
  const rawMatches = (matchRes.data ?? []) as unknown as RawMatch[];

  const compMap = new Map(competitors.map((c) => [c.id, c]));

  const side = (
    compId: string | null,
    sets: RawSet[],
    pick: "a" | "b",
    winnerId: string | null,
    isLive: boolean,
    /** Previsão do confronto ("2º do Grupo B") enquanto a vaga não é decidida. */
    label?: string | null
  ): SideView => {
    const c = compId ? compMap.get(compId) : undefined;
    const won = setsWon(sets);
    const leading =
      isLive && (pick === "a" ? won.a > won.b : won.b > won.a);
    return {
      competitorId: compId ?? undefined,
      name: c ? nameOf(c) : label ?? nameOf(undefined),
      seed: c?.seed ?? undefined,
      sets: sets.map((s) => ({
        games: pick === "a" ? s.a : s.b,
        // Os pontos do tie-break de CADA lado. Antes mostrava o menor dos dois
        // nos dois lados, então um 8-6 aparecia como 6 e 6.
        tb: pick === "a" ? s.tbA : s.tbB,
      })),
      winner: winnerId ? winnerId === compId : leading,
    };
  };

  const catShort = new Map(categories.map((c) => [c.id, c.short_name]));

  // Nomes completos (para busca por nome)
  const fullName = (id: string | null) => {
    const c = id ? compMap.get(id) : undefined;
    if (!c) return "";
    return [...c.athletes]
      .sort((x, y) => x.position - y.position)
      .map((a) => a.athlete?.name ?? "")
      .join(" ");
  };

  const matches: MatchView[] = rawMatches.map((m) => {
    const isLive = m.status === "ao_vivo";
    return {
      searchText: `${fullName(m.competitor_a)} ${fullName(m.competitor_b)} ${
        catShort.get(m.category_id) ?? ""
      }`.toLowerCase(),
      id: m.id,
      categoryId: m.category_id,
      categoryShort: catShort.get(m.category_id) ?? "",
      phase: m.phase,
      phaseLabel: PHASE_LABEL[m.phase],
      groupId: m.group_id ?? undefined,
      courtName: m.court?.name,
      day: m.day,
      time: m.time,
      status: m.status,
      isLive,
      a: side(m.competitor_a, m.sets, "a", m.winner_id, isLive, m.label_a),
      b: side(m.competitor_b, m.sets, "b", m.winner_id, isLive, m.label_b),
      point: m.live
        ? { server: m.live.server, a: m.live.a, b: m.live.b }
        : undefined,
      nextMatchId: m.next_match_id ?? undefined,
      nextSlot: m.next_slot ?? undefined,
    };
  });

  const categoryViews: CategoryView[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.short_name,
    type: c.type,
    format: c.format,
    qualifiersPerGroup: c.qualifiers_per_group,
  }));

  return { categories: categoryViews, competitors, matches };
});

// ============ Consultas de alto nível ============

export async function getCategories(): Promise<CategoryView[]> {
  return (await getData()).categories;
}

/** Todos os jogos (para o painel do organizador). */
export async function getAllMatches(): Promise<MatchView[]> {
  return (await getData()).matches;
}

/** Dados básicos do torneio (nome + edição), para o cabeçalho. */
export const getTournamentInfo = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("name,edition")
    .limit(1)
    .single();
  return {
    name: (data?.name as string) ?? "",
    edition: (data?.edition as string) ?? "",
  };
});

/** Ranking dos atletas por desempenho (pontos = vitórias + participação + bônus de fase/colocação). */
export async function getRanking(): Promise<RankingEntry[]> {
  const { categories, competitors, matches } = await getData();

  const nameById = new Map<string, string>();
  const rankCompetitors = competitors.map((c) => {
    const athleteIds: string[] = [];
    for (const a of c.athletes) {
      if (a.athlete?.id) {
        athleteIds.push(a.athlete.id);
        nameById.set(a.athlete.id, a.athlete.name);
      }
    }
    return { id: c.id, athleteIds, categoryId: c.category_id };
  });

  const rankMatches: RankMatch[] = matches.map((m) => {
    const finished = m.status === "finalizado" || m.status === "wo";
    const winnerId = finished
      ? m.a.winner
        ? m.a.competitorId ?? null
        : m.b.winner
        ? m.b.competitorId ?? null
        : null
      : null;
    return {
      phase: m.phase as RankPhase,
      finished,
      aId: m.a.competitorId ?? null,
      bId: m.b.competitorId ?? null,
      winnerId,
    };
  });

  // Bônus de colocação — só após TODOS os jogos da categoria estarem encerrados.
  const placements = new Map<string, PlacementBonus>();
  const cfg = DEFAULT_POINTS;

  for (const cat of categories) {
    const allCatMatches = matches.filter((m) => m.categoryId === cat.id);
    const allFinished = allCatMatches.length > 0 &&
      allCatMatches.every((m) => m.status === "finalizado" || m.status === "wo");
    if (!allFinished) continue;

    if (cat.format === "grupos") {
      // Categorias só de grupos: colocação no grupo define o bônus.
      const members = competitors.filter(
        (c) => c.category_id === cat.id && c.group_id
      );
      if (!members.length) continue;

      const groupMatches = allCatMatches
        .filter((m) => m.phase === "grupo")
        .map((m) => ({
          groupId: m.groupId ?? null,
          aId: m.a.competitorId ?? null,
          bId: m.b.competitorId ?? null,
          sets: m.a.sets.map((s, i) => ({ a: s.games, b: m.b.sets[i].games })),
          winnerId: m.a.winner
            ? m.a.competitorId ?? null
            : m.b.winner
              ? m.b.competitorId ?? null
              : null,
          finished: true,
        }));

      if (!groupMatches.length) continue;

      const standings = computeGroupStandings(
        members.map((c) => ({ id: c.id, groupId: c.group_id ?? null })),
        groupMatches
      );

      const allRows = standings.flatMap((g) => g.rows);
      for (let i = 0; i < allRows.length; i++) {
        const compId = allRows[i].competitorId;
        if (i === 0) {
          placements.set(compId, { bonus: cfg.campeao, isTitle: true });
        } else if (i === 1) {
          placements.set(compId, { bonus: cfg.vice, isTitle: false });
        } else if (i <= 3) {
          placements.set(compId, { bonus: cfg.semi, isTitle: false });
        }
      }
    } else {
      // Categorias com mata-mata: bônus pela fase de eliminação.
      const knockout = allCatMatches.filter(
        (m) => m.phase !== "grupo" && m.phase !== "terceiro"
      );
      for (const m of knockout) {
        const finished = m.status === "finalizado" || m.status === "wo";
        if (!finished) continue;
        const winnerId = m.a.winner ? m.a.competitorId : m.b.winner ? m.b.competitorId : null;
        const loserId = m.a.winner ? m.b.competitorId : m.b.winner ? m.a.competitorId : null;

        if (m.phase === "final") {
          if (winnerId) placements.set(winnerId, { bonus: cfg.campeao, isTitle: true });
          if (loserId) placements.set(loserId, { bonus: cfg.vice, isTitle: false });
        } else if (loserId && !placements.has(loserId)) {
          const phase = m.phase as RankPhase;
          const bonus = phase === "semi" ? cfg.semi : phase === "quartas" ? cfg.quartas : phase === "oitavas" ? cfg.oitavas : 0;
          if (bonus) placements.set(loserId, { bonus, isTitle: false });
        }
      }
    }
  }

  return computeRanking(rankCompetitors, rankMatches, cfg, placements).map((r) => ({
    ...r,
    name: nameById.get(r.athleteId) ?? "—",
  }));
}

/** Campeões: por categoria com final decidida (vencedor da final). */
export async function getChampions(): Promise<Champion[]> {
  const { categories, competitors, matches } = await getData();
  const fullName = (id?: string) => {
    const c = id ? competitors.find((x) => x.id === id) : undefined;
    if (!c) return "—";
    return [...c.athletes]
      .sort((x, y) => x.position - y.position)
      .map((a) => a.athlete?.name ?? "?")
      .join(" / ");
  };

  const out: Champion[] = [];
  for (const cat of categories) {
    const final = matches.find(
      (m) =>
        m.categoryId === cat.id &&
        m.phase === "final" &&
        (m.status === "finalizado" || m.status === "wo")
    );
    if (!final) continue;
    const champId = final.a.winner
      ? final.a.competitorId
      : final.b.winner
      ? final.b.competitorId
      : undefined;
    if (!champId) continue;
    const viceId = champId === final.a.competitorId ? final.b.competitorId : final.a.competitorId;
    out.push({
      categoryId: cat.id,
      categoryName: cat.name,
      categoryShort: cat.shortName,
      type: cat.type,
      champion: fullName(champId),
      runnerUp: fullName(viceId),
    });
  }
  return out;
}

export async function getLiveMatches(): Promise<MatchView[]> {
  return (await getData()).matches.filter((m) => m.status === "ao_vivo");
}

export async function getUpcomingMatches(): Promise<MatchView[]> {
  return (await getData()).matches.filter((m) => m.status === "agendado");
}

export async function getFinishedMatches(): Promise<MatchView[]> {
  return (await getData()).matches.filter(
    (m) => m.status === "finalizado" || m.status === "wo"
  );
}

/** Jogos "que ainda vão/estão acontecendo" (agenda). */
export async function getAgendaMatches(): Promise<MatchView[]> {
  return (await getData()).matches.filter(
    (m) => m.status === "agendado" || m.status === "ao_vivo"
  );
}

/** Chave do mata-mata de uma categoria, agrupada por fase (ordenada como árvore). */
export async function getBracket(categoryId: string) {
  const order: Phase[] = ["oitavas", "quartas", "semi", "final", "terceiro"];
  const knockout = (await getData()).matches.filter(
    (m) => m.categoryId === categoryId && m.phase !== "grupo"
  );
  const pos = bracketPositions(knockout);
  return order
    .map((phase) => ({
      phase,
      phaseLabel: PHASE_LABEL[phase],
      matches: knockout
        .filter((m) => m.phase === phase)
        .sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0)),
    }))
    .filter((g) => g.matches.length > 0);
}

/** Perfil de um atleta: estatísticas + histórico de jogos. */
export interface AthleteProfile {
  id: string;
  name: string;
  categories: { id: string; shortName: string; partnerName: string }[];
  stats: { played: number; wins: number; losses: number; winPct: number };
  rankPosition: number | null;
  rankPoints: number;
  titles: number;
  matches: MatchView[];
}

export async function getAthleteProfile(
  athleteId: string
): Promise<AthleteProfile | null> {
  const { categories, competitors, matches } = await getData();
  const ranking = await getRanking();

  const athleteComps = competitors.filter((c) =>
    c.athletes.some((a) => a.athlete?.id === athleteId)
  );
  if (!athleteComps.length) return null;

  const athleteName =
    athleteComps[0].athletes.find((a) => a.athlete?.id === athleteId)?.athlete
      ?.name ?? "?";

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const cats = athleteComps.map((comp) => {
    const cat = catMap.get(comp.category_id);
    const partner = comp.athletes
      .filter((a) => a.athlete?.id !== athleteId)
      .map((a) => shortName(a.athlete?.name ?? "?"))
      .join(" / ");
    return {
      id: comp.category_id,
      shortName: cat?.shortName ?? "?",
      partnerName: partner,
    };
  });

  const compIds = new Set(athleteComps.map((c) => c.id));
  const athleteMatches = matches.filter(
    (m) =>
      (m.a.competitorId && compIds.has(m.a.competitorId)) ||
      (m.b.competitorId && compIds.has(m.b.competitorId))
  );

  const finished = athleteMatches.filter(
    (m) => m.status === "finalizado" || m.status === "wo"
  );
  let wins = 0;
  for (const m of finished) {
    const isA = m.a.competitorId && compIds.has(m.a.competitorId);
    if ((isA && m.a.winner) || (!isA && m.b.winner)) wins++;
  }
  const losses = finished.length - wins;

  const rankRow = ranking.find((r) => r.athleteId === athleteId);
  const rankPos = rankRow
    ? ranking.findIndex((r) => r.athleteId === athleteId) + 1
    : null;

  return {
    id: athleteId,
    name: athleteName,
    categories: cats,
    stats: {
      played: finished.length,
      wins,
      losses,
      winPct: finished.length ? Math.round((wins / finished.length) * 100) : 0,
    },
    rankPosition: rankPos,
    rankPoints: rankRow?.points ?? 0,
    titles: rankRow?.titles ?? 0,
    matches: athleteMatches.sort(
      (a, b) => (b.day + b.time).localeCompare(a.day + a.time)
    ),
  };
}

/** Lista todos os atletas (para busca no perfil). */
export async function getAllAthletes(): Promise<
  { id: string; name: string }[]
> {
  const { competitors } = await getData();
  const seen = new Map<string, string>();
  for (const c of competitors) {
    for (const a of c.athletes) {
      if (a.athlete?.id && !seen.has(a.athlete.id)) {
        seen.set(a.athlete.id, a.athlete.name);
      }
    }
  }
  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Classificação dos grupos de uma categoria (calculada dos jogos finalizados). */
export async function getStandings(categoryId: string): Promise<GroupView[]> {
  const { categories, competitors, matches } = await getData();
  const members = competitors.filter(
    (c) => c.category_id === categoryId && c.group_id
  );
  if (!members.length) return [];
  const qualifiersPerGroup =
    categories.find((c) => c.id === categoryId)?.qualifiersPerGroup ?? 2;

  const nameById = new Map(members.map((c) => [c.id, nameOf(c)]));
  const groupMatches = matches
    .filter(
      (m) =>
        m.categoryId === categoryId &&
        m.phase === "grupo" &&
        (m.status === "finalizado" || m.status === "wo")
    )
    .map((m) => ({
      groupId: m.groupId ?? null,
      aId: m.a.competitorId ?? null,
      bId: m.b.competitorId ?? null,
      sets: m.a.sets.map((s, i) => ({ a: s.games, b: m.b.sets[i].games })),
      winnerId: m.a.winner
        ? m.a.competitorId ?? null
        : m.b.winner
          ? m.b.competitorId ?? null
          : null,
      finished: true,
    }));

  const standings = computeGroupStandings(
    members.map((c) => ({ id: c.id, groupId: c.group_id ?? null })),
    groupMatches
  );

  return standings.map(({ groupId, rows }) => ({
    groupId,
    rows: rows.map((r, i) => ({
      competitorId: r.competitorId,
      name: nameById.get(r.competitorId) ?? "?",
      played: r.played,
      wins: r.wins,
      setDiff: r.setDiff,
      gameDiff: r.gameDiff,
      points: r.points,
      setPct: r.setPct,
      gamePct: r.gamePct,
      qualifies: i < qualifiersPerGroup,
    })),
  }));
}
