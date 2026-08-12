import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import {
  getLiveMatches,
  getUpcomingMatches,
  getFinishedMatches,
  getChampions,
} from "@/lib/repo";

export default async function Home() {
  const [live, upcomingAll, recentAll, champions] = await Promise.all([
    getLiveMatches(),
    getUpcomingMatches(),
    getFinishedMatches(),
    getChampions(),
  ]);
  const upcoming = upcomingAll.slice(0, 4);
  const recent = recentAll.slice(0, 3);

  return (
    <div className="space-y-6">
      <RealtimeRefresher />

      {champions.length > 0 && (
        <section>
          <SectionTitle title="Campeões 🏆" href="/campeoes" />
          <div className="space-y-2">
            {champions.slice(0, 3).map((c) => (
              <div
                key={c.categoryId}
                className="flex items-center justify-between gap-2 rounded-xl border border-lira-yellow/50 bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-accent">{c.categoryShort}</p>
                  <p className="truncate text-sm font-bold">🏆 {c.champion}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Agora nas quadras" href={live.length ? "/ao-vivo" : undefined} />
        {live.length ? (
          <div className="space-y-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        ) : (
          <EmptyBox>Nenhum jogo ao vivo no momento.</EmptyBox>
        )}
      </section>

      <section>
        <SectionTitle title="Próximos jogos" href="/agenda" />
        <div className="space-y-1.5">
          {upcoming.map((m) => (
            <MatchCard key={m.id} match={m} showDay />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Últimos resultados" href="/resultados" />
        <div className="space-y-1.5">
          {recent.map((m) => (
            <MatchCard key={m.id} match={m} showDay />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-accent">
          Ver tudo →
        </Link>
      )}
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}
