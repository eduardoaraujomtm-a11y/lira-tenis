// ===== Motor de placar de tênis (games/sets, tie-break e super tie-break) =====
// Detalhe "games e sets": o mesário toca +game; no 6-6 entra o tie-break
// (tocando +ponto); no set decisivo com superTiebreak, o set é um super TB à parte.

import type { ScoreRule } from "./types";

export interface SetS {
  a: number;
  b: number;
  tbA?: number;
  tbB?: number;
}

export interface MatchScore {
  sets: SetS[];
  live: { server: "A" | "B"; a: string; b: string } | null;
  status: "ao_vivo" | "finalizado";
  winner?: "A" | "B";
}

export type Mode = "game" | "tiebreak" | "super";

const otherSide = (s: "A" | "B"): "A" | "B" => (s === "A" ? "B" : "A");

function setsNeeded(rule: ScoreRule) {
  return Math.floor(rule.bestOfSets / 2) + 1;
}

/** Sets já vencidos por cada lado (considerando apenas sets completos passados). */
function wonBy(completed: SetS[]) {
  let a = 0;
  let b = 0;
  for (const s of completed) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

/** Modo atual do jogo, derivado do estado + regra. */
export function mode(sets: SetS[], rule: ScoreRule): Mode {
  const completed = sets.slice(0, -1);
  const w = wonBy(completed);
  const need = setsNeeded(rule);
  if (rule.superTiebreak && w.a === need - 1 && w.b === need - 1) return "super";
  const cur = sets[sets.length - 1];
  if (cur && cur.a === rule.gamesPerSet && cur.b === rule.gamesPerSet)
    return "tiebreak";
  return "game";
}

/** Estado inicial ao iniciar um jogo. */
export function startMatch(rule: ScoreRule, server: "A" | "B" = "A"): MatchScore {
  const sets: SetS[] = [{ a: 0, b: 0 }];
  const m = mode(sets, rule);
  return {
    sets,
    live: m === "game" ? null : { server, a: "0", b: "0" },
    status: "ao_vivo",
  };
}

function tbTarget(m: Mode, rule: ScoreRule) {
  return m === "super" ? rule.superTiebreakTo : rule.tiebreakTo;
}

function tbOver(pa: number, pb: number, target: number) {
  return Math.max(pa, pb) >= target && Math.abs(pa - pb) >= 2;
}

/** Fecha o set atual e decide se o jogo terminou. Muta `state`. */
function completeSet(state: MatchScore, rule: ScoreRule) {
  const cur = state.sets[state.sets.length - 1];
  const winnerSide: "A" | "B" = cur.a > cur.b ? "A" : "B";
  const w = wonBy(state.sets); // inclui o set recém-fechado
  const need = setsNeeded(rule);
  if (w.a >= need || w.b >= need) {
    state.status = "finalizado";
    state.winner = w.a >= need ? "A" : "B";
    state.live = null;
    return;
  }
  // Próximo set
  state.sets.push({ a: 0, b: 0 });
  const nextMode = mode(state.sets, rule);
  state.live =
    nextMode === "game"
      ? null
      : { server: otherSide(winnerSide), a: "0", b: "0" };
}

/** Aplica um GAME para o lado indicado (válido só no modo "game"). */
export function applyGame(
  prev: MatchScore,
  side: "A" | "B",
  rule: ScoreRule
): MatchScore {
  const state: MatchScore = structuredClone(prev);
  if (state.status !== "ao_vivo") return state;
  if (mode(state.sets, rule) !== "game") return state; // ignora fora de hora
  const cur = state.sets[state.sets.length - 1];
  const key = side === "A" ? "a" : "b";
  cur[key]++;

  const lead = Math.abs(cur.a - cur.b);
  if (cur[key] >= rule.gamesPerSet && lead >= 2) {
    completeSet(state, rule);
    return state;
  }
  // Entrou em tie-break (ex: 6-6)?
  if (cur.a === rule.gamesPerSet && cur.b === rule.gamesPerSet) {
    cur.tbA = 0;
    cur.tbB = 0;
    state.live = { server: state.live?.server ?? "A", a: "0", b: "0" };
  }
  return state;
}

/** Aplica um PONTO de tie-break/super tie-break. */
export function applyTiebreakPoint(
  prev: MatchScore,
  side: "A" | "B",
  rule: ScoreRule
): MatchScore {
  const state: MatchScore = structuredClone(prev);
  if (state.status !== "ao_vivo") return state;
  const m = mode(state.sets, rule);
  if (m === "game") return state;
  const cur = state.sets[state.sets.length - 1];

  let pa: number;
  let pb: number;
  if (m === "super") {
    if (side === "A") cur.a++;
    else cur.b++;
    pa = cur.a;
    pb = cur.b;
  } else {
    if (side === "A") cur.tbA = (cur.tbA ?? 0) + 1;
    else cur.tbB = (cur.tbB ?? 0) + 1;
    pa = cur.tbA ?? 0;
    pb = cur.tbB ?? 0;
  }

  state.live = {
    server: state.live?.server ?? "A",
    a: String(pa),
    b: String(pb),
  };

  if (tbOver(pa, pb, tbTarget(m, rule))) {
    if (m === "tiebreak") {
      // Set fecha em 7-6 (vencedor ganha o game do tie-break)
      if (pa > pb) cur.a = rule.gamesPerSet + 1;
      else cur.b = rule.gamesPerSet + 1;
    }
    // super: os games do set já são os próprios pontos (ex: 10-8)
    completeSet(state, rule);
  }
  return state;
}

/** Encerra manualmente (ex: desistência) declarando um vencedor. */
export function forceWinner(prev: MatchScore, side: "A" | "B"): MatchScore {
  const state: MatchScore = structuredClone(prev);
  state.status = "finalizado";
  state.winner = side;
  state.live = null;
  return state;
}
