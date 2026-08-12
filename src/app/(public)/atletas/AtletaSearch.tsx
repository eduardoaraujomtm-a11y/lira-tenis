"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export function AtletaSearch({
  athletes,
}: {
  athletes: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      q
        ? athletes.filter((a) => a.name.toLowerCase().includes(q))
        : athletes,
    [athletes, q]
  );

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔎 Buscar atleta"
        className="mb-4 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-lira-purple"
      />
      {filtered.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted">
          Nenhum atleta encontrado.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/atleta/${a.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-shadow hover:shadow-md"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lira-purple text-sm font-bold text-white">
                {a.name.charAt(0)}
              </span>
              <span className="font-semibold">{a.name}</span>
              <span className="ml-auto text-xs text-accent">Ver perfil →</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
