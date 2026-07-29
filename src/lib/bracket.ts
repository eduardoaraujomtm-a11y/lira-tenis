// ===== Geração de chaves: mata-mata (seeds + byes) e fase de grupos =====
import type { Phase } from "./types";

export interface SeedInput {
  id: string;
  seed?: number | null;
}

export interface GenMatch {
  key: string; // chave temporária p/ ligar next_match antes de ter UUID
  phase: Phase;
  round: number; // 0 = primeira rodada da fase
  indexInRound: number;
  groupId?: string;
  competitorA?: string;
  competitorB?: string;
  nextKey?: string;
  nextSlot?: "A" | "B";
}

// ---------- Mata-mata ----------

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordem de semeadura padrão para um chaveamento de tamanho `size` (potência de 2). */
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(n + 1 - s);
    }
    order = next;
  }
  return order;
}

function phaseForCount(matchCount: number): Phase {
  if (matchCount >= 8) return "oitavas";
  if (matchCount === 4) return "quartas";
  if (matchCount === 2) return "semi";
  return "final";
}

/**
 * Gera um mata-mata de eliminação simples com cabeças de chave e byes.
 * Cabeças (seed) ficam nas posições padrão; sobras de vaga viram bye (o
 * competidor avança direto). Suporta até 16 competidores (oitavas).
 */
export function generateKnockout(competitors: SeedInput[]): GenMatch[] {
  const n = competitors.length;
  if (n < 2) return [];
  const size = Math.min(nextPow2(n), 16);

  // Ordena: com seed primeiro (por seed), depois os demais na ordem dada.
  const seeded = competitors
    .filter((c) => c.seed != null)
    .sort((a, b) => (a.seed! - b.seed!));
  const unseeded = competitors.filter((c) => c.seed == null);
  const ranked = [...seeded, ...unseeded]; // rank 1..n
  // Posição de semeadura -> competidor (ou null = bye)
  const order = seedOrder(size);
  const occupants: (string | null)[] = order.map((seedPos) =>
    seedPos <= ranked.length ? ranked[seedPos - 1].id : null
  );

  const totalRounds = Math.log2(size);
  const matches: GenMatch[] = [];
  const byKey = new Map<string, GenMatch>();

  // Cria todos os confrontos (vazios) e faz a ligação de avanço
  for (let r = 0; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) {
      const key = `r${r}-${i}`;
      const gm: GenMatch = {
        key,
        phase: phaseForCount(count),
        round: r,
        indexInRound: i,
      };
      if (r < totalRounds - 1) {
        gm.nextKey = `r${r + 1}-${Math.floor(i / 2)}`;
        gm.nextSlot = i % 2 === 0 ? "A" : "B";
      }
      matches.push(gm);
      byKey.set(key, gm);
    }
  }

  // Preenche a primeira rodada e resolve byes
  const removed = new Set<string>();
  const first = matches.filter((m) => m.round === 0);
  for (const m of first) {
    const a = occupants[m.indexInRound * 2];
    const b = occupants[m.indexInRound * 2 + 1];
    if (a && b) {
      m.competitorA = a;
      m.competitorB = b;
    } else if (a || b) {
      // Bye: o competidor avança direto pro próximo confronto
      const adv = (a ?? b)!;
      if (m.nextKey && m.nextSlot) {
        const nxt = byKey.get(m.nextKey)!;
        if (m.nextSlot === "A") nxt.competitorA = adv;
        else nxt.competitorB = adv;
      }
      removed.add(m.key);
    } else {
      removed.add(m.key); // vaga dupla (não deveria ocorrer)
    }
  }

  return matches.filter((m) => !removed.has(m.key));
}

// ---------- Fase de grupos ----------

/** Distribui competidores em `numGroups` grupos por semeadura em serpentina. */
export function distributeGroups(
  competitors: SeedInput[],
  numGroups: number
): { groupId: string; competitorIds: string[] }[] {
  const seeded = competitors
    .filter((c) => c.seed != null)
    .sort((a, b) => a.seed! - b.seed!);
  const unseeded = competitors.filter((c) => c.seed == null);
  const ranked = [...seeded, ...unseeded];

  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  ranked.forEach((c, idx) => {
    const row = Math.floor(idx / numGroups);
    const col = idx % numGroups;
    // serpentina: linhas ímpares invertem a ordem
    const g = row % 2 === 0 ? col : numGroups - 1 - col;
    groups[g].push(c.id);
  });

  const letters = "ABCDEFGH";
  return groups.map((competitorIds, i) => ({
    groupId: letters[i],
    competitorIds,
  }));
}

/** Round-robin (todos contra todos) pelo método do círculo. */
export function roundRobin(ids: string[]): { round: number; a: string; b: string }[] {
  const list = [...ids];
  if (list.length < 2) return [];
  const bye = list.length % 2 === 1;
  if (bye) list.push("__BYE__");
  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...list];
  const games: { round: number; a: string; b: string }[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") {
        games.push({ round: r + 1, a, b });
      }
    }
    // rotaciona mantendo o primeiro fixo
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return games;
}

/** Gera os jogos da fase de grupos (sem ligação de avanço). */
export function generateGroupMatches(
  groups: { groupId: string; competitorIds: string[] }[]
): GenMatch[] {
  const out: GenMatch[] = [];
  for (const g of groups) {
    const games = roundRobin(g.competitorIds);
    games.forEach((game, i) => {
      out.push({
        key: `g${g.groupId}-${i}`,
        phase: "grupo",
        round: game.round,
        indexInRound: i,
        groupId: g.groupId,
        competitorA: game.a,
        competitorB: game.b,
      });
    });
  }
  return out;
}
