// ===== Geração de chaves: mata-mata (seeds + byes) e fase de grupos =====
import type { Phase } from "./types";
import { PHASE_LABEL } from "./tennis";

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
  /** Previsão do confronto enquanto não se sabe QUEM joga ("2º do Grupo B"). */
  labelA?: string;
  labelB?: string;
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
/** Embaralhamento Fisher–Yates usando um gerador de aleatórios injetável. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param opts.rng  Se informado, faz o SORTEIO no padrão das federações:
 *   cabeças 1 e 2 fixas; cada faixa seguinte (3-4, 5-8, 9-16) é sorteada
 *   entre suas posições; e os não-cabeças são sorteados nas vagas restantes.
 *   Sem rng, o comportamento é determinístico (cabeças na ordem padrão).
 */
export function generateKnockout(
  competitors: SeedInput[],
  opts?: { rng?: () => number }
): GenMatch[] {
  const rng = opts?.rng;
  const n = competitors.length;
  if (n < 2) return [];
  const size = Math.min(nextPow2(n), 16);

  // Ordena as cabeças por seed; os demais ficam à parte.
  const seeded = competitors
    .filter((c) => c.seed != null)
    .sort((a, b) => (a.seed! - b.seed!));
  let unseeded = competitors.filter((c) => c.seed == null);

  // Sorteio por faixas (só quando rng é fornecido)
  let orderedSeeds = seeded;
  if (rng) {
    orderedSeeds = [];
    const tierBounds = [1, 2, 4, 8, 16]; // fim de cada faixa: {1},{2},{3-4},{5-8},{9-16}
    let start = 0;
    for (const end of tierBounds) {
      const slice = seeded.slice(start, end);
      // faixas com mais de 1 cabeça são sorteadas; 1 e 2 (sozinhas) ficam fixas
      orderedSeeds.push(...(slice.length > 1 ? shuffle(slice, rng) : slice));
      start = end;
      if (start >= seeded.length) break;
    }
    unseeded = shuffle(unseeded, rng);
  }

  const ranked = [...orderedSeeds, ...unseeded]; // rank 1..n
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
/**
 * @param opts.rng  Faz o SORTEIO de verdade: os não-cabeças são embaralhados e
 *   as letras dos grupos são sorteadas. Sem isso o resultado é sempre o mesmo,
 *   o que serve para testes mas não para um chaveamento real.
 */
export function distributeGroups(
  competitors: SeedInput[],
  numGroups: number,
  opts?: { rng?: () => number }
): { groupId: string; competitorIds: string[] }[] {
  const rng = opts?.rng;
  const seeded = competitors
    .filter((c) => c.seed != null)
    .sort((a, b) => a.seed! - b.seed!);
  const unseeded = competitors.filter((c) => c.seed == null);
  const ranked = [...seeded, ...(rng ? shuffle(unseeded, rng) : unseeded)];

  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  ranked.forEach((c, idx) => {
    const row = Math.floor(idx / numGroups);
    const col = idx % numGroups;
    // serpentina: linhas ímpares invertem a ordem
    const g = row % 2 === 0 ? col : numGroups - 1 - col;
    groups[g].push(c.id);
  });

  const letters = "ABCDEFGH";
  // As letras também são sorteadas. Quando o número de duplas não divide igual,
  // a serpentina sempre deixa a sobra nos mesmos baldes — sem isto, o grupo
  // maior cairia sempre na mesma letra e o cabeça 1 sempre no grupo A.
  const order = groups.map((_, i) => i);
  const drawn = rng ? shuffle(order, rng) : order;
  return drawn.map((gi, i) => ({
    groupId: letters[i],
    competitorIds: groups[gi],
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

// ---------- Estrutura do mata-mata (previsão, antes dos grupos terminarem) ----------

/** "2º do Grupo B" — posição prevista, usada enquanto não se sabe quem classifica. */
export function groupSlotLabel(rank: number, groupId: string) {
  return `${rank}º do Grupo ${groupId}`;
}

/**
 * Preenche as vagas ainda vazias com "Vencedor <Fase> N", seguindo as ligações
 * de avanço. Assim a chave inteira fica legível desde antes do primeiro jogo.
 */
function fillFeederLabels(matches: GenMatch[]): GenMatch[] {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  const ordered = [...matches].sort(
    (a, b) => a.round - b.round || a.indexInRound - b.indexInRound
  );
  const indexInPhase = new Map<string, number>();
  const perPhase = new Map<Phase, number>();
  for (const m of ordered) {
    const n = (perPhase.get(m.phase) ?? 0) + 1;
    perPhase.set(m.phase, n);
    indexInPhase.set(m.key, n);
  }

  // "Quartas de final" fica longo demais dentro de uma célula de confronto.
  const SHORT: Partial<Record<Phase, string>> = { quartas: "Quartas", oitavas: "Oitavas" };

  for (const m of ordered) {
    if (!m.nextKey || !m.nextSlot) continue;
    const nxt = byKey.get(m.nextKey);
    if (!nxt) continue;
    // Fase com um único jogo não precisa de número ("Vencedor da Semifinal").
    const solo = (perPhase.get(m.phase) ?? 0) === 1;
    const name = SHORT[m.phase] ?? PHASE_LABEL[m.phase];
    const label = `Vencedor ${name}${solo ? "" : ` ${indexInPhase.get(m.key)}`}`;
    if (m.nextSlot === "A" && !nxt.competitorA && !nxt.labelA) nxt.labelA = label;
    if (m.nextSlot === "B" && !nxt.competitorB && !nxt.labelB) nxt.labelB = label;
  }
  return matches;
}

/**
 * Chave padrão montada só com posições ("1º do Grupo A × 2º do Grupo B").
 * Os competidores reais entram depois, quando os grupos terminam.
 */
export function generateStructuredKO(
  groupIds: string[],
  qualifiersPerGroup: number
): GenMatch[] {
  if (qualifiersPerGroup === 2) {
    const paired = pairedQualifierBracket(groupIds);
    if (paired) return fillFeederLabels(paired);
  }

  const pseudo: SeedInput[] = [];
  // Ordem de semeadura: todos os 1ºs, depois todos os 2ºs, etc.
  for (let rank = 1; rank <= qualifiersPerGroup; rank++)
    for (const g of groupIds)
      pseudo.push({ id: groupSlotLabel(rank, g), seed: pseudo.length + 1 });
  if (pseudo.length < 2) return [];

  const gen = generateKnockout(pseudo); // sem rng: semeadura determinística
  for (const m of gen) {
    m.labelA = m.competitorA;
    m.labelB = m.competitorB;
    m.competitorA = undefined;
    m.competitorB = undefined;
  }
  return fillFeederLabels(avoidSameGroupOpeners(gen, groupIds));
}

/**
 * Monta a árvore a partir dos confrontos da 1ª rodada. Um par com apenas um
 * lado é bye: o confronto some e o classificado sobe direto para a rodada
 * seguinte.
 */
function bracketFromFirstRound(pairs: [string, string | null][]): GenMatch[] {
  const size = pairs.length * 2;
  const totalRounds = Math.log2(size);
  const matches: GenMatch[] = [];
  const byKey = new Map<string, GenMatch>();

  for (let r = 0; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) {
      const m: GenMatch = {
        key: `r${r}-${i}`,
        phase: phaseForCount(count),
        round: r,
        indexInRound: i,
      };
      if (r < totalRounds - 1) {
        m.nextKey = `r${r + 1}-${Math.floor(i / 2)}`;
        m.nextSlot = i % 2 === 0 ? "A" : "B";
      }
      matches.push(m);
      byKey.set(m.key, m);
    }
  }

  const dropped = new Set<string>();
  matches
    .filter((m) => m.round === 0)
    .forEach((m, i) => {
      const [a, b] = pairs[i];
      if (b) {
        m.labelA = a;
        m.labelB = b;
        return;
      }
      // Bye: promove o classificado e descarta o confronto vazio.
      const nxt = m.nextKey ? byKey.get(m.nextKey) : undefined;
      if (nxt) {
        if (m.nextSlot === "A") nxt.labelA = a;
        else nxt.labelB = a;
      }
      dropped.add(m.key);
    });

  return matches.filter((m) => !dropped.has(m.key));
}

/**
 * Chave dos 2 primeiros de cada grupo, no padrão das federações: o 1º e o 2º de
 * um mesmo grupo caem em metades opostas, então só podem se reencontrar na
 * final — nunca na estreia nem na semi.
 *
 * A separação sai de uma regra simples: o 1º do grupo i vai para a metade i%2 e
 * o 2º para a outra. Como nenhuma metade recebe os dois colocados do mesmo
 * grupo, qualquer pareamento lá dentro já é válido.
 */
function pairedQualifierBracket(groupIds: string[]): GenMatch[] | null {
  const k = groupIds.length;
  if (k < 2) return null;
  const size = nextPow2(2 * k);
  if (size > 16) return null; // além de oitavas, cai na semeadura padrão
  const perHalf = size / 2;

  const halves: string[][] = [[], []];
  groupIds.forEach((g, i) => {
    halves[i % 2].push(groupSlotLabel(1, g));
    halves[(i + 1) % 2].push(groupSlotLabel(2, g));
  });

  const pairs: [string, string | null][] = [];
  const slotsPerHalf = perHalf / 2;
  // Ordem de semeadura dentro da metade: quem vem primeiro fica o mais longe
  // possível dos outros favoritos, para os byes não se encostarem.
  const seatOrder = seedOrder(slotsPerHalf);
  const seatOf = (rank: number) => seatOrder.indexOf(rank + 1);

  for (const half of halves) {
    const isWinner = (l: string) => l.startsWith("1º");
    // Os 1ºs colocados na frente: as vagas que sobrarem viram bye para eles.
    const ranked = [...half.filter(isWinner), ...half.filter((l) => !isWinner(l))];
    const seats: [string, string | null][] = ranked
      .slice(0, perHalf - half.length)
      .map((l) => [l, null]);

    // Cada 1º restante estreia contra um 2º; o que sobrar se pareia entre si.
    const left = ranked.slice(perHalf - half.length);
    const winners = left.filter(isWinner);
    const runners = left.filter((l) => !isWinner(l));
    while (winners.length && runners.length)
      seats.push([winners.shift()!, runners.shift()!]);
    const rest = [...winners, ...runners];
    for (let i = 0; i < rest.length; i += 2) seats.push([rest[i], rest[i + 1]]);

    const placed: [string, string | null][] = new Array(slotsPerHalf);
    seats.forEach((s, rank) => (placed[seatOf(rank)] = s));
    pairs.push(...placed);
  }
  return bracketFromFirstRound(pairs);
}

/**
 * Duas duplas do mesmo grupo não podem se enfrentar logo na estreia — elas já
 * jogaram entre si na fase de grupos. Quando a semeadura padrão cria esse
 * confronto, troca-se um dos lados com outro jogo da mesma rodada.
 */
function avoidSameGroupOpeners(matches: GenMatch[], groupIds: string[]): GenMatch[] {
  const groupOf = (label?: string) =>
    groupIds.find((g) => label?.endsWith(`Grupo ${g}`));
  const clash = (m: GenMatch) => {
    const a = groupOf(m.labelA);
    return !!a && a === groupOf(m.labelB);
  };

  const first = matches.filter((m) => m.round === 0 && m.labelA && m.labelB);
  for (const m of first) {
    if (!clash(m)) continue;
    // Troca o lado B com o de outro jogo, se isso resolver os dois.
    const partner = first.find((o) => {
      if (o === m || clash(o)) return false;
      const swapped = { ...m, labelB: o.labelB };
      const other = { ...o, labelB: m.labelB };
      return !clash(swapped) && !clash(other);
    });
    if (partner) [m.labelB, partner.labelB] = [partner.labelB, m.labelB];
  }
  return matches;
}

/**
 * Chave com entrada escalonada: o 1º dos grupos MAIORES vai direto à semifinal;
 * o 2º de cada um deles disputa as quartas contra o 1º e o 2º do grupo MENOR.
 * (Usada na M1: grupos de 4 duplas + um grupo de 3.)
 */
export function generateCustomQuarters(
  groups: { groupId: string; size: number }[]
): GenMatch[] {
  const sorted = [...groups].sort(
    (a, b) => a.size - b.size || a.groupId.localeCompare(b.groupId)
  );
  const small = sorted[0];
  const large = sorted.slice(1);
  if (groups.length !== 3 || !small || large.length < 2)
    throw new Error(
      "Esta chave precisa de exatamente 3 grupos: dois maiores e um menor (ex.: 4, 4 e 3)."
    );
  if (small.size >= large[0].size)
    throw new Error(
      "Os grupos têm o mesmo tamanho — use a chave prevista normal, que já cruza os 2 primeiros de cada grupo."
    );
  if (small.size < 2)
    throw new Error("O grupo menor precisa de pelo menos 2 competidores.");

  // O 2º de cada grupo maior entra na METADE OPOSTA à do 1º do seu próprio
  // grupo — assim duas duplas do mesmo grupo só podem se reencontrar na final.
  const out: GenMatch[] = [
    {
      key: "q1",
      phase: "quartas",
      round: 0,
      indexInRound: 0,
      labelA: groupSlotLabel(2, large[1].groupId),
      labelB: groupSlotLabel(1, small.groupId),
      nextKey: "semi1",
      nextSlot: "B",
    },
    {
      key: "q2",
      phase: "quartas",
      round: 0,
      indexInRound: 1,
      labelA: groupSlotLabel(2, large[0].groupId),
      labelB: groupSlotLabel(2, small.groupId),
      nextKey: "semi2",
      nextSlot: "B",
    },
    {
      key: "semi1",
      phase: "semi",
      round: 1,
      indexInRound: 0,
      labelA: groupSlotLabel(1, large[0].groupId),
      nextKey: "final",
      nextSlot: "A",
    },
    {
      key: "semi2",
      phase: "semi",
      round: 1,
      indexInRound: 1,
      labelA: groupSlotLabel(1, large[1].groupId),
      nextKey: "final",
      nextSlot: "B",
    },
    { key: "final", phase: "final", round: 2, indexInRound: 0 },
  ];

  return fillFeederLabels(out);
}
