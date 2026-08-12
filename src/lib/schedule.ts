// Organiza automaticamente os jogos do torneio pelos dias/horários disponíveis.
//
// Regras:
//   - Cada RODADA de mata-mata ocupa um dia só dela, contando de trás para a
//     frente: a final (com a disputa de 3º) no último dia, a semifinal no
//     penúltimo, as quartas no antepenúltimo, e assim por diante. Duas rodadas
//     nunca dividem o mesmo dia — ninguém joga quartas e semi no mesmo dia.
//   - Os jogos de grupo ficam nos dias anteriores. Se não couberem, podem
//     transbordar para um dia de mata-mata, desde que seja ANTES do mata-mata
//     da própria categoria (uma categoria nunca joga a fase de grupos no dia
//     da sua própria chave, ou depois dele).
//   - Cada slot de horário aceita, no máximo, `courtCapacity` jogos em paralelo
//     (uma partida por quadra disponível). A quadra específica NÃO é definida
//     aqui — o organizador escolhe na hora do jogo.
//   - Um competidor nunca é marcado em 2 jogos ao mesmo tempo, mesmo em dias
//     ou categorias diferentes.

import type { Phase } from "./types";

export interface SchedInput {
  id: string;
  phase: Phase;
  aId: string | null;
  bId: string | null;
  /** Agrupa os jogos por categoria, para que a fase de grupos de uma categoria
   *  nunca caia no dia do mata-mata dela mesma. */
  categoryKey: string;
}

export interface SchedAssignment {
  day: string;
  time: string;
}

export const DEFAULT_SLOTS = [
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
  "19:30",
];

/**
 * Horários disponíveis em cada dia. `byDay` guarda os dias com horário próprio;
 * os demais usam `fallback`. Um dia com lista vazia é dia sem jogos e sai da
 * conta — inclusive na hora de reservar os dias do mata-mata.
 */
export interface SlotPlan {
  fallback: string[];
  byDay?: Record<string, string[]>;
}

export function slotsOn(plan: SlotPlan, day: string): string[] {
  return plan.byDay?.[day] ?? plan.fallback;
}

/** Dias que realmente recebem jogos, em ordem. */
export function playableDays(plan: SlotPlan, days: string[]): string[] {
  return [...days].sort().filter((d) => slotsOn(plan, d).length > 0);
}

/** Rodadas de mata-mata, da primeira à última. Final e disputa de 3º dividem o
 *  mesmo dia — são os jogos de encerramento. */
const KNOCKOUT_ROUNDS: Phase[][] = [
  ["oitavas"],
  ["quartas"],
  ["semi"],
  ["final", "terceiro"],
];

export const KNOCKOUT_PHASES: Phase[] = KNOCKOUT_ROUNDS.flat();

const cellKey = (day: string, time: string) => `${day}|${time}`;

/**
 * Reserva um dia para cada rodada de mata-mata presente, de trás para frente.
 * Retorna fase -> dia. Se não houver dias suficientes, as rodadas mais antigas
 * repetem o primeiro dia disponível (melhor do que ficar sem data).
 */
export function knockoutDayPlan(
  phases: Phase[],
  days: string[]
): Map<Phase, string> {
  const plan = new Map<Phase, string>();
  if (!days.length) return plan;
  const present = new Set(phases);
  const rounds = KNOCKOUT_ROUNDS.filter((r) => r.some((p) => present.has(p)));
  const sorted = [...days].sort();

  rounds.forEach((round, i) => {
    // A última rodada fica no último dia; a anterior no dia anterior, etc.
    const fromEnd = rounds.length - 1 - i;
    const day = sorted[Math.max(0, sorted.length - 1 - fromEnd)];
    for (const p of round) plan.set(p, day);
  });
  return plan;
}

/**
 * Encaixa os jogos de mata-mata, cada rodada no seu dia. Dentro do dia, os
 * jogos ocupam os primeiros horários livres.
 */
