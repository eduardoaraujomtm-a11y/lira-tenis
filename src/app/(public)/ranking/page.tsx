import { redirect } from "next/navigation";
import Link from "next/link";
import { getRanking } from "@/lib/repo";
import { SHOW_RANKING } from "@/lib/features";
import { DEFAULT_POINTS as P } from "@/lib/ranking";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const metadata = { title: "Ranking · Lira Tênis" };

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "");

export default async function RankingPage() {
  // Oculto enquanto os critérios de pontuação não são definidos: sem isto, um
  // link antigo ou salvo nos favoritos ainda abriria a classificação.
  if (!SHOW_RANKING) redirect("/resultados");
  const rows = await getRanking();

  return (
    <div>
      <RealtimeRefresher />
      <h2 className="mb-1 text-xl font-extrabold">Ranking dos atletas 🎾</h2>
      <div className="mb-4 rounded-lg border border-lira-yellow/40 bg-lira-yellow/10 px-3 py-2 text-xs text-muted">
        Ranking <span className="font-bold text-foreground">NÃO</span> oficial que segue pontuações somente dos torneios registrados nesse app. Segue os critérios de pontuação abaixo.
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted">
          O ranking aparece conforme os jogos vão sendo encerrados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Atleta</th>
                <th className="px-2 py-2 text-center font-medium">J</th>
                <th className="px-2 py-2 text-center font-medium">V</th>
                <th className="px-2 py-2 text-center font-medium" title="Títulos">🏆</th>
                <th className="px-3 py-2 text-right font-medium">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.athleteId}
                  className={`border-t border-border ${i < 3 ? "bg-lira-yellow/10" : ""}`}
                >
                  <td className="px-3 py-2.5 tabular-nums">
                    <span className="font-bold text-accent">{i + 1}</span>{" "}
                    <span>{medal(i)}</span>
                  </td>
                  <td className="px-2 py-2.5 font-semibold">
                    <Link href={`/atleta/${r.athleteId}`} className="hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted">{r.played}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted">{r.wins}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums">{r.titles || ""}</td>
                  <td className="px-3 py-2.5 text-right text-base font-extrabold text-accent tabular-nums">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda da pontuação */}
      <div className="mt-4 rounded-xl border border-border bg-card p-3 text-xs text-muted">
        <p className="mb-1 font-bold text-foreground">Como a pontuação funciona</p>
        <p>
          {P.win} pts por <b>vitória</b> · {P.participacao} de <b>participação</b> · bônus por colocação:{" "}
          <b>campeão +{P.campeao}</b>, vice +{P.vice}, 3º/4º +{P.semi}, quartas +{P.quartas}, oitavas +{P.oitavas}.
        </p>
        <p className="mt-1">
          Em categorias só de grupos, a colocação final no grupo define o bônus (1º = campeão, 2º = vice, etc.).
          Numa dupla, os dois atletas recebem os pontos.
        </p>
      </div>
    </div>
  );
}
