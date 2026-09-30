"use client";

import { writeAdminTidCookie } from "@/lib/adminTournament";

interface Tour {
  id: string;
  name: string;
  edition: string;
}

export function AdminTournamentSwitcher({
  tournaments,
  current,
}: {
  tournaments: Tour[];
  current: string;
}) {
  if (tournaments.length === 0) return null;

  function change(id: string) {
    writeAdminTidCookie(id);
    // Recarrega para que páginas de servidor e de cliente releiam o cookie.
    window.location.reload();
  }

  return (
    <div className="border-t border-white/10 bg-lira-purple-dark">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        <label className="text-[11px] font-semibold text-lira-yellow">Torneio:</label>
        <select
          value={current}
          onChange={(e) => change(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id} className="text-foreground">
              {t.name}
              {t.edition ? ` (${t.edition})` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