export function scheduleKnockout(
  matches: { id: string; phase: Phase }[],
  days: string[],
  slots: SlotPlan,
  courtCapacity: number,
  /** Ocupação já existente por dia|hora (jogos de outras fases). Mutada. */
  usage: Map<string, number> = new Map()
): Map<string, SchedAssignment> {
  const result = new Map<string, SchedAssignment>();
  const usable = playableDays(slots, days);
  if (!matches.length || !usable.length || courtCapacity < 1) return result;

  const plan = knockoutDayPlan(
    matches.map((m) => m.phase),
    usable
  );

  for (const phase of KNOCKOUT_PHASES) {
    const list = matches.filter((m) => m.phase === phase);
    if (!list.length) continue;
    const day = plan.get(phase);
    if (!day) continue;
    const times = slotsOn(slots, day);

    for (const m of list) {
      // Primeiro horário do dia com quadra livre. Se o dia lotar, vai para o
      // horário menos cheio — manter a rodada no seu dia vale mais que a
      // capacidade, mas o excesso se espalha em vez de empilhar tudo junto.
      const free = times.find(
        (t) => (usage.get(cellKey(day, t)) ?? 0) < courtCapacity
      );
      const time =
        free ??
        times.reduce((best, t) =>
          (usage.get(cellKey(day, t)) ?? 0) < (usage.get(cellKey(day, best)) ?? 0)
            ? t
            : best
        );
      result.set(m.id, { day, time });
      usage.set(cellKey(day, time), (usage.get(cellKey(day, time)) ?? 0) + 1);
    }
  }
  return result;
}

