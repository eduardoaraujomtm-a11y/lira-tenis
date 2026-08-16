"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortName, formatDay, PHASE_LABEL } from "@/lib/tennis";
import type { Phase } from "@/lib/types";
import { autoSchedule, DEFAULT_SLOTS, slotsOn, type SlotPlan } from "@/lib/schedule";
import type { Format } from "@/lib/types";

interface Row {
  id: string;
  categoryShort: string;
  phase: Phase;
  groupId: string | null;
  status: string;
  day: string;
  time: string;
  courtId: string | null;
  aId: string | null;
  bId: string | null;
  nameA: string;
  nameB: string;
  format: Format;
}
interface Court {
  id: string;
  name: string;
}

/** Lê horários digitados soltos ("18h, 20:00" / uma por linha) e normaliza. */
function parseTimes(text: string): string[] {
  const found = text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
    .map((s) => {
      const [h, m] = s.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    });
  return Array.from(new Set(found)).sort();
}

/** Agrupa dias seguidos que têm exatamente os mesmos horários. */
function groupDaysByTimes(days: string[], timesOf: (d: string) => string[]) {
  const out: { days: string[]; times: string[] }[] = [];
  for (const d of days) {
    const times = timesOf(d);
    const last = out[out.length - 1];
    if (last && last.times.join() === times.join()) last.days.push(d);
    else out.push({ days: [d], times });
  }
  return out;
}

