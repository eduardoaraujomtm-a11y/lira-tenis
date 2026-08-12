import { ChavesView, type CategoryBracket } from "./ChavesView";
import { getCategoriesForTournament, getBracket, getStandings, resolveTournament } from "@/lib/repo";
import { hasGroupsPhase } from "@/lib/rules";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

export const metadata = { title: "Chaves · Lira Tênis" };

export default async function ChavesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { torneio } = await searchParams;
  const tournament = await resolveTournament(torneio as string | undefined);
  const categories = await getCategoriesForTournament(tournament.id);
  const data: CategoryBracket[] = await Promise.all(
    categories.map(async (category) => ({
      category,
      groups: hasGroupsPhase(category.format) ? await getStandings(category.id) : [],
      bracket: await getBracket(category.id),
    }))
  );

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold">Chaves por categoria</h2>
      <ChavesView data={data} />
      <RealtimeRefresher />
    </div>
  );
}
