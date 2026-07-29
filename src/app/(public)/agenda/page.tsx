import { FilterableMatches } from "@/components/FilterableMatches";
import { getAgendaMatches } from "@/lib/repo";

export const metadata = { title: "Agenda · Lira Tênis" };

export default async function AgendaPage() {
  const agenda = await getAgendaMatches();
  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold">Agenda de jogos</h2>
      <FilterableMatches
        matches={agenda}
        emptyLabel="Nenhum jogo agendado com esses filtros."
      />
    </div>
  );
}
