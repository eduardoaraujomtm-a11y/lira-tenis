// Classificação de grupos — função pura, reusável no cliente e no servidor.

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
  setDiff: number;
  gameDiff: number;
  points: number;
}

/** Ordena os competidores de cada grupo por pontos, saldo de sets e de games. */
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
        setDiff: 0,
        gameDiff: 0,
        points: 0,
      }));
    const map = new Map(rows.map((r) => [r.competitorId, r]));

    for (const m of finished) {
      if (m.groupId !== gid) continue;
      const rA = m.aId ? map.get(m.aId) : undefined;
      const rB = m.bId ? map.get(m.bId) : undefined;
      if (!rA || !rB) continue;
      rA.played++;
      rB.played++;
      const swA = m.sets.filter((s) => s.a > s.b).length;
      const swB = m.sets.filter((s) => s.b > s.a).length;
      rA.setDiff += swA - swB;
      rB.setDiff += swB - swA;
      const gA = m.sets.reduce((t, s) => t + s.a, 0);
      const gB = m.sets.reduce((t, s) => t + s.b, 0);
      rA.gameDiff += gA - gB;
      rB.gameDiff += gB - gA;
      if (m.winnerId === rA.competitorId) {
        rA.wins++;
        rA.points += 2;
      } else if (m.winnerId === rB.competitorId) {
        rB.wins++;
        rB.points += 2;
      }
    }

    rows.sort(
      (x, y) =>
        y.points - x.points || y.setDiff - x.setDiff || y.gameDiff - x.gameDiff
    );
    return { groupId: gid, rows };
  });
}

/**
 * Pareamento cruzado dos classificados (1º A × 2º B, 1º B × 2º A, …).
 * Retorna a lista de qualifiers ordenada para virar cabeça de chave:
 * primeiro os 1ºs colocados, depois os 2ºs.
 */
export function qualifiersSeeded(
  standings: { groupId: string; rows: StandRow[] }[],
  perGroup = 2
): { id: string; seed: number }[] {
  const winners: string[] = [];
  const runners: string[] = [];
  for (const g of standings) {
    if (g.rows[0]) winners.push(g.rows[0].competitorId);
    if (perGroup >= 2 && g.rows[1]) runners.push(g.rows[1].competitorId);
  }
  // 1ºs colocados recebem as melhores cabeças; 2ºs, as seguintes
  const ordered = [...winners, ...runners];
  return ordered.map((id, i) => ({ id, seed: i + 1 }));
}
