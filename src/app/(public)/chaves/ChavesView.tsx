"use client";

import { useState } from "react";
import type { CategoryView, GroupView, MatchView } from "@/lib/types";
import { Bracket } from "@/components/Bracket";
import { GroupStandings } from "@/components/GroupStandings";
import { formatShort, hasGroupsPhase, hasKnockoutPhase } from "@/lib/rules";

export interface CategoryBracket {
  category: CategoryView;
  groups: GroupView[];
  bracket: { phase: string; phaseLabel: string; matches: MatchView[] }[];
}

export function ChavesView({ data }: { data: CategoryBracket[] }) {
  const [catId, setCatId] = useState(data[0]?.category.id);
  const current = data.find((d) => d.category.id === catId) ?? data[0];
  if (!current) return null;
  const cat = current.category;
  const showGroups = hasGroupsPhase(cat.format);
  const showKnockout = hasKnockoutPhase(cat.format);

  return (
    <div>
      {/* Seletor de categoria */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {data.map((d) => (
          <button
            key={d.category.id}
            onClick={() => setCatId(d.category.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              d.category.id === catId
                ? "border-lira-purple bg-lira-purple text-white"
                : "border-border bg-card text-foreground hover:border-lira-purple"
            }`}
          >
            {d.category.shortName}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span className="rounded bg-lira-yellow px-2 py-0.5 font-semibold text-lira-purple-dark">
          {cat.type === "duplas" ? "Duplas" : "Simples"}
        </span>
        <span>{formatShort(cat.format)}</span>
      </div>

      {showGroups && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            Classificação dos grupos
          </h3>
          <GroupStandings groups={current.groups} advancing={showKnockout} />
        </section>
      )}

      {showKnockout && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            Chave do mata-mata
          </h3>
          <Bracket groups={current.bracket} />
        </section>
      )}
    </div>
  );
}
