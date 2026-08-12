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
