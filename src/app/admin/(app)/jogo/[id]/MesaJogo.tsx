"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { shortName } from "@/lib/tennis";
import {
  applyGame,
  applyTiebreakPoint,
  forceWinner,
  mode,
  startMatch,
  type MatchScore,
} from "@/lib/scoring";
import type { ScoreRule } from "@/lib/types";

interface LoadedMatch {
  id: string;
  phaseLabel: string;
  categoryShort: string;
  courtName?: string;
  status: "agendado" | "ao_vivo" | "finalizado" | "wo";
  sets: MatchScore["sets"];
  live: MatchScore["live"];
  winnerId: string | null;
  competitorA: string | null;
  competitorB: string | null;
  nameA: string;
  nameB: string;
  rule: ScoreRule;
  nextMatchId: string | null;
  nextSlot: "A" | "B" | null;
}

const PHASE_LABEL: Record<string, string> = {
  grupo: "Fase de grupos",
  oitavas: "Oitavas",
  quartas: "Quartas de final",
  semi: "Semifinal",
  final: "Final",
  terceiro: "Disputa de 3º lugar",
};

function nameFrom(c: { athletes?: { position: number; athlete: { name: string } | null }[] } | null) {
  if (!c?.athletes) return "A definir";
  return [...c.athletes]
    .sort((x, y) => x.position - y.position)
    .map((a) => shortName(a.athlete?.name ?? "?"))
    .join(" / ");
}