export function AgendaEditor() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, string[]>>({});
  const [draftByDay, setDraftByDay] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkDraft, setBulkDraft] = useState("");
  const [editSlots, setEditSlots] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [day, setDay] = useState("all");

  const [catOrder, setCatOrder] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    const [compRes, matchRes, courtRes, tourRes, catRes] = await Promise.all([
      supabase.from("competitors").select("id,athletes:competitor_athletes(position,athlete:athletes(name))"),
      supabase
        .from("matches")
        .select("id,phase,group_id,status,day,time,court_id,competitor_a,competitor_b,label_a,label_b,category:categories(short_name,format,tournament_id)")
        .order("day")
        .order("time"),
      supabase.from("courts").select("id,name").order("name"),
      supabase.from("tournaments").select("id,days").limit(1).single(),
      supabase.from("categories").select("short_name,sort_order").order("sort_order"),
    ]);
    setCatOrder(
      new Map(
        ((catRes.data as { short_name: string; sort_order: number }[]) ?? []).map(
          (c) => [c.short_name, c.sort_order]
        )
      )
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comps = (compRes.data as any[]) ?? [];
    const nameById = new Map<string, string>(
      comps.map((c) => [
        c.id,
        (c.athletes ?? [])
          .slice()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((x: any, y: any) => x.position - y.position)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((a: any) => shortName(a.athlete?.name ?? "?"))
          .join(" / ") || "—",
      ])
    );
    // Sem competidor definido, mostra a previsão gravada ("2º do Grupo B").
    const nameOf = (id: string | null, label?: string | null) =>
      id ? nameById.get(id) ?? "?" : label || "A definir";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tour = tourRes.data as any;
    const activeTid = (tour?.id as string) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ms = ((matchRes.data as any[]) ?? [])
      .filter((m) => !activeTid || m.category?.tournament_id === activeTid)
      .map((m) => ({
        id: m.id,
        categoryShort: m.category?.short_name ?? "",
        phase: m.phase as Phase,
        groupId: m.group_id,
        status: m.status,
        day: m.day,
        time: m.time,
        courtId: m.court_id,
        aId: m.competitor_a,
        bId: m.competitor_b,
        nameA: nameOf(m.competitor_a, m.label_a),
        nameB: nameOf(m.competitor_b, m.label_b),
        format: (m.category?.format ?? "grupos_mata_mata") as Format,
      }));
    setRows(ms);
    setCourts((courtRes.data as Court[]) ?? []);
    setDays((tour?.days as string[]) ?? []);
    setTournamentId(activeTid);
    // Slots vêm em query separada: se a migração ainda não foi aplicada, cai
    // silenciosamente no DEFAULT_SLOTS sem quebrar o carregamento dos dias.
    if (activeTid) {
      const { data: slotsRow, error: slotsErr } = await supabase
        .from("tournaments")
        .select("slots,slots_by_day")
        .eq("id", activeTid)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = slotsRow as any;
      const s = (row?.slots as string[] | null) ?? [];
      if (slotsErr || !s.length) setSlots(DEFAULT_SLOTS);
      else setSlots(s);
      setSlotsByDay((row?.slots_by_day as Record<string, string[]>) ?? {});
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, patch: Partial<Pick<Row, "day" | "time" | "courtId">>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSavingId(id);
    const db: Record<string, unknown> = {};
    if (patch.day !== undefined) db.day = patch.day;
    if (patch.time !== undefined) db.time = patch.time;
    if (patch.courtId !== undefined) db.court_id = patch.courtId;
    await supabase.from("matches").update(db).eq("id", id);
    setSavingId(null);
    setSavedId(id);
    setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1200);
  }

  const [organizing, setOrganizing] = useState(false);
  async function organize() {
    if (!days.length) {
      alert("Cadastre os dias do torneio em 'Torneio' antes de organizar.");
      return;
    }
    const slotPlan: SlotPlan = { fallback: slots, byDay: slotsByDay };
    const active = days.filter((d) => slotsOn(slotPlan, d).length > 0);
    if (!active.length) {
      alert("Nenhum dia tem horário configurado. Ajuste em 'Horários por dia'.");
      return;
    }
    const capacity = Math.max(1, courts.length);
    const reschedulable = rows.filter(
      (r) => r.status !== "finalizado" && r.status !== "wo" && r.status !== "desistencia"
    );
    const skipped = rows.length - reschedulable.length;
    const ok = confirm(
      `Isso apaga o agendamento atual e recria do zero para ${reschedulable.length} jogo(s) ainda não jogado(s)` +
        (skipped > 0 ? ` (${skipped} já finalizados serão mantidos)` : "") +
        `.\n\nRegras:\n• ${active.length} dia(s) com jogos, até ${capacity} jogo(s) simultâneos por horário\n` +
        "• Cada rodada do mata-mata ocupa um dia só dela, de trás para frente (final no último dia, semi no penúltimo, quartas no antepenúltimo)\n" +
        "• Nenhuma categoria joga a fase de grupos no dia da própria chave\n" +
        "• Quadra em branco — você define na hora\n\nContinuar?"
    );
    if (!ok) return;
    setOrganizing(true);
    const plan = autoSchedule(
      reschedulable.map((r) => ({
        id: r.id,
        phase: r.phase,
        aId: r.aId,
        bId: r.bId,
        categoryKey: r.categoryShort,
      })),
      days,
      slotPlan,
      capacity
    );
    await Promise.all(
      [...plan.entries()].map(([id, a]) =>
        supabase
          .from("matches")
          .update({ day: a.day, time: a.time, court_id: null })
          .eq("id", id)
      )
    );
    await load();
    setOrganizing(false);
  }

  function openEditSlots() {
    const draft: Record<string, string> = {};
    for (const d of days) draft[d] = (slotsByDay[d] ?? slots).join(", ");
    setDraftByDay(draft);
    setPicked([]);
    setBulkDraft("");
    setEditSlots(true);
  }

  /** Aplica o texto do campo em massa a todos os dias marcados. */
  function applyBulk() {
    if (!picked.length) return;
    setDraftByDay((d) => {
      const next = { ...d };
      for (const day of picked) next[day] = bulkDraft;
      return next;
    });
    setPicked([]);
  }
  async function saveSlots() {
    if (!tournamentId) {
      alert("Torneio não encontrado.");
      return;
    }
    const byDay: Record<string, string[]> = {};
    for (const d of days) byDay[d] = parseTimes(draftByDay[d] ?? "");
    if (!days.some((d) => byDay[d].length)) {
      alert("Deixe pelo menos um dia com horário — senão não há onde encaixar os jogos.");
      return;
    }
    setSavingSlots(true);
    const { error } = await supabase
      .from("tournaments")
      .update({ slots_by_day: byDay })
      .eq("id", tournamentId);
    setSavingSlots(false);
    if (error) {
      alert(
        "Não foi possível salvar os horários. Provavelmente a migração 08 (supabase/migration-08-horarios-por-dia.sql) ainda não foi rodada no SQL Editor. Detalhe: " +
          error.message
      );
      return;
    }
    setSlotsByDay(byDay);
    setEditSlots(false);
  }

  // Conflitos: mesma quadra + mesmo dia + mesmo horário
  const conflictKeys = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of rows) {
      if (!r.courtId) continue;
      const k = `${r.courtId}|${r.day}|${r.time}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [rows]);

  const cats = useMemo(() => {
    const seen = new Set<string>();
    const uniq = rows.filter((r) => (seen.has(r.categoryShort) ? false : seen.add(r.categoryShort)));
    return uniq.sort(
      (a, b) =>
        (catOrder.get(a.categoryShort) ?? Infinity) -
        (catOrder.get(b.categoryShort) ?? Infinity)
    );
  }, [rows, catOrder]);
  const allDays = useMemo(() => Array.from(new Set(rows.map((r) => r.day))).sort(), [rows]);

  const filtered = rows.filter(
    (r) => (cat === "all" || r.categoryShort === cat) && (day === "all" || r.day === day)
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      if (!map.has(r.day)) map.set(r.day, []);
      map.get(r.day)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (!rows.length) return <p className="text-sm text-muted">Nenhum jogo ainda. Gere as chaves no Chaveamento.</p>;

  const dayOptions = days.length ? days : allDays;
  // Filtro de dias: todos os dias do torneio + eventuais dias com jogos fora da lista
  const filterDays = Array.from(new Set([...(days ?? []), ...allDays])).sort();

  return (
    <div>
      {/* Ação: organizar automaticamente */}
      <div className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="mb-2 text-xs text-muted">
          Distribui todos os jogos pelos dias cadastrados, nos horários de cada
          dia. Até <b>{Math.max(1, courts.length)}</b> jogo(s) simultâneos por
          horário (um por quadra). Cada rodada do mata-mata ocupa um dia só dela,
          de trás para frente: <b>final</b> no último, <b>semi</b> no penúltimo.
          A quadra fica em branco — você escolhe na hora do jogo.
        </div>

        {/* Horários de cada dia */}
        {!editSlots ? (
          <div className="mb-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Horários por dia</span>
              <button
                onClick={openEditSlots}
                className="text-xs font-semibold text-accent underline"
              >
                editar
              </button>
            </div>
            {groupDaysByTimes([...days].sort(), (d) => slotsByDay[d] ?? slots).map(
              (blk) => (
                <div key={blk.days[0]} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">
                    {blk.days.length > 1
                      ? `${formatDay(blk.days[0])} – ${formatDay(blk.days[blk.days.length - 1])}`
                      : formatDay(blk.days[0])}
                    :
                  </span>
                  {blk.times.length === 0 ? (
                    <span className="text-xs italic text-muted/70">sem jogos</span>
                  ) : (
                    blk.times.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-xs tabular-nums"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="mb-2 rounded-lg border border-border bg-background p-2">
            <p className="mb-2 text-xs text-muted">
              Marque os dias que têm o mesmo horário e preencha de uma vez, ou
              edite dia a dia. Dia sem horário nenhum fica <b>sem jogos</b>.
            </p>

            <div className="mb-2 space-y-1">
              {[...days].sort().map((d) => {
                const on = picked.includes(d);
                return (
                  <div key={d} className="flex items-center gap-2">
                    <label className="flex w-32 shrink-0 items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((p) => (on ? p.filter((x) => x !== d) : [...p, d]))
                        }
                      />
                      {formatDay(d)}
                    </label>
                    <input
                      value={draftByDay[d] ?? ""}
                      onChange={(e) =>
                        setDraftByDay((s) => ({ ...s, [d]: e.target.value }))
                      }
                      placeholder="sem jogos"
                      className="w-full rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-lira-purple-soft/40 p-2">
              <button
                onClick={() =>
                  setPicked(picked.length === days.length ? [] : [...days].sort())
                }
                className="text-xs font-semibold text-accent underline"
              >
                {picked.length === days.length ? "desmarcar todos" : "marcar todos"}
              </button>
              <input
                value={bulkDraft}
                onChange={(e) => setBulkDraft(e.target.value)}
                placeholder="18:00, 20:00"
                className="w-40 rounded-lg border border-border bg-card px-2 py-1 text-sm tabular-nums"
              />
              <button
                onClick={applyBulk}
                disabled={!picked.length}
                className="rounded-lg border border-lira-purple px-2 py-1 text-xs font-bold text-accent disabled:opacity-40"
              >
                Aplicar aos {picked.length} marcado{picked.length === 1 ? "" : "s"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveSlots}
                disabled={savingSlots}
                className="rounded-lg bg-lira-purple px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {savingSlots ? "Salvando…" : "Salvar horários"}
              </button>
              <button
                onClick={() => setEditSlots(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <button
          onClick={organize}
          disabled={organizing}
          className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {organizing ? "Organizando…" : "🗓️ Organizar automaticamente"}
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-3 space-y-2">
        <Chips
          value={day}
          onChange={setDay}
          options={[{ v: "all", l: "Todos os dias" }, ...filterDays.map((d) => ({ v: d, l: formatDay(d) }))]}
        />
        <Chips
          value={cat}
          onChange={setCat}
          options={[{ v: "all", l: "Todas" }, ...cats.map((c) => ({ v: c.categoryShort, l: c.categoryShort }))]}
        />
      </div>

      <div className="space-y-5">
        {grouped.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
            Nenhum jogo neste dia ainda. Use o seletor de <b>dia</b> em cada jogo (nos outros dias)
            para movê-los para cá.
          </p>
        )}
        {grouped.map(([d, list]) => (
          <section key={d}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{formatDay(d)}</h3>
            <div className="space-y-2">
              {list.map((r) => {
                const conflict = r.courtId && conflictKeys.has(`${r.courtId}|${r.day}|${r.time}`);
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border bg-card p-3 ${conflict ? "border-live" : "border-border"}`}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                      <span>
                        <span className="font-semibold text-accent">{r.categoryShort}</span> ·{" "}
                        {PHASE_LABEL[r.phase]}
                        {r.groupId ? ` ${r.groupId}` : ""}
                      </span>
                      <span>
                        {savingId === r.id ? "salvando…" : savedId === r.id ? "✓ salvo" : ""}
                      </span>
                    </div>
                    <p className="mb-2 truncate text-sm font-semibold">
                      {r.nameA} <span className="text-muted">×</span> {r.nameB}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={r.day}
                        onChange={(e) => update(r.id, { day: e.target.value })}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        {dayOptions.map((dd) => (
                          <option key={dd} value={dd}>
                            {formatDay(dd)}
                          </option>
                        ))}
                      </select>
                      <TimeInput
                        value={r.time}
                        onCommit={(t) => update(r.id, { time: t })}
                      />
                      <select
                        value={r.courtId ?? ""}
                        onChange={(e) => update(r.id, { courtId: e.target.value || null })}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        <option value="">Sem quadra</option>
                        {courts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {conflict && (
                      <p className="mt-1.5 text-[11px] font-semibold text-live">
                        ⚠ Conflito: mesma quadra e horário de outro jogo.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Horário que só grava quando o campo perde o foco (ou no Enter). Salvar a cada
 * tecla escrevia valores incompletos no banco — digitar 16:30 passa por 01:30 —
 * e as gravações podiam chegar fora de ordem, deixando o valor errado gravado.
 */
function TimeInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (t: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Ressincroniza quando o horário muda por fora (agenda automática, recarga).
  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (!/^\d{2}:\d{2}$/.test(draft)) {
      setDraft(value); // incompleto: descarta e volta ao que estava
      return;
    }
    if (draft !== value) onCommit(draft);
  }

  return (
    <input
      type="time"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
    />
  );
}

function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
            value === o.v
              ? "border-lira-purple bg-lira-purple text-white"
              : "border-border bg-card text-foreground hover:border-lira-purple"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
