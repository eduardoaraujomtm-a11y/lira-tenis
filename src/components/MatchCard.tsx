import Link from "next/link";
import { formatDay } from "@/lib/tennis";
import type { MatchView, SideView } from "@/lib/types";

function StatusBadge({ status }: { status: MatchView["status"] }) {
  if (status === "ao_vivo") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-live/10 px-2 py-0.5 text-[11px] font-bold text-live">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
        AO VIVO
      </span>
    );
  }
  if (status === "finalizado")
    return <span className="text-[11px] font-semibold text-muted">Encerrado</span>;
  if (status === "wo")
    return <span className="text-[11px] font-semibold text-muted">W.O.</span>;
  return <span className="text-[11px] font-semibold text-muted">Agendado</span>;
}

function CompetitorRow({
  side,
  live,
  decided,
  wonSets,
}: {
  side: SideView;
  live: boolean;
  /** Jogo encerrado: só aí vale apagar o perdedor e realçar o vencedor. */
  decided: boolean;
  /** Quem levou cada set. O verde marca o set, não a partida — senão um set
   *  perdido pelo vencedor apareceria como se tivesse sido ganho. */
  wonSets: boolean[];
}) {
  const won = decided && side.winner;
  const lost = decided && !side.winner;

  return (
    <div
      className={`flex items-center justify-between gap-2 text-[15px] leading-6 ${
        won ? "font-bold" : lost ? "font-medium text-muted" : "font-medium"
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">
        {won && <span className="text-win">▸</span>}
        <span className="truncate">{side.name}</span>
      </span>
      <span className="flex items-center gap-1 tabular-nums">
        {side.sets.map((s, i) => {
          const emAndamento = live && i === side.sets.length - 1;
          return (
            <span
              key={i}
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-sm font-bold ${
                emAndamento
                  ? "bg-lira-yellow text-lira-purple-dark"
                  : wonSets[i]
                  ? "bg-accent/30 text-foreground font-semibold"
                  : decided || live
                  ? "bg-transparent text-muted"
                  : "bg-lira-purple-soft text-accent"
              }`}
            >
              {s.games}
              {s.tb !== undefined && <sup className="text-[9px]">{s.tb}</sup>}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  showCategory = true,
  showDay = false,
}: {
  match: MatchView;
  showCategory?: boolean;
  /** Fora da agenda não existe cabeçalho de dia, então a data vem no card. */
  showDay?: boolean;
}) {
  const live = match.isLive;
  const decided = match.status === "finalizado" || match.status === "wo";

  // Comparação set a set: cada lado precisa saber os games do outro.
  const setsA = match.a.sets.map((s, i) => s.games > (match.b.sets[i]?.games ?? 0));
  const setsB = match.b.sets.map((s, i) => s.games > (match.a.sets[i]?.games ?? 0));

  const body = (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm transition-shadow hover:shadow-md">
      {/* Horário, categoria, fase e quadra cabem todos nesta linha — assim o
          card perde uma linha inteira e a lista encurta bastante. */}
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className="shrink-0 font-bold tabular-nums text-foreground">
          {showDay && match.day ? `${formatDay(match.day)} · ` : ""}
          {match.time}
        </span>
        <span className="truncate">
          {showCategory && (
            <span className="font-semibold text-accent">{match.categoryShort}</span>
          )}
          {showCategory && " · "}
          {match.phaseLabel}
          {/* "Quadra a definir" não informa nada — só aparece quando há quadra. */}
          {match.courtName && ` · ${match.courtName}`}
        </span>
        <span className="ml-auto shrink-0">
          <StatusBadge status={match.status} />
        </span>
      </div>

      <div className="space-y-0.5">
        <CompetitorRow side={match.a} live={live} decided={decided} wonSets={setsA} />
        <CompetitorRow side={match.b} live={live} decided={decided} wonSets={setsB} />
      </div>
    </div>
  );

  return live ? <Link href="/ao-vivo">{body}</Link> : body;
}
