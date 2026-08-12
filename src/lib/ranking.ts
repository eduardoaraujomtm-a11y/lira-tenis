// ===== Ranking de atletas por desempenho no torneio =====
// Pontos = (vitórias × win) + participação + bônus da fase/colocação.
// Os pontos de uma dupla vão para CADA atleta dela; cada atleta soma tudo.

export type RankPhase =
  | "grupo"
  | "oitavas"
  | "quartas"
  | "semi"
  | "final"
  | "terceiro";

export interface PointsConfig {
  win: number; // por jogo vencido
  participacao: number; // por ter jogado ao menos 1 jogo (por categoria)
  oitavas: number; // eliminado nas oitavas
  quartas: number; // eliminado nas quartas
  semi: number; // eliminado na semi
  vice: number; // vice-campeão (perdeu a final OU 2º do grupo em cat. só grupos)
  campeao: number; // campeão (ganhou a final OU 1º do grupo em cat. só grupos)
}

export const DEFAULT_POINTS: PointsConfig = {
  win: 10,
  participacao: 5,
  oitavas: 2,
  quartas: 5,
  semi: 12,
  vice: 25,
  campeao: 50,
};

export interface RankCompetitor {
  id: string;
  athleteIds: string[];
}
export interface RankMatch {
  phase: RankPhase;
  finished: boolean;
  aId: string | null;
  bId: string | null;
  winnerId: string | null;
}

export interface PlacementBonus {
  bonus: number;
  isTitle: boolean;
}

export interface RankRow {
  athleteId: string;
  points: number;
  played: number;
  wins: number;
  titles: number;
}

const PHASE_DEPTH: Record<RankPhase, number> = {
  grupo: 0,
  oitavas: 1,
  quartas: 2,
  semi: 3,
  final: 4,
  terceiro: 0,
};

/** Bônus de acordo com a fase em que o competidor foi eliminado. */
function eliminationBonus(phase: RankPhase, cfg: PointsConfig): number {
  switch (phase) {
    case "final":
      return cfg.vice;
    case "semi":
      return cfg.semi;
    case "quartas":
      return cfg.quartas;
    case "oitavas":
      return cfg.oitavas;
    default:
      return 0;
  }
}

export function computeRanking(
  competitors: RankCompetitor[],
  matches: RankMatch[],
  cfg: PointsConfig = DEFAULT_POINTS,
  placements: Map<string, PlacementBonus> = new Map()
): RankRow[] {
  const perAthlete = new Map<string, RankRow>();
  const add = (id: string, r: Partial<RankRow>) => {
    const cur =
      perAthlete.get(id) ??
      { athleteId: id, points: 0, played: 0, wins: 0, titles: 0 };
    cur.points += r.points ?? 0;
    cur.played += r.played ?? 0;
    cur.wins += r.wins ?? 0;
    cur.titles += r.titles ?? 0;
    perAthlete.set(id, cur);
  };

  for (const c of competitors) {
    const cm = matches.filter(
      (m) => m.finished && (m.aId === c.id || m.bId === c.id)
    );
    if (cm.length === 0) continue;

    const wins = cm.filter((m) => m.winnerId === c.id).length;
    let titles = 0;
    let bonus = 0;

    const placement = placements.get(c.id);
    if (placement) {
      bonus = placement.bonus;
      titles = placement.isTitle ? 1 : 0;
    } else {
      const wonFinal = cm.some((m) => m.phase === "final" && m.winnerId === c.id);
      if (wonFinal) {
        bonus = cfg.campeao;
        titles = 1;
      } else {
        const losses = cm.filter(
          (m) => m.phase !== "grupo" && m.phase !== "terceiro" && m.winnerId !== c.id
        );
        if (losses.length) {
          const deepest = losses.reduce((a, b) =>
            PHASE_DEPTH[b.phase] > PHASE_DEPTH[a.phase] ? b : a
          );
          bonus = eliminationBonus(deepest.phase, cfg);
        }
      }
    }

    const compPoints = wins * cfg.win + cfg.participacao + bonus;
    for (const aId of c.athleteIds) {
      add(aId, { points: compPoints, played: cm.length, wins, titles });
    }
  }

  return Array.from(perAthlete.values()).sort(
    (a, b) => b.points - a.points || b.titles - a.titles || b.wins - a.wins
  );
}
