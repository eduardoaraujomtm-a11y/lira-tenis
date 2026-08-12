import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import {
  getLiveMatches,
  getUpcomingMatches,
  getFinishedMatches,
} from "@/lib/repo";

export default async function Home() {
  const [live, upcomingAll, recentAll] = await Promise.all([
    getLiveMatches(),
    getUpcomingMatches(),
    getFinishedMatches(),
  ]);
  const upcoming = upcomingAll.slice(0, 4);
  const recent = recentAll.slice(0, 3);

  return (
    <div className="space-y-6">
      <RealtimeRefresher />

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
