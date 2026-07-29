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

// ---- Formas das linhas cruas vindas do Supabase ----
interface RawCompetitor {
  id: string;
  category_id: string;
  seed: number | null;
  group_id: string | null;
  athletes: { position: number; athlete: { name: string } | null }[];
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
  sets: RawSet[];
  live: { server?: "A" | "B"; a: string; b: string } | null;
  winner_id: string | null;
  court: { name: string } | null;
}
interface RawCategory {
  id: string;
  name: string;
  short_name: string;
  type: CompetitorType;
  format: Format;
  sort_order: number;
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
      .select("id,name,short_name,type,format,sort_order")
      .order("sort_order"),
    supabase
      .from("competitors")
      .select(
        "id,category_id,seed,group_id,athletes:competitor_athletes(position,athlete:athletes(name))"
      ),
    supabase
      .from("matches")
      .select(
        "id,category_id,phase,group_id,round,day,time,status,competitor_a,competitor_b,sets,live,winner_id,court:courts(name)"
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
    isLive: boolean
  ): SideView => {
    const c = compId ? compMap.get(compId) : undefined;
    const won = setsWon(sets);
    const leading =
      isLive && (pick === "a" ? won.a > won.b : won.b > won.a);
    return {
      competitorId: compId ?? undefined,
      name: nameOf(c),
      seed: c?.seed ?? undefined,
      sets: sets.map((s) => ({
        games: pick === "a" ? s.a : s.b,
        tb:
          s.tbA !== undefined && s.tbB !== undefined
            ? Math.min(s.tbA, s.tbB)
            : undefined,
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
      a: side(m.competitor_a, m.sets, "a", m.winner_id, isLive),
      b: side(m.competitor_b, m.sets, "b", m.winner_id, isLive),
      point: m.live
        ? { server: m.live.server, a: m.live.a, b: m.live.b }
        : undefined,
    };
  });

  const categoryViews: CategoryView[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.short_name,
    type: c.type,
    format: c.format,
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

/** Chave do mata-mata de uma categoria, agrupada por fase. */
export async function getBracket(categoryId: string) {
  const order: Phase[] = ["oitavas", "quartas", "semi", "final"];
  const knockout = (await getData()).matches.filter(
    (m) => m.categoryId === categoryId && m.phase !== "grupo"
  );
  return order
    .map((phase) => ({
      phase,
      phaseLabel: PHASE_LABEL[phase],
      matches: knockout.filter((m) => m.phase === phase),
    }))
    .filter((g) => g.matches.length > 0);
}

/** Classificação dos grupos de uma categoria (calculada dos jogos finalizados). */
export async function getStandings(categoryId: string): Promise<GroupView[]> {
  const { competitors, matches } = await getData();
  const members = competitors.filter(
    (c) => c.category_id === categoryId && c.group_id
  );
  if (!members.length) return [];

  const groupIds = Array.from(new Set(members.map((c) => c.group_id!))).sort();
  const played = matches.filter(
    (m) =>
      m.categoryId === categoryId &&
      m.phase === "grupo" &&
      (m.status === "finalizado" || m.status === "wo")
  );

  return groupIds.map((gid) => {
    const rows: StandingRow[] = members
      .filter((c) => c.group_id === gid)
      .map((c) => ({
        competitorId: c.id,
        name: nameOf(c),
        played: 0,
        wins: 0,
        setDiff: 0,
        gameDiff: 0,
        points: 0,
        qualifies: false,
      }));
    const rowMap = new Map(rows.map((r) => [r.competitorId, r]));

    for (const m of played) {
      const rA = rowMap.get(m.a.competitorId ?? "");
      const rB = rowMap.get(m.b.competitorId ?? "");
      if (!rA || !rB) continue;
      rA.played++;
      rB.played++;
      const swA = m.a.sets.filter((s, i) => s.games > m.b.sets[i].games).length;
      const swB = m.b.sets.filter((s, i) => s.games > m.a.sets[i].games).length;
      rA.setDiff += swA - swB;
      rB.setDiff += swB - swA;
      const gA = m.a.sets.reduce((t, s) => t + s.games, 0);
      const gB = m.b.sets.reduce((t, s) => t + s.games, 0);
      rA.gameDiff += gA - gB;
      rB.gameDiff += gB - gA;
      if (m.a.winner) {
        rA.wins++;
        rA.points += 2;
      } else if (m.b.winner) {
        rB.wins++;
        rB.points += 2;
      }
    }

    rows.sort(
      (x, y) =>
        y.points - x.points || y.setDiff - x.setDiff || y.gameDiff - x.gameDiff
    );
    rows.forEach((r, i) => (r.qualifies = i < 2));
    return { groupId: gid, rows };
  });
}
