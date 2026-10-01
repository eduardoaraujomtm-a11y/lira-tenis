import type { MatchView, SideView } from "@/lib/types";

type BracketGroup = {
  phase: string;
  phaseLabel: string;
  capacity: number;
  slots: (MatchView | null)[];
};

// Geometria da chave (px).
const UNIT = 78; // altura de uma vaga da rodada de entrada; as seguintes dobram
const COL_W = 176; // largura da coluna de uma rodada
const GUTTER = 48; // espaço entre rodadas, onde correm as linhas de ligação

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

  const maxCap = Math.max(...groups.map((g) => g.capacity));
  const bodyHeight = maxCap * UNIT;
  const totalWidth = groups.length * COL_W + (groups.length - 1) * GUTTER;

  // Posição (coluna + centro vertical) de cada confronto, para ligar as linhas.
  const posById = new Map<string, { ci: number; cy: number }>();
  groups.forEach((g, ci) => {
    const bandH = bodyHeight / g.capacity;
    g.slots.forEach((m, i) => {
      if (m) posById.set(m.id, { ci, cy: (i + 0.5) * bandH });
    });
  });

  // Uma ligação por confronto que avança: cotovelo do jogo até o pai.
  const links: { d: string }[] = [];
  groups.forEach((g, ci) => {
    const bandH = bodyHeight / g.capacity;
    g.slots.forEach((m, i) => {
      if (!m || !m.nextMatchId) return;
      const parent = posById.get(m.nextMatchId);
      if (!parent) return;
      const cy = (i + 0.5) * bandH;
      const childX = ci * (COL_W + GUTTER) + COL_W;
      const parentX = parent.ci * (COL_W + GUTTER);
      const midX = (childX + parentX) / 2;
      links.push({ d: `M${childX},${cy} H${midX} V${parent.cy} H${parentX}` });
    });
  });

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: totalWidth }}>
        {/* Cabeçalhos das rodadas */}
        <div className="mb-2 flex" style={{ gap: GUTTER }}>
          {groups.map((g) => (
            <h4
              key={g.phase}
              style={{ width: COL_W }}
              className="text-center text-[11px] font-bold uppercase tracking-wide text-accent"
            >
              {g.phaseLabel}
            </h4>
          ))}
        </div>

        {/* Corpo: SVG das ligações atrás + colunas de confrontos à frente */}
        <div className="relative" style={{ width: totalWidth, height: bodyHeight }}>
          <svg
            className="absolute inset-0 text-border"
            width={totalWidth}
            height={bodyHeight}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            {links.map((l, i) => (
              <path key={i} d={l.d} />
            ))}
          </svg>

          <div className="relative flex" style={{ gap: GUTTER }}>
            {groups.map((g) => (
              <div
                key={g.phase}
                className="flex flex-col"
                style={{ width: COL_W, height: bodyHeight }}
              >
                {g.slots.map((m, i) => (
                  <div key={m?.id ?? `empty-${i}`} className="flex flex-1 items-center">
                    {m && (
                      <div className="w-full">
                        <BracketMatch match={m} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
