import type { GroupView } from "@/lib/types";

/** Saldo com sinal: +3, -2, 0. */
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Tabela de classificação por grupo (já calculada no repositório). */
export function GroupStandings({
  groups,
  advancing = true,
  qualifiersPerGroup = 2,
}: {
  groups: GroupView[];
  advancing?: boolean;
  qualifiersPerGroup?: number;
}) {
  if (!groups.length) return null;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.groupId} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="bg-lira-purple-soft px-3 py-1.5 text-xs font-bold text-accent">
            Grupo {g.groupId}
          </div>
          {/* table-fixed: sem isso cada grupo dimensiona as colunas pelo próprio
              conteúdo, e um nome mais longo desalinha os números entre os grupos. */}
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="pl-3 pr-1 py-1 text-left font-medium">Dupla</th>
                <th className="w-5 py-1 text-center font-medium" title="Partidas jogadas">J</th>
                <th className="w-5 py-1 text-center font-medium" title="Vitórias">V</th>
                <th
                  className="w-11 py-1 text-center font-medium"
                  title="Saldo de sets — ganhos menos perdidos (o super tie-break conta como um set)"
                >
                  S. Sets
                </th>
                <th
                  className="w-14 pr-2 py-1 text-center font-medium"
                  title="Saldo de games — ganhos menos perdidos (o super tie-break vale um game para quem vence)"
                >
                  S. Games
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={r.competitorId} className="border-t border-border">
                  <td className="pl-3 pr-1 py-1.5">
                    <span
                      className={`flex items-baseline gap-1 ${
                        advancing && r.qualifies ? "font-semibold" : ""
                      }`}
                    >
                      {/* A posição ocupa o lugar do antigo marcador ▸: numera
                          todo mundo sem tirar largura do nome. */}
                      <span
                        className={`w-3 shrink-0 text-right text-[11px] tabular-nums ${
                          advancing && r.qualifies ? "font-bold text-win" : "text-muted"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span>{r.name}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-center tabular-nums">{r.played}</td>
                  <td className="py-1.5 text-center font-bold tabular-nums text-accent">
                    {r.wins}
                  </td>
                  <td className="py-1.5 text-center tabular-nums">
                    {r.played ? signed(r.setDiff) : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-center tabular-nums">
                    {r.played ? signed(r.gameDiff) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {advancing ? (
        <p className="text-[11px] text-muted">
          ▸ {qualifiersPerGroup === 1 ? "O 1º" : `Os ${qualifiersPerGroup} primeiros`} de cada
          grupo avança{qualifiersPerGroup === 1 ? "" : "m"} ao mata-mata.
        </p>
      ) : (
        <FinalNote groupCount={groups.length} />
      )}
    </div>
  );
}

/**
 * Só aparece nas categorias sem mata-mata: nelas a tabela do grupo já é a
 * classificação final, então vale dizer quem leva o título e como o empate é
 * resolvido.
 */
function FinalNote({ groupCount }: { groupCount: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-muted">
      <div>
        <p className="mb-0.5 font-semibold text-foreground">Classificação final</p>
        <p>
          {groupCount > 1 ? "Em cada grupo, o" : "O"}{" "}
          <span className="font-semibold text-win">1º colocado é o campeão</span> e o{" "}
          <span className="font-semibold">2º, o vice-campeão</span>.
        </p>
      </div>
      <div>
        <p className="mb-0.5 font-semibold text-foreground">Critérios de desempate</p>
        <p>
          <span className="font-semibold">Entre duas duplas:</span> confronto direto.
        </p>
        <p>
          <span className="font-semibold">Entre três ou mais:</span> saldo de sets,
          saldo de games, games pró e games contra, nessa ordem.
        </p>
      </div>
    </div>
  );
}
