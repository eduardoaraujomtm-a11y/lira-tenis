import Link from "next/link";
import { FilterableMatches } from "@/components/FilterableMatches";
import { getFinishedMatches } from "@/lib/repo";

export const metadata = { title: "Resultados · Lira Tênis" };

export default async function ResultadosPage() {
  const finished = await getFinishedMatches();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Resultados</h2>
        <Link href="/campeoes" className="text-sm font-semibold text-lira-purple">
          🏆 Campeões →
        </Link>
      </div>
      <FilterableMatches
        matches={finished}
        emptyLabel="Nenhum resultado com esses filtros."
      />
    </div>
  );
}
