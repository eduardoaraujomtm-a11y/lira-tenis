import { MatchCard } from "@/components/MatchCard";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { getLiveMatches } from "@/lib/repo";

export const metadata = { title: "Ao vivo · Lira Tênis" };

export default async function AoVivoPage() {
  const live = await getLiveMatches();
  return (
    <div>
      <RealtimeRefresher />
      <h2 className="mb-1 flex items-center gap-2 text-xl font-extrabold">
        <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-live" />
        Ao vivo
      </h2>
      <p className="mb-4 text-sm text-muted">
        {live.length} jogo{live.length === 1 ? "" : "s"} em andamento
      </p>

      {live.length ? (
        <div className="space-y-3">
          {live.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted">
          Nenhum jogo ao vivo agora. Volte durante as partidas! 🎾
        </div>
      )}
    </div>
  );
}
