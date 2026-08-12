import { notFound } from "next/navigation";
import Link from "next/link";
import { getAthleteProfile } from "@/lib/repo";
import { MatchCard } from "@/components/MatchCard";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { formatDay } from "@/lib/tennis";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getAthleteProfile(id);
  return { title: profile ? `${profile.name} · Lira Tênis` : "Atleta" };
}

const medal = (pos: number) =>
  pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : "";

export default async function AtletaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getAthleteProfile(id);
  if (!profile) notFound();

  const { stats } = profile;
  const finished = profile.matches.filter(
    (m) => m.status === "finalizado" || m.status === "wo"
  );
  const upcoming = profile.matches.filter(
    (m) => m.status === "agendado" || m.status === "ao_vivo"
  );

  return (
    <div>
      <RealtimeRefresher />

      {/* Header do perfil */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lira-purple text-2xl font-bold text-white">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{profile.name}</h2>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              {profile.categories.map((c) => (
                <span key={c.id}>
                  <span className="font-semibold text-accent">{c.shortName}</span>
                  {c.partnerName && (
                    <span> c/ {c.partnerName}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Ranking */}
        {profile.rankPosition && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-lira-purple-soft px-3 py-2">
            <span className="text-lg font-extrabold text-accent">
              #{profile.rankPosition}
            </span>
            <span className="text-lg">{medal(profile.rankPosition)}</span>
            <span className="text-sm text-muted">no ranking</span>
            <span className="ml-auto text-sm font-bold text-accent tabular-nums">
              {profile.rankPoints} pts
            </span>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <StatBox label="Jogos" value={stats.played} />
        <StatBox label="Vitórias" value={stats.wins} accent />
        <StatBox label="Derrotas" value={stats.losses} />
        <StatBox label="Aprov." value={`${stats.winPct}%`} accent />
      </div>

      {profile.titles > 0 && (
        <div className="mb-4 rounded-xl border border-lira-yellow/40 bg-lira-yellow/10 px-4 py-3 text-center">
          <span className="text-2xl">🏆</span>
          <span className="ml-2 font-bold text-lira-yellow">
            {profile.titles} título{profile.titles > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Próximos jogos */}
      {upcoming.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-accent">
            Próximos jogos
          </h3>
          <div className="space-y-1.5">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} showDay />
            ))}
          </div>
        </section>
      )}

      {/* Histórico */}
      <section>
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-accent">
          Histórico de jogos
        </h3>
        {finished.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
            Nenhum jogo encerrado ainda.
          </p>
        ) : (
          <div className="space-y-1.5">
            {finished.map((m) => (
              <MatchCard key={m.id} match={m} showDay />
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 text-center">
        <Link
          href="/atletas"
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← Todos os atletas
        </Link>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 text-center">
      <p
        className={`text-lg font-extrabold tabular-nums ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase text-muted">{label}</p>
    </div>
  );
}
