import type { Competitor, Match, SetScore } from "./types";

/** Nome de exibição de um competidor (simples ou dupla). */
export function competitorName(c?: Competitor): string {
  if (!c) return "A definir";
  return c.athletes.map((a) => shortName(a.name)).join(" / ");
}

/** "João Silva Costa" -> "J. Silva" para caber em telas pequenas. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/** Sets vencidos por cada lado, considerando tie-break. */
export function setsWon(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

/** Placar resumido, ex: "6-4 3-6 10-7". Tie-break vira sobrescrito simples. */
export function scoreLine(sets: SetScore[]): string {
  if (!sets.length) return "";
  return sets
    .map((s) => {
      const tb =
        s.tbA !== undefined && s.tbB !== undefined
          ? `(${Math.min(s.tbA, s.tbB)})`
          : "";
      return `${s.a}-${s.b}${tb}`;
    })
    .join("  ");
}

export const STATUS_LABEL: Record<Match["status"], string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  finalizado: "Finalizado",
  wo: "W.O.",
};

export const PHASE_LABEL: Record<Match["phase"], string> = {
  grupo: "Fase de grupos",
  oitavas: "Oitavas",
  quartas: "Quartas de final",
  semi: "Semifinal",
  final: "Final",
  terceiro: "Disputa de 3º lugar",
};

/** Formata data ISO (YYYY-MM-DD) para "Seg, 03/08". */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];
  return `${wd}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
