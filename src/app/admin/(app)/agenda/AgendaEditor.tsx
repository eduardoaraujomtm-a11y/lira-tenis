"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortName, formatDay, PHASE_LABEL } from "@/lib/tennis";
import type { Phase } from "@/lib/types";

interface Row {
  id: string;
  categoryShort: string;
  phase: Phase;
  groupId: string | null;
  status: string;
  day: string;
  time: string;
  courtId: string | null;
  nameA: string;
  nameB: string;
}
interface Court {
  id: string;
  name: string;
}

export function AgendaEditor() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [day, setDay] = useState("all");

  const load = useCallback(async () => {
    const [compRes, matchRes, courtRes, tourRes] = await Promise.all([
      supabase.from("competitors").select("id,athletes:competitor_athletes(position,athlete:athletes(name))"),
      supabase
        .from("matches")
        .select("id,phase,group_id,status,day,time,court_id,competitor_a,competitor_b,category:categories(short_name)")
        .order("day")
        .order("time"),
      supabase.from("courts").select("id,name").order("name"),
      supabase.from("tournaments").select("id,days").limit(1).single(),
    ]);

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
    const nameOf = (id: string | null) => (id ? nameById.get(id) ?? "?" : "A definir");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ms = ((matchRes.data as any[]) ?? []).map((m) => ({
      id: m.id,
      categoryShort: m.category?.short_name ?? "",
      phase: m.phase as Phase,
      groupId: m.group_id,
      status: m.status,
      day: m.day,
      time: m.time,
      courtId: m.court_id,
      nameA: nameOf(m.competitor_a),
      nameB: nameOf(m.competitor_b),
    }));
    setRows(ms);
    setCourts((courtRes.data as Court[]) ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDays(((tourRes.data as any)?.days as string[]) ?? []);
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
    return rows.filter((r) => (seen.has(r.categoryShort) ? false : seen.add(r.categoryShort)));
  }, [rows]);
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

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 space-y-2">
        <Chips
          value={day}
          onChange={setDay}
          options={[{ v: "all", l: "Todos os dias" }, ...allDays.map((d) => ({ v: d, l: formatDay(d) }))]}
        />
        <Chips
          value={cat}
          onChange={setCat}
          options={[{ v: "all", l: "Todas" }, ...cats.map((c) => ({ v: c.categoryShort, l: c.categoryShort }))]}
        />
      </div>

      <div className="space-y-5">
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
                        <span className="font-semibold text-lira-purple">{r.categoryShort}</span> ·{" "}
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
                      <input
                        type="time"
                        value={r.time}
                        onChange={(e) => update(r.id, { time: e.target.value })}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
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
    <div className="flex gap-2 overflow-x-auto pb-1">
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
