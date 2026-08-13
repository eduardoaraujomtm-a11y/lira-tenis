import Link from "next/link";
import { FilterableMatches } from "@/components/FilterableMatches";
import { getFinishedMatchesForTournament, getCategoriesForTournament, resolveTournament } from "@/lib/repo";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { SHOW_RANKING } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultados · Lira Tênis" };

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { torneio } = await searchParams;
  const tournament = await resolveTournament(torneio as string | undefined);
  const [finished, categories] = await Promise.all([
    getFinishedMatchesForTournament(tournament.id),
    getCategoriesForTournament(tournament.id),
  ]);
  return (
    <div>
      <RealtimeRefresher />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Resultados</h2>
        <div className="flex shrink-0 items-center gap-3">
          {SHOW_RANKING && (
            <Link href="/ranking" className="text-sm font-semibold text-accent">
              📊 Ranking →
            </Link>
          )}
          <Link href="/campeoes" className="text-sm font-semibold text-accent">
            🏆 Campeões →
          </Link>
        </div>
      </div>
      <FilterableMatches
        matches={finished}
        emptyLabel="Nenhum resultado com esses filtros."
        categoryOrder={categories.map((c) => c.id)}
      />
    </div>
  );
}
