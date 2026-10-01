// Ordenação da árvore do mata-mata (puro, usável no servidor e no cliente).

export interface BracketNode {
  id: string;
  phase: string;
  nextMatchId?: string;
  nextSlot?: "A" | "B";
}

/**
 * Posição vertical de cada confronto, derivada do encadeamento next_match/next_slot.
 * A final = 0; cada alimentador fica em 2*pos (slot A, em cima) ou 2*pos+1
 * (slot B, embaixo). Ordenar cada fase por essa posição faz a chave desenhar
 * como árvore (o vencedor de cima flui para cima).
 */
/** Ordem das fases do mata-mata, da entrada à final. */
export const KNOCKOUT_ORDER = ["preliminar", "oitavas", "quartas", "semi", "final", "terceiro"] as const;

/** Vagas de cada rodada cheia — usado para alinhar a árvore mesmo com byes. */
export const PHASE_CAPACITY: Record<string, number> = {
  preliminar: 16, oitavas: 8, quartas: 4, semi: 2, final: 1, terceiro: 1,
};

/**
 * Agrupa os confrontos por fase e os distribui em `slots` do tamanho da rodada
 * cheia, cada um na posição derivada da árvore. Vagas de bye ficam `null` — é o
 * que mantém cada jogo alinhado ao confronto que ele alimenta.
 */
export function bracketSlots<T extends BracketNode>(
  matches: T[]
): { phase: string; capacity: number; slots: (T | null)[] }[] {
  const pos = bracketPositions(matches);
  return KNOCKOUT_ORDER.map((phase) => {
    const ms = matches.filter((m) => m.phase === phase);
    if (!ms.length) return null;
    const capacity = PHASE_CAPACITY[phase] ?? ms.length;
    const slots: (T | null)[] = Array.from({ length: capacity }, () => null);
    for (const m of ms) {
      const p = pos.get(m.id) ?? 0;
      if (p >= 0 && p < capacity && slots[p] === null) slots[p] = m;
      else slots.push(m);
    }
    return { phase: phase as string, capacity, slots };
  }).filter((g): g is { phase: string; capacity: number; slots: (T | null)[] } => g !== null);
}

export function bracketPositions<T extends BracketNode>(matches: T[]): Map<string, number> {
  const pos = new Map<string, number>();
  const finals = matches.filter((m) => !m.nextMatchId && m.phase !== "terceiro");
  finals.forEach((f, i) => pos.set(f.id, i));
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of matches) {
      if (m.nextMatchId && pos.has(m.nextMatchId) && !pos.has(m.id)) {
        const base = pos.get(m.nextMatchId)!;
        pos.set(m.id, m.nextSlot === "B" ? base * 2 + 1 : base * 2);
        changed = true;
      }
    }
  }
  return pos;
}
