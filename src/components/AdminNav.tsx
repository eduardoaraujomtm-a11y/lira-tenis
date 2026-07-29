"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Mesa", exact: true },
  { href: "/admin/torneio", label: "Torneio" },
  { href: "/admin/atletas", label: "Atletas" },
  { href: "/admin/chaveamento", label: "Chaveamento" },
  { href: "/admin/agenda", label: "Agenda" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
      {items.map((it) => {
        const active = it.exact
          ? pathname === it.href
          : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-lira-yellow text-lira-purple-dark"
                : "text-white/80 hover:bg-white/10"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
