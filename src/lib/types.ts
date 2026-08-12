// ===== Modelo de dados do torneio — Lira Tênis Clube =====

export type Gender = "M" | "F";
export type CompetitorType = "simples" | "duplas";
export type Format = "grupos" | "grupos_mata_mata" | "mata_mata";

export type MatchStatus = "agendado" | "ao_vivo" | "finalizado" | "wo";

export type Phase =
  | "grupo"
  | "oitavas"
  | "quartas"
  | "semi"
  | "final"
  | "terceiro";

/** Regras de placar configuráveis por categoria. */
export interface ScoreRule {
  /** Melhor de N sets (ex: 3 = melhor de 3). */
  bestOfSets: number;
  /** Games para fechar um set (6 padrão, 4 set curto). */
  gamesPerSet: number;
  /** Ponto do tie-break normal (7 padrão). */
  tiebreakTo: number;
  /** Substituir o set decisivo por super tie-break. */
  superTiebreak: boolean;
  /** Ponto do super tie-break (10 padrão). */
  superTiebreakTo: number;
  /** Sem vantagem (ponto decisivo no 40-40). */
  noAd: boolean;
}

export interface Athlete {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface Category {
  id: string;
  name: string; // ex: "Masculino - 1ª Classe"
  shortName: string; // ex: "Masc 1ª"
  gender: Gender;
  type: CompetitorType;
  format: Format;
  rule: ScoreRule;
  /** Quantos competidores de cada grupo avançam ao mata-mata (2 ou 4). */
  qualifiersPerGroup: number;
}

export interface Competitor {
  id: string;
  categoryId: string;
  athletes: Athlete[]; // 1 (simples) ou 2 (duplas)
  seed?: number; // cabeça de chave
  groupId?: string; // quando há fase de grupos
}

export interface Court {
  id: string;
  name: string; // ex: "Quadra 1"
}

/** Placar de um set. tb* preenchido quando houve tie-break. */
export interface SetScore {
  a: number;
  b: number;
  tbA?: number;
  tbB?: number;
}

/** Placar do game em andamento (0/15/30/40/AD). */
export type Point = "0" | "15" | "30" | "40" | "AD";

export interface Match {
  id: string;
  categoryId: string;
  phase: Phase;
  groupId?: string;
  round?: number; // rodada dentro da fase de grupos
  courtId?: string;
  /** Data do jogo em ISO (YYYY-MM-DD). */
  day: string;
  /** Horário HH:mm. */
  time: string;
  status: MatchStatus;
  competitorAId?: string; // pode estar vazio até a chave definir
  competitorBId?: string;
  sets: SetScore[];
  /** Quem saca no game atual (ao vivo). */
  server?: "A" | "B";
  /** Pontos do game atual (ao vivo). */
  point?: { a: Point; b: Point };
  winnerId?: string;
  /** Avanço no mata-mata: para qual jogo o vencedor vai e em qual slot. */
  nextMatchId?: string;
  nextSlot?: "A" | "B";
}

export interface Tournament {
  id: string;
  name: string;
  club: string;
  edition: string;
  days: string[]; // datas ISO
}

// ===== Tipos "hidratados" (já com referências resolvidas, prontos pra UI) =====

export interface SideView {
  competitorId?: string;
  name: string;
  seed?: number;
  sets: { games: number; tb?: number }[];
  winner: boolean;
}

export interface MatchView {
  id: string;
  categoryId: string;
  categoryShort: string;
  phase: Phase;
  phaseLabel: string;
  groupId?: string;
  courtName?: string;
  day: string;
  time: string;
  status: MatchStatus;
  isLive: boolean;
  a: SideView;
  b: SideView;
  /** Game em andamento (ao vivo). */
  point?: { server?: "A" | "B"; a: string; b: string };
  /** Texto para busca por nome (nomes completos + categoria, minúsculo). */
  searchText: string;
  /** Encadeamento do mata-mata (para desenhar a chave na ordem certa). */
  nextMatchId?: string;
  nextSlot?: "A" | "B";
}

export interface Champion {
  categoryId: string;
  categoryName: string;
  categoryShort: string;
  type: CompetitorType;
  champion: string;
  runnerUp: string;
}

export interface CategoryView {
  id: string;
  name: string;
  shortName: string;
  type: CompetitorType;
  format: Format;
  qualifiersPerGroup: number;
}

export interface StandingRow {
  competitorId: string;
  name: string;
  played: number;
  wins: number;
  setDiff: number;
  gameDiff: number;
  points: number;
  /** % de sets ganhos (0..1). Super tie-break conta como set normal. */
  setPct: number;
  /** % de games ganhos (0..1). Games do super tie-break são descartados. */
  gamePct: number;
  qualifies: boolean;
}

export interface GroupView {
  groupId: string;
  rows: StandingRow[];
}
