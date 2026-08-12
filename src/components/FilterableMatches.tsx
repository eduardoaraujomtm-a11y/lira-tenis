"use client";

import { useMemo, useState } from "react";
import type { MatchView } from "@/lib/types";
import { formatDay } from "@/lib/tennis";
import { MatchCard } from "./MatchCard";

/** Lista de jogos com filtros por categoria e por dia. */
export function FilterableMatches({
  matches,
  emptyLabel = "Nenhum jogo encontrado.",
  categoryOrder,
}: {
  matches: MatchView[];
  emptyLabel?: string;
  /** IDs de categoria na ordem de exibição desejada (sort_order do torneio). */
  categoryOrder?: string[];
}) {
  const [cat, setCat] = useState<string>("all");
  const [day, setDay] = useState<string>("all");
  const [query, setQuery] = useState("");

  const days = useMemo(
    () => Array.from(new Set(matches.map((m) => m.day))).sort(),
    [matches]
  );
  // Categorias presentes, ordenadas pelo sort_order do torneio (quando informado).
  const cats = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of matches) if (!seen.has(m.categoryId)) seen.set(m.categoryId, m.categoryShort);
    const entries = Array.from(seen.entries());
    if (!categoryOrder) return entries;
    const rank = new Map(categoryOrder.map((id, i) => [id, i]));
    return entries.sort(
      (a, b) => (rank.get(a[0]) ?? Infinity) - (rank.get(b[0]) ?? Infinity)
    );
  }, [matches, categoryOrder]);

  const q = query.trim().toLowerCase();
  const filtered = matches
    .filter((m) => (cat === "all" ? true : m.categoryId === cat))
    .filter((m) => (day === "all" ? true : m.day === day))
    .filter((m) => (q ? m.searchText.includes(q) : true))
    .sort((x, y) => (x.day + x.time).localeCompare(y.day + y.time));

  // "Seu próximo jogo": ao buscar por nome, o primeiro jogo ao vivo/agendado
  const nextGame = useMemo(() => {
    if (!q) return null;
    return (
      matches
        .filter((m) => m.searchText.includes(q))
        .filter((m) => m.status === "ao_vivo" || m.status === "agendado")
        .sort((x, y) => (x.day + x.time).localeCompare(y.day + y.time))[0] ?? null
    );
  }, [matches, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, MatchView[]>();
    for (const m of filtered) {
      if (!map.has(m.day)) map.set(m.day, []);
      map.get(m.day)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      {/* Busca por nome — "Meus jogos" */}
      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 Busque seu nome (meus jogos)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-lira-purple"
        />
        {q && nextGame && (
          <div className="mt-2 rounded-lg border border-lira-yellow/60 bg-lira-yellow/15 px-3 py-2 text-sm">
            <span className="font-bold text-accent">
              {nextGame.isLive ? "🔴 Jogo ao vivo agora" : "🔔 Seu próximo jogo"}:
            </span>{" "}
            {nextGame.a.name} × {nextGame.b.name}
            <span className="text-muted">
              {" "}
              · {nextGame.categoryShort} · {nextGame.courtName ?? "quadra a definir"} ·{" "}
              {formatDay(nextGame.day)} {nextGame.time}
            </span>
          </div>
        )}
        {q && !nextGame && (
          <p className="mt-2 text-xs text-muted">Nenhum jogo futuro encontrado para “{query}”.</p>
        )}
      </div>

      {days.length > 1 && (
        <ChipRow
          label="Dia"
          value={day}
          onChange={setDay}
          options={[
            { value: "all", label: "Todos" },
            ...days.map((d) => ({ value: d, label: formatDay(d) })),
          ]}
        />
      )}
      <ChipRow
        label="Categoria"
        value={cat}
        onChange={setCat}
        options={[
          { value: "all", label: "Todas" },
          ...cats.map(([id, label]) => ({ value: id, label })),
        ]}
      />

      {grouped.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map(([d, ms]) => (
            <section key={d}>
              {/* Fica grudado no topo enquanto se rola o dia — em lista longa,
                  é o que diz onde você está sem precisar voltar. */}
              <h3 className="sticky top-0 z-10 -mx-1 mb-1.5 flex items-center gap-2 bg-background/95 px-1 py-1.5 backdrop-blur">
                <span className="h-4 w-1 rounded-full bg-lira-yellow" />
                <span className="text-sm font-extrabold uppercase tracking-wide text-accent">
                  {formatDay(d)}
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  {ms.length} jogo{ms.length === 1 ? "" : "s"}
                </span>
              </h3>
              <div className="space-y-1.5">
                {ms.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              value === o.value
                ? "border-lira-purple bg-lira-purple text-white"
                : "border-border bg-card text-foreground hover:border-lira-purple"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
