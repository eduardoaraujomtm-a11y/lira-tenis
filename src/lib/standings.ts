// Classificação de grupos — função pura, reusável no cliente e no servidor.
//
// Critérios de desempate (nesta ordem):
//   1. Nº de vitórias
//   2. Nº de partidas jogadas (mais partidas completas ganha de quem desistiu)
//   3. Empate entre DUAS duplas: confronto direto
//   4. Empate entre TRÊS ou mais: saldo de sets, saldo de games, games pró,
//      games contra — nessa ordem
//
// O super tie-break conta como um set normal e vale UM game para quem o vence,
// qualquer que tenha sido o placar: um 10-8 não pode pesar como dez games na
// conta de games, mas também não pode valer nada.

export interface StandingInputMatch {
  groupId: string | null;
  aId: string | null;
  bId: string | null;
  sets: { a: number; b: number }[];
  winnerId: string | null;
  finished: boolean;
}

export interface StandingInputCompetitor {
  id: string;
  groupId: string | null;
}

export interface StandRow {
  competitorId: string;
  played: number;
  wins: number;
  /** Sets ganhos / perdidos (super TB conta como set). */
  setsWon: number;
  setsLost: number;
  /** Games ganhos / perdidos. O super tie-break entra como 1 game para quem
   *  venceu, em vez dos games realmente disputados nele. */
  gamesWon: number;
  gamesLost: number;
  /** Percentuais (0..1). */
  setPct: number;
  gamePct: number;
  /** Mantidos para compatibilidade com a UI existente. */
  points: number;
  setDiff: number;
  gameDiff: number;
}

/** Um set é super TB quando fecha acima do intervalo normal (0..7 games). */
function isSuperTB(s: { a: number; b: number }): boolean {
  return Math.max(s.a, s.b) > 7;
}

export function computeGroupStandings(
  competitors: StandingInputCompetitor[],
  matches: StandingInputMatch[]
): { groupId: string; rows: StandRow[] }[] {
  const members = competitors.filter((c) => c.groupId);
  const groupIds = Array.from(new Set(members.map((c) => c.groupId!))).sort();
  const finished = matches.filter((m) => m.finished && m.groupId);

  return groupIds.map((gid) => {
    const rows: StandRow[] = members
      .filter((c) => c.groupId === gid)
      .map((c) => ({
        competitorId: c.id,
        played: 0,
        wins: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        setPct: 0,
        gamePct: 0,
        points: 0,
        setDiff: 0,
        gameDiff: 0,
      }));
    const map = new Map(rows.map((r) => [r.competitorId, r]));

    // Confronto direto: map de "aId|bId" (ordenado) → id do vencedor (ou null se ninguém venceu / não se enfrentaram).
    const h2h = new Map<string, string | null>();
    const h2hKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

    for (const m of finished) {
      if (m.groupId !== gid) continue;
      const rA = m.aId ? map.get(m.aId) : undefined;
      const rB = m.bId ? map.get(m.bId) : undefined;
      if (!rA || !rB) continue;

      rA.played++;
      rB.played++;

      // Sets: super TB conta como set normal (1 para o vencedor).
      const swA = m.sets.filter((s) => s.a > s.b).length;
      const swB = m.sets.filter((s) => s.b > s.a).length;
      rA.setsWon += swA;
      rA.setsLost += swB;
      rB.setsWon += swB;
      rB.setsLost += swA;

      // Games: o placar real do super TB não entra; ele vale 1 game para quem
      // venceu, seja 10-8 ou 10-0.
      const superSets = m.sets.filter(isSuperTB);
      const normalSets = m.sets.filter((s) => !isSuperTB(s));
      const gA =
        normalSets.reduce((t, s) => t + s.a, 0) +
        superSets.filter((s) => s.a > s.b).length;
      const gB =
        normalSets.reduce((t, s) => t + s.b, 0) +
        superSets.filter((s) => s.b > s.a).length;
      rA.gamesWon += gA;
      rA.gamesLost += gB;
      rB.gamesWon += gB;
      rB.gamesLost += gA;

      if (m.winnerId === rA.competitorId) {
        rA.wins++;
        rA.points += 2;
      } else if (m.winnerId === rB.competitorId) {
        rB.wins++;
        rB.points += 2;
      }

      h2h.set(h2hKey(rA.competitorId, rB.competitorId), m.winnerId);
    }

    // Percentuais derivados + saldos (mantidos para UIs antigas).
    for (const r of rows) {
      const totalSets = r.setsWon + r.setsLost;
      const totalGames = r.gamesWon + r.gamesLost;
      r.setPct = totalSets ? r.setsWon / totalSets : 0;
      r.gamePct = totalGames ? r.gamesWon / totalGames : 0;
      r.setDiff = r.setsWon - r.setsLost;
      r.gameDiff = r.gamesWon - r.gamesLost;
    }

    // Passo 1: ordenar por vitórias e partidas jogadas.
    rows.sort((x, y) => y.wins - x.wins || y.played - x.played);

    // Passo 2: dentro de cada grupo com wins+played iguais, aplicar os critérios seguintes.
    const result: StandRow[] = [];
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (
        j < rows.length &&
        rows[j].wins === rows[i].wins &&
        rows[j].played === rows[i].played
      )
        j++;
      const tied = rows.slice(i, j);

      if (tied.length === 2) {
        // Confronto direto decide se um venceu o outro.
        const [x, y] = tied;
        const w = h2h.get(h2hKey(x.competitorId, y.competitorId));
        if (w === x.competitorId) result.push(x, y);
        else if (w === y.competitorId) result.push(y, x);
        else result.push(...sortByBalance(tied));
      } else {
        // Três ou mais: o confronto direto não resolve (podem ter ganho um do
        // outro em círculo), então vale o saldo.
        result.push(...sortByBalance(tied));
      }
      i = j;
    }
    return { groupId: gid, rows: result };
  });
}

/** Saldo de sets → saldo de games → games pró (mais) → games contra (menos). */
function sortByBalance(rows: StandRow[]): StandRow[] {
  return [...rows].sort(
    (x, y) =>
      y.setDiff - x.setDiff ||
      y.gameDiff - x.gameDiff ||
      y.gamesWon - x.gamesWon ||
      x.gamesLost - y.gamesLost
  );
}

/**
 * Classificados para o mata-mata, ordenados para virar cabeça de chave:
 * primeiro todos os 1ºs colocados (de cada grupo), depois todos os 2ºs,
 * depois os 3ºs, etc. — até `perGroup` posições por grupo. O tamanho da
 * chave (só final, semi+final, quartas+semi+final...) decorre naturalmente
 * da quantidade total de classificados.
 */
export function qualifiersSeeded(
  standings: { groupId: string; rows: StandRow[] }[],
  perGroup = 2
): { id: string; seed: number }[] {
  const buckets: string[][] = Array.from({ length: perGroup }, () => []);
  for (const g of standings) {
    for (let rank = 0; rank < perGroup; rank++) {
      if (g.rows[rank]) buckets[rank].push(g.rows[rank].competitorId);
    }
  }
  const ordered = buckets.flat();
  return ordered.map((id, i) => ({ id, seed: i + 1 }));
}
