"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Mesa", exact: true },
  { href: "/admin/torneio", label: "Torneio" },
  { href: "/admin/atletas", label: "Atletas" },
  { href: "/admin/chaveamento", label: "Chaveamento" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/administradores", label: "Admins" },
];

export function AdminNav({ isMesario = false }: { isMesario?: boolean }) {
  const pathname = usePathname();
  // Mesário só vê a Mesa
  const visible = isMesario ? items.filter((it) => it.href === "/admin") : items;
  return (
    <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
      {visible.map((it) => {
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
