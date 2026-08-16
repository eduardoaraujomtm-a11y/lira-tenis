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
  status: "agendado" | "ao_vivo" | "finalizado" | "wo" | "desistencia";
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

/** Um set em edição. Texto, não número, para o campo poder ficar vazio enquanto se digita. */
interface DraftSet {
  a: string;
  b: string;
  tbA: string;
  tbB: string;
}

/** Quem venceu, contando os sets. `undefined` quando está empatado. */
function winnerBySets(sets: MatchScore["sets"]): "A" | "B" | undefined {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return a === b ? undefined : a > b ? "A" : "B";
}

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
  const [confirmDesist, setConfirmDesist] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftSet[]>([]);
  const [draftWinner, setDraftWinner] = useState<"auto" | "A" | "B">("auto");

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
      if (d.status === "ao_vivo" || d.status === "finalizado" || d.status === "wo" || d.status === "desistencia") {
        setScore({
          sets: loaded.sets,
          live: loaded.live,
          status: d.status === "ao_vivo" ? "ao_vivo" : d.status === "desistencia" ? "desistencia" : "finalizado",
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
      if ((next.status === "finalizado" || next.status === "desistencia") && winnerComp && match.nextMatchId && match.nextSlot) {
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
  function desist(quitter: "A" | "B") {
    if (!score) return;
    const winner = quitter === "A" ? "B" : "A";
    commit({ ...score, status: "desistencia", winner });
    setConfirmDesist(false);
  }

  const compOf = (s: "A" | "B" | undefined) =>
    s === "A" ? match?.competitorA ?? null : s === "B" ? match?.competitorB ?? null : null;

  // O vencedor gravado no banco pode estar defasado quando o jogo foi encerrado
  // agora mesmo, nesta sessão — o placar em memória é a fonte mais atual.
  const currentWinnerId = compOf(score?.winner) ?? match?.winnerId ?? null;

  /**
   * Ajusta a vaga deste jogo no confronto seguinte. Sem isto, fechar a mesa ou
   * trocar o vencedor deixaria a dupla antiga presa na próxima rodada.
   */
  async function syncAdvance(previous: string | null, next: string | null) {
    if (!match?.nextMatchId || !match.nextSlot || previous === next) return;
    const col = match.nextSlot === "A" ? "competitor_a" : "competitor_b";
    let q = supabase.from("matches").update({ [col]: next }).eq("id", match.nextMatchId);
    // Só mexe se a vaga ainda for de quem saiu daqui.
    if (previous) q = q.eq(col, previous);
    await q;
  }

  /** Jogo aberto por engano: volta para "agendado" e limpa o placar. */
  async function closeTable() {
    if (!match) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("matches")
      .update({ sets: [], live: null, status: "agendado", winner_id: null })
      .eq("id", match.id);
    if (error) {
      setError("Não foi possível fechar a mesa.");
      setSaving(false);
      return;
    }
    await syncAdvance(currentWinnerId, null);
    setMatch({ ...match, status: "agendado", sets: [], live: null, winnerId: null });
    setScore(null);
    setHistory([]);
    setConfirmClose(false);
    setSaving(false);
  }

  function openEditor() {
    const sets = score?.sets ?? match?.sets ?? [];
    setDraft(
      sets.map((s) => ({
        a: String(s.a),
        b: String(s.b),
        tbA: s.tbA !== undefined ? String(s.tbA) : "",
        tbB: s.tbB !== undefined ? String(s.tbB) : "",
      }))
    );
    setDraftWinner("auto");
    setEditing(true);
  }

  const draftSets: MatchScore["sets"] = draft.map((d) => {
    const tbA = d.tbA.trim() === "" ? undefined : Number(d.tbA);
    const tbB = d.tbB.trim() === "" ? undefined : Number(d.tbB);
    return {
      a: Number(d.a || 0),
      b: Number(d.b || 0),
      ...(tbA !== undefined && tbB !== undefined ? { tbA, tbB } : {}),
    };
  });
  const draftAuto = winnerBySets(draftSets);
  const effectiveWinner = draftWinner === "auto" ? draftAuto : draftWinner;

  /** Grava o placar corrigido e reposiciona o vencedor na chave. */
  async function saveEdit() {
    if (!match) return;
    if (draft.some((d) => d.a.trim() === "" || d.b.trim() === "")) {
      setError("Preencha os games dos dois lados em cada set.");
      return;
    }
    if (!effectiveWinner) {
      setError("Os sets estão empatados — escolha o vencedor.");
      return;
    }
    const previous = currentWinnerId;
    const winnerComp = compOf(effectiveWinner);
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("matches")
      .update({
        sets: draftSets,
        live: null,
        status: "finalizado",
        winner_id: winnerComp,
      })
      .eq("id", match.id);
    if (error) {
      setError("Não foi possível salvar a correção.");
      setSaving(false);
      return;
    }
    await syncAdvance(previous, winnerComp);
    setMatch({ ...match, status: "finalizado", sets: draftSets, winnerId: winnerComp });
    setScore({ sets: draftSets, live: null, status: "finalizado", winner: effectiveWinner });
    setHistory([]);
    setEditing(false);
    setSaving(false);
  }

  if (error && !match)
    return <p className="text-center text-sm text-live">{error}</p>;
  if (!match) return <p className="text-center text-sm text-muted">Carregando…</p>;

  // "started" vem do score em memória (que é o que start() atualiza),
  // não do match.status carregado só uma vez. Assim, os controles aparecem
  // imediatamente após clicar em "Iniciar jogo" — sem precisar recarregar.
  const started = !!score;
  const m = score ? mode(score.sets, match.rule) : "game";
  const finished = score?.status === "finalizado" || score?.status === "desistencia";
  const isTb = m === "tiebreak" || m === "super";

  return (
    <div>
      <Link href="/admin" className="mb-3 inline-block text-xs font-semibold text-accent">
        ← Voltar à mesa
      </Link>

      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-accent">{match.categoryShort}</span>
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
          <div className="bg-lira-purple-soft px-3 py-1.5 text-center text-xs font-bold text-accent">
            {m === "game" ? "Contagem por games" : m === "super" ? `Super Tie-break (até ${match.rule.superTiebreakTo})` : `Tie-break (até ${match.rule.tiebreakTo})`}
            {isTb && score?.live && ` — ${score.live.a} x ${score.live.b}`}
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-center text-sm text-live">{error}</p>}

      {/* Controles */}
      {finished ? (
        editing ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-sm font-bold">Corrigir resultado</p>
            <div className="mb-2 space-y-2">
              {draft.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-semibold text-muted">
                    Set {i + 1}
                  </span>
                  <NumBox
                    value={d.a}
                    onChange={(v) => setDraft((s) => s.map((x, j) => (j === i ? { ...x, a: v } : x)))}
                    label={match.nameA}
                  />
                  <span className="text-xs text-muted">×</span>
                  <NumBox
                    value={d.b}
                    onChange={(v) => setDraft((s) => s.map((x, j) => (j === i ? { ...x, b: v } : x)))}
                    label={match.nameB}
                  />
                  <span className="ml-1 text-[11px] text-muted">tie-break</span>
                  <NumBox
                    value={d.tbA}
                    onChange={(v) => setDraft((s) => s.map((x, j) => (j === i ? { ...x, tbA: v } : x)))}
                    label={`Tie-break ${match.nameA}`}
                    muted
                  />
                  <NumBox
                    value={d.tbB}
                    onChange={(v) => setDraft((s) => s.map((x, j) => (j === i ? { ...x, tbB: v } : x)))}
                    label={`Tie-break ${match.nameB}`}
                    muted
                  />
                  <button
                    onClick={() => setDraft((s) => s.filter((_, j) => j !== i))}
                    aria-label={`Remover set ${i + 1}`}
                    className="ml-auto rounded border border-border px-2 text-xs text-muted"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDraft((s) => [...s, { a: "", b: "", tbA: "", tbB: "" }])}
              className="mb-3 text-xs font-semibold text-accent underline"
            >
              + adicionar set
            </button>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-muted">Vencedor</label>
              <select
                value={draftWinner}
                onChange={(e) => setDraftWinner(e.target.value as "auto" | "A" | "B")}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="auto">
                  Pelos sets
                  {draftAuto
                    ? ` — ${draftAuto === "A" ? match.nameA : match.nameB}`
                    : " — empatado, escolha abaixo"}
                </option>
                <option value="A">{match.nameA}</option>
                <option value="B">{match.nameB}</option>
              </select>
              <p className="mt-1 text-[11px] text-muted">
                Deixe os campos de tie-break em branco nos sets que não tiveram.
                Trocar o vencedor também troca quem passou para a próxima rodada.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-lg bg-lira-purple py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar correção"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl border border-win/40 bg-win/10 p-4 text-center">
              <p className="text-sm font-bold text-win">
                🏆 Vencedor: {score?.winner === "A" ? match.nameA : match.nameB}
              </p>
              {match.nextMatchId && (
                <p className="mt-1 text-xs text-muted">Vencedor avançou automaticamente na chave.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={openEditor}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-foreground"
              >
                ✏️ Corrigir resultado
              </button>
              {!confirmClose ? (
                <button
                  onClick={() => setConfirmClose(true)}
                  className="flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted"
                >
                  Reabrir jogo
                </button>
              ) : (
                <div className="flex flex-1 gap-2">
                  <button
                    onClick={closeTable}
                    disabled={saving}
                    className="flex-1 rounded-lg border border-live/40 bg-live/10 py-2 text-xs font-bold text-live disabled:opacity-60"
                  >
                    Apagar placar e reabrir
                  </button>
                  <button
                    onClick={() => setConfirmClose(false)}
                    className="rounded-lg border border-border px-2 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        )
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
                onClick={() => { setConfirmWO(true); setConfirmDesist(false); }}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted"
              >
                W.O.
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
          {!confirmDesist ? (
            <button
              onClick={() => { setConfirmDesist(true); setConfirmWO(false); }}
              className="w-full rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted"
            >
              Desistência
            </button>
          ) : (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2">
              <p className="mb-2 text-center text-xs text-orange-400">
                Quem desistiu? O placar parcial será mantido e o adversário vence.
              </p>
              <div className="flex gap-2">
                <button onClick={() => desist("A")} className="flex-1 rounded-lg border border-orange-500/40 py-2 text-xs font-bold text-orange-400">
                  {match.nameA} desistiu
                </button>
                <button onClick={() => desist("B")} className="flex-1 rounded-lg border border-orange-500/40 py-2 text-xs font-bold text-orange-400">
                  {match.nameB} desistiu
                </button>
                <button onClick={() => setConfirmDesist(false)} className="rounded-lg border border-border px-2 text-xs">
                  ✕
                </button>
              </div>
            </div>
          )}
          {!confirmClose ? (
            <button
              onClick={() => setConfirmClose(true)}
              className="w-full rounded-lg border border-border bg-card py-2 text-xs font-semibold text-muted"
            >
              Fechar mesa (abri por engano)
            </button>
          ) : (
            <div className="rounded-lg border border-live/40 bg-live/10 p-2">
              <p className="mb-2 text-center text-xs text-live">
                Apaga o placar e devolve o jogo para “agendado”. Se a rodada
                seguinte já tiver começado, confira a chave depois.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={closeTable}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-live/40 py-2 text-xs font-bold text-live disabled:opacity-60"
                >
                  Fechar mesa
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="rounded-lg border border-border px-3 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
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
      <span className="flex items-center gap-2 truncate text-base font-bold">
        {serving && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lira-yellow" title="Sacando" />}
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
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded px-1 text-lg font-bold ${
                last ? "bg-lira-yellow text-lira-purple-dark" : "bg-lira-purple-soft text-accent"
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

/** Campo numérico curto usado na correção do placar. */
function NumBox({
  value,
  onChange,
  label,
  muted,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  muted?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
      inputMode="numeric"
      aria-label={label}
      className={`w-11 rounded-lg border border-border px-2 py-1.5 text-center text-sm tabular-nums ${
        muted ? "bg-background text-muted" : "bg-background font-bold"
      }`}
    />
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
