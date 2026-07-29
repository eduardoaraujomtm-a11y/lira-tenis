import Link from "next/link";
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

function CompetitorRow({ side, live }: { side: SideView; live: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        side.winner ? "font-bold" : "font-medium"
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">
        {side.winner && <span className="text-win">▸</span>}
        <span className="truncate">{side.name}</span>
      </span>
      <span className="flex items-center gap-1 tabular-nums">
        {side.sets.map((s, i) => (
          <span
            key={i}
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-sm ${
              live && i === side.sets.length - 1
                ? "bg-lira-purple text-white"
                : "bg-lira-purple-soft text-lira-purple"
            }`}
          >
            {s.games}
            {s.tb !== undefined && <sup className="text-[9px]">{s.tb}</sup>}
          </span>
        ))}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  showCategory = true,
}: {
  match: MatchView;
  showCategory?: boolean;
}) {
  const live = match.isLive;

  const body = (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
        <span className="truncate">
          {showCategory && (
            <span className="font-semibold text-lira-purple">{match.categoryShort}</span>
          )}
          {showCategory && " · "}
          {match.phaseLabel}
        </span>
        <StatusBadge status={match.status} />
      </div>

      <div className="space-y-1.5">
        <CompetitorRow side={match.a} live={live} />
        <CompetitorRow side={match.b} live={live} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{match.courtName ?? "Quadra a definir"}</span>
        <span>{match.time}</span>
      </div>
    </div>
  );

  return live ? <Link href="/ao-vivo">{body}</Link> : body;
}
