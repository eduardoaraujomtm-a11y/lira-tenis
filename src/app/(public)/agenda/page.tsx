import { FilterableMatches } from "@/components/FilterableMatches";
import { getAgendaMatches, getCategories } from "@/lib/repo";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const metadata = { title: "Agenda · Lira Tênis" };

export default async function AgendaPage() {
  const [agenda, categories] = await Promise.all([getAgendaMatches(), getCategories()]);
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