export function MesaJogo({ matchId }: { matchId: string }) {
  const [supabase] = useState(() => createClient());
  const [match, setMatch] = useState<LoadedMatch | null>(null);
  const [score, setScore] = useState<MatchScore | null>(null);
  const [history, setHistory] = useState<MatchScore[]>([]);
  const [server, setServer] = useState<"A" | "B">("A");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmWO, setConfirmWO] = useState(false);

  // Carrega o jogo
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id,phase,status,sets,live,winner_id,competitor_a,competitor_b,next_match_id,next_slot,category:categories(short_name,rule),court:courts(name),a:competitors!matches_competitor_a_fkey(athletes:competitor_athletes(position,athlete:athletes(name))),b:competitors!matches_competitor_b_fkey(athletes:competitor_athletes(position,athlete:athletes(name)))"
        )
        .eq("id", matchId)
        .single();
      if (error || !data) {
        setError("Não foi possível carregar o jogo.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      const loaded: LoadedMatch = {
        id: d.id,
        phaseLabel: PHASE_LABEL[d.phase] ?? d.phase,
        categoryShort: d.category?.short_name ?? "",
        courtName: d.court?.name,
        status: d.status,
        sets: d.sets ?? [],
        live: d.live ?? null,
        winnerId: d.winner_id,
        competitorA: d.competitor_a,
        competitorB: d.competitor_b,
        nameA: nameFrom(d.a),
        nameB: nameFrom(d.b),
        rule: d.category?.rule as ScoreRule,
        nextMatchId: d.next_match_id,
        nextSlot: d.next_slot,
      };
      setMatch(loaded);
      if (d.status === "ao_vivo" || d.status === "finalizado" || d.status === "wo") {
        setScore({
          sets: loaded.sets,
          live: loaded.live,
          status: d.status === "ao_vivo" ? "ao_vivo" : "finalizado",
          winner:
            d.winner_id === loaded.competitorA
              ? "A"
              : d.winner_id === loaded.competitorB
              ? "B"
              : undefined,
        });
      }
    })();
  }, [supabase, matchId]);

  const persist = useCallback(
    async (next: MatchScore) => {
      if (!match) return;
      setSaving(true);
      setError(null);
      const winnerComp =
        next.winner === "A"
          ? match.competitorA
          : next.winner === "B"
          ? match.competitorB
          : null;
      const { error } = await supabase
        .from("matches")
        .update({
          sets: next.sets,
          live: next.live,
          status: next.status,
          winner_id: winnerComp,
        })
        .eq("id", match.id);
      if (error) {
        setError("Erro ao salvar. Verifique a conexão.");
        setSaving(false);
        return;
      }
      // Avança o vencedor na chave
      if (next.status === "finalizado" && winnerComp && match.nextMatchId && match.nextSlot) {
        const col = match.nextSlot === "A" ? "competitor_a" : "competitor_b";
        await supabase.from("matches").update({ [col]: winnerComp }).eq("id", match.nextMatchId);
      }
      setSaving(false);
    },
    [supabase, match]
  );

  function commit(next: MatchScore) {
    if (score) setHistory((h) => [...h, score]);
    setScore(next);
    persist(next);
  }

  function start() {
    if (!match) return;
    commit(startMatch(match.rule, server));
  }
  function addGame(side: "A" | "B") {
    if (!score || !match) return;
    commit(applyGame(score, side, match.rule));
  }
  function addTb(side: "A" | "B") {
    if (!score || !match) return;
    commit(applyTiebreakPoint(score, side, match.rule));
  }
  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setScore(prev);
    persist(prev);
  }
  function wo(side: "A" | "B") {
    if (!score) return;
    commit(forceWinner(score, side));
    setConfirmWO(false);
  }

  if (error && !match)
    return <p className="text-center text-sm text-live">{error}</p>;
  if (!match) return <p className="text-center text-sm text-muted">Carregando…</p>;

  const started = !!score && match.status !== "agendado";
  const m = score ? mode(score.sets, match.rule) : "game";
  const finished = score?.status === "finalizado";
  const isTb = m === "tiebreak" || m === "super";

  return (
    <div>
      <Link href="/admin" className="mb-3 inline-block text-xs font-semibold text-lira-purple">
        ← Voltar à mesa
      </Link>

      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-lira-purple">{match.categoryShort}</span>
        <span>· {match.phaseLabel}</span>
        <span>· {match.courtName ?? "quadra a definir"}</span>
      </div>

      {/* Placar */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
        <ScoreRow
          name={match.nameA}
          sets={score?.sets ?? match.sets}
          side="a"
          serving={started && !finished && score?.live?.server === "A"}
          winner={score?.winner === "A"}
        />
        <div className="h-px bg-border" />
        <ScoreRow
          name={match.nameB}
          sets={score?.sets ?? match.sets}
          side="b"
          serving={started && !finished && score?.live?.server === "B"}
          winner={score?.winner === "B"}
        />
        {started && !finished && (
          <div className="bg-lira-purple-soft px-3 py-1.5 text-center text-xs font-bold text-lira-purple">
            {m === "game" ? "Contagem por games" : m === "super" ? `Super Tie-break (até ${match.rule.superTiebreakTo})` : `Tie-break (até ${match.rule.tiebreakTo})`}
            {isTb && score?.live && ` — ${score.live.a} x ${score.live.b}`}
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-center text-sm text-live">{error}</p>}

      {/* Controles */}
      {finished ? (
        <div className="rounded-xl border border-win/40 bg-win/10 p-4 text-center">
          <p className="text-sm font-bold text-win">
            🏆 Vencedor: {score?.winner === "A" ? match.nameA : match.nameB}
          </p>
          {match.nextMatchId && (
            <p className="mt-1 text-xs text-muted">Vencedor avançou automaticamente na chave.</p>
          )}
        </div>
      ) : !started ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Iniciar jogo</p>
          <p className="mb-2 text-xs text-muted">Quem saca primeiro?</p>
          <div className="mb-4 flex gap-2">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setServer(s)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  server === s
                    ? "border-lira-purple bg-lira-purple text-white"
                    : "border-border bg-background"
                }`}
              >
                {s === "A" ? match.nameA : match.nameB}
              </button>
            ))}
          </div>
          <button
            onClick={start}
            disabled={saving}
            className="w-full rounded-lg bg-lira-purple py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            ▶ Iniciar jogo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ActionButton
              label={isTb ? "+ Ponto" : "+ Game"}
              sub={match.nameA}
              onClick={() => (isTb ? addTb("A") : addGame("A"))}
              disabled={saving}
            />
            <ActionButton
              label={isTb ? "+ Ponto" : "+ Game"}
              sub={match.nameB}
              onClick={() => (isTb ? addTb("B") : addGame("B"))}
              disabled={saving}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={!history.length || saving}
              className="flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-foreground disabled:opacity-40"
            >
              ↩ Desfazer
            </button>
            {!confirmWO ? (
              <button
                onClick={() => setConfirmWO(true)}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted"
              >
                Encerrar por W.O.
              </button>
            ) : (
              <div className="flex flex-[2] gap-2">
                <button onClick={() => wo("A")} className="flex-1 rounded-lg border border-live/40 bg-live/10 py-2 text-xs font-bold text-live">
                  W.O. → {match.nameA}
                </button>
                <button onClick={() => wo("B")} className="flex-1 rounded-lg border border-live/40 bg-live/10 py-2 text-xs font-bold text-live">
                  W.O. → {match.nameB}
                </button>
                <button onClick={() => setConfirmWO(false)} className="rounded-lg border border-border px-2 text-xs">
                  ✕
                </button>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-muted">
            {saving ? "Salvando…" : "O placar aparece ao vivo no site instantaneamente."}
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreRow({
  name,
  sets,
  side,
  serving,
  winner,
}: {
  name: string;
  sets: MatchScore["sets"];
  side: "a" | "b";
  serving: boolean;
  winner: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-3 ${winner ? "bg-win/5" : ""}`}>
      <span className="flex items-center gap-2 truncate text-sm font-bold">
        {serving && <span className="h-2 w-2 shrink-0 rounded-full bg-lira-yellow" title="Sacando" />}
        {winner && <span className="text-win">▸</span>}
        <span className="truncate">{name}</span>
      </span>
      <span className="flex items-center gap-1 tabular-nums">
        {sets.length === 0 && <span className="text-sm text-muted">—</span>}
        {sets.map((s, i) => {
          const games = side === "a" ? s.a : s.b;
          const tb = side === "a" ? s.tbA : s.tbB;
          const last = i === sets.length - 1;
          return (
            <span
              key={i}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded px-1 text-base font-bold ${
                last ? "bg-lira-purple text-white" : "bg-lira-purple-soft text-lira-purple"
              }`}
            >
              {games}
              {tb !== undefined && <sup className="text-[10px]">{tb}</sup>}
            </span>
          );
        })}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  sub,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-0.5 rounded-2xl bg-lira-purple py-6 text-white shadow-sm transition-transform active:scale-95 disabled:opacity-60"
    >
      <span className="text-lg font-extrabold">{label}</span>
      <span className="max-w-full truncate px-2 text-xs font-medium text-white/80">{sub}</span>
    </button>
  );
}
