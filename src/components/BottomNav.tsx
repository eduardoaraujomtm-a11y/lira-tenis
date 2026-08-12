"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHOW_RANKING } from "@/lib/features";

const items = [
  { href: "/", label: "Início", icon: "🏠" },
{ href: "/agenda", label: "Agenda", icon: "📅" },
  { href: "/chaves", label: "Chaves", icon: "🎾" },
  { href: "/resultados", label: "Resultados", icon: "🏆" },
  { href: "/atletas", label: "Atletas", icon: "👤" },
  ...(SHOW_RANKING ? [{ href: "/ranking", label: "Ranking", icon: "📊" }] : []),
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card">
      <div className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const active =
            it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={`text-base leading-none ${
                  active ? "" : "opacity-60 grayscale"
                }`}
              >
                {it.icon}
              </span>
              <span>{it.label}</span>
              {active && (
                <span className="mt-0.5 h-0.5 w-6 rounded-full bg-lira-yellow" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
