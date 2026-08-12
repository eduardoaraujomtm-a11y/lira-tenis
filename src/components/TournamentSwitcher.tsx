"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Tournament {
  id: string;
  name: string;
  edition: string;
  active: boolean;
}

export function TournamentSwitcher({ tournaments }: { tournaments: Tournament[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedId = searchParams.get("torneio");
  const currentId = selectedId ?? tournaments.find((t) => t.active)?.id;
  const current = tournaments.find((t) => t.id === currentId) ?? tournaments[0];
  const label = [current?.name, current?.edition].filter(Boolean).join(" ") || "Torneio";

  return (
    <div className="flex min-w-0 flex-col gap-0.5" ref={ref}>
      <span className="text-sm font-bold uppercase tracking-wide text-lira-yellow">
        {label}
      </span>

      {tournaments.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-lira-yellow transition-colors hover:bg-white/20"
          >
            Alterar torneio ▾
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-xl">
              {tournaments.map((t) => {
                const isCurrent = t.id === currentId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setOpen(false);
                      if (!isCurrent) {
                        const params = new URLSearchParams(searchParams.toString());
                        if (t.active) {
                          params.delete("torneio");
                        } else {
                          params.set("torneio", t.id);
                        }
                        const qs = params.toString();
                        router.push(pathname + (qs ? `?${qs}` : ""));
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isCurrent
                        ? "bg-accent/20 font-bold text-accent"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="flex-1 truncate">
                      {t.name} {t.edition}
                    </span>
                    {t.active && <span className="text-[10px] text-muted">atual</span>}
                    {isCurrent && <span className="text-xs text-accent">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
