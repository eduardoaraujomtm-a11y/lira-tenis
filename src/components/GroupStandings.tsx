import type { GroupView } from "@/lib/types";

/** Tabela de classificação por grupo (já calculada no repositório). */
export function GroupStandings({
  groups,
  advancing = true,
}: {
  groups: GroupView[];
  advancing?: boolean;
}) {
  if (!groups.length) return null;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.groupId} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="bg-lira-purple-soft px-3 py-1.5 text-xs font-bold text-lira-purple">
            Grupo {g.groupId}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="px-3 py-1 text-left font-medium">Dupla</th>
                <th className="px-1 py-1 text-center font-medium">J</th>
                <th className="px-1 py-1 text-center font-medium">V</th>
                <th className="px-1 py-1 text-center font-medium">Sets</th>
                <th className="px-2 py-1 text-center font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.competitorId} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <span className={advancing && r.qualifies ? "font-semibold" : ""}>
                      {advancing && r.qualifies && <span className="mr-1 text-win">▸</span>}
                      {r.name}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums">{r.played}</td>
                  <td className="px-1 py-1.5 text-center tabular-nums">{r.wins}</td>
                  <td className="px-1 py-1.5 text-center tabular-nums">
                    {r.setDiff > 0 ? `+${r.setDiff}` : r.setDiff}
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold tabular-nums text-lira-purple">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {advancing && (
        <p className="text-[11px] text-muted">▸ Os 2 primeiros de cada grupo avançam ao mata-mata.</p>
      )}
    </div>
  );
}