export function autoSchedule(
  matches: SchedInput[],
  days: string[],
  slots: SlotPlan,
  courtCapacity: number
): Map<string, SchedAssignment> {
  const result = new Map<string, SchedAssignment>();
  const sortedDays = playableDays(slots, days);
  if (!sortedDays.length || courtCapacity < 1) return result;

  const usage = new Map<string, number>();
  const usedByCompSlot = new Set<string>();
  // Quantos jogos cada competidor já tem em cada dia — usado para PREFERIR
  // dias em que a pessoa ainda não jogou.
  const compGamesInDay = new Map<string, number>();
  const compSlotKey = (d: string, t: string, id: string) => `${d}|${t}|${id}`;
  const compDayKey = (d: string, id: string) => `${d}|${id}`;
  const gamesInDay = (d: string, id: string | null) =>
    id ? compGamesInDay.get(compDayKey(d, id)) ?? 0 : 0;

  // ---- 1. Mata-mata primeiro: cada rodada tem dia próprio e prioridade nele.
  const knockout = matches.filter((m) => m.phase !== "grupo");
  const koPlan = knockoutDayPlan(
    knockout.map((m) => m.phase),
    sortedDays
  );
  for (const [id, a] of scheduleKnockout(knockout, sortedDays, slots, courtCapacity, usage))
    result.set(id, a);

  // Dia do PRIMEIRO jogo de mata-mata de cada categoria: a fase de grupos dela
  // tem de terminar antes disso.
  const ownKoDay = new Map<string, string>();
  for (const m of knockout) {
    const d = koPlan.get(m.phase);
    if (!d) continue;
    const cur = ownKoDay.get(m.categoryKey);
    if (!cur || d < cur) ownKoDay.set(m.categoryKey, d);
  }
  const firstKoDay = [...koPlan.values()].sort()[0];

  // ---- 2. Grupos nos dias restantes.
  // Quantos jogos cada dia já tem, para espalhar em vez de lotar o primeiro dia.
  const dayFill = new Map<string, number>();
  for (const a of result.values()) dayFill.set(a.day, (dayFill.get(a.day) ?? 0) + 1);

  function commit(m: SchedInput, a: SchedAssignment) {
    result.set(m.id, a);
    dayFill.set(a.day, (dayFill.get(a.day) ?? 0) + 1);
    usage.set(cellKey(a.day, a.time), (usage.get(cellKey(a.day, a.time)) ?? 0) + 1);
    for (const id of [m.aId, m.bId]) {
      if (!id) continue;
      usedByCompSlot.add(compSlotKey(a.day, a.time, id));
      compGamesInDay.set(
        compDayKey(a.day, id),
        (compGamesInDay.get(compDayKey(a.day, id)) ?? 0) + 1
      );
    }
  }

  // Categorias cuja chave começa mais cedo têm menos dias disponíveis para a
  // fase de grupos — elas escolhem primeiro. As que não têm mata-mata ficam por
  // último, porque podem transbordar para qualquer dia.
  const groupMatches = matches
    .filter((m) => m.phase === "grupo")
    .sort(
      (a, b) =>
        (ownKoDay.get(a.categoryKey) ?? "￿").localeCompare(
          ownKoDay.get(b.categoryKey) ?? "￿"
        )
    );

  for (const m of groupMatches) {
    // Dias em que este jogo de grupo pode acontecer: antes do mata-mata da
    // própria categoria (ou qualquer dia, se a categoria não tem mata-mata).
    const limit = ownKoDay.get(m.categoryKey);
    const usable = sortedDays.filter((d) => (limit ? d < limit : true));
    // Ideal: antes de o mata-mata começar. Reserva: os dias de mata-mata que
    // ainda são anteriores à chave desta categoria.
    const ideal = firstKoDay ? usable.filter((d) => d < firstKoDay) : usable;
    const pools = ideal.length ? [ideal, usable] : [usable];

    let placed: SchedAssignment | null = null;
    for (const pool of pools) {
      // Prefere o dia em que os dois competidores têm menos jogos; no empate, o
      // dia mais vazio (espalha a categoria em vez de lotar os primeiros dias)
      // e, por fim, a ordem cronológica.
      const ranked = pool
        .map((d, i) => ({
          d,
          i,
          load: gamesInDay(d, m.aId) + gamesInDay(d, m.bId),
          fill: dayFill.get(d) ?? 0,
        }))
        .sort((x, y) => x.load - y.load || x.fill - y.fill || x.i - y.i);
      for (const { d } of ranked) {
        for (const t of slotsOn(slots, d)) {
          if ((usage.get(cellKey(d, t)) ?? 0) >= courtCapacity) continue;
          if (m.aId && usedByCompSlot.has(compSlotKey(d, t, m.aId))) continue;
          if (m.bId && usedByCompSlot.has(compSlotKey(d, t, m.bId))) continue;
          placed = { day: d, time: t };
          break;
        }
        if (placed) break;
      }
      if (placed) break;
    }

    // Sem espaço: relaxa o conflito de competidor, mas respeita a capacidade.
    if (!placed)
      for (const d of usable) {
        for (const t of slotsOn(slots, d))
          if ((usage.get(cellKey(d, t)) ?? 0) < courtCapacity) {
            placed = { day: d, time: t };
            break;
          }
        if (placed) break;
      }

    // Impossibilidade física: faltam dias/horários/quadras para todos os jogos.
    // Escolhe o horário menos cheio entre os dias possíveis, para o excesso
    // ficar distribuído em vez de amontoado num horário só.
    if (!placed) {
      const cells = (usable.length ? usable : sortedDays).flatMap((d) =>
        slotsOn(slots, d).map((t) => ({ day: d, time: t }))
      );
      placed = cells.length
        ? cells.reduce((best, c) =>
            (usage.get(cellKey(c.day, c.time)) ?? 0) <
            (usage.get(cellKey(best.day, best.time)) ?? 0)
              ? c
              : best
          )
        : { day: sortedDays[0], time: slotsOn(slots, sortedDays[0])[0] };
    }
    commit(m, placed);
  }

  return result;
}
