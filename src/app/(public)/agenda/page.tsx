import { FilterableMatches } from "@/components/FilterableMatches";
import { resolveTournament, getMatchesForTournament, getCategoriesForTournament } from "@/lib/repo";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda · Lira Tênis" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { torneio } = await searchParams;
  const tournament = await resolveTournament(torneio as string | undefined);
  const [allMatches, categories] = await Promise.all([
    getMatchesForTournament(tournament.id),
    getCategoriesForTournament(tournament.id),
  ]);
  const agenda = allMatches.filter(
    (m) => m.status === "agendado" || m.status === "ao_vivo"
  );
  return (
    <div>
      <RealtimeRefresher />
      <h2 className="mb-4 text-xl font-extrabold">Agenda de jogos</h2>
      <FilterableMatches
        matches={agenda}
        emptyLabel="Nenhum jogo agendado com esses filtros."
        categoryOrder={categories.map((c) => c.id)}
      />
    </div>
  );
}
