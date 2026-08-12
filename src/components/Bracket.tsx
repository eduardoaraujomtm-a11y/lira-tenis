import type { MatchView, SideView } from "@/lib/types";

type BracketGroup = { phase: string; phaseLabel: string; matches: MatchView[] };

function BracketSlot({ side, live }: { side: SideView; live: boolean }) {
  const score = side.sets.map((s) => `${s.games}`).join(" ");
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
        side.winner ? "font-bold text-foreground" : "text-muted"
      }`}
    >
      <span className="flex-1 truncate">{side.name}</span>
      {score && (
        <span className="shrink-0 text-right font-semibold tabular-nums text-accent">
          {score}
        </span>
      )}
      {live && <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-live" />}
    </div>
  );
}

function BracketMatch({ match }: { match: MatchView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <BracketSlot side={match.a} live={match.isLive} />
      <div className="h-px bg-border" />
      <BracketSlot side={match.b} live={match.isLive} />
    </div>
  );
}

export function Bracket({ groups }: { groups: BracketGroup[] }) {
  if (!groups.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
        Chave do mata-mata ainda não definida.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {groups.map((g) => (
          <div key={g.phase} className="flex w-44 flex-col justify-around gap-4">
            <h4 className="text-center text-[11px] font-bold uppercase tracking-wide text-accent">
              {g.phaseLabel}
            </h4>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {g.matches.map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
