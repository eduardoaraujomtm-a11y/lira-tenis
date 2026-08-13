import Link from "next/link";
import { getMatchesForTournament, getActiveTournament } from "@/lib/repo";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import type { MatchView } from "@/lib/types";

function AdminMatchRow({ m }: { m: MatchView }) {
  return (
    <Link
      href={`/admin/jogo/${m.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted">
          <span className="font-semibold text-accent">{m.categoryShort}</span>
          <span>· {m.phaseLabel}</span>
          {m.isLive && (
            <span className="inline-flex items-center gap-1 font-bold text-live">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" /> AO VIVO
            </span>
          )}
        </div>
        <p className="truncate text-sm font-semibold">{m.a.name}</p>
        <p className="truncate text-sm font-semibold">{m.b.name}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        <p>{m.courtName ?? "—"}</p>
        <p>{m.time}</p>
        <span className="mt-1 inline-block rounded bg-lira-purple px-2 py-0.5 text-[11px] font-bold text-white">
          {m.isLive ? "Continuar" : m.status === "agendado" ? "Abrir mesa" : "Ver"}
        </span>
      </div>
    </Link>
  );
}

function Group({ title, matches }: { title: string; matches: MatchView[] }) {
  if (!matches.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
        {title} ({matches.length})
      </h2>
      <div className="space-y-2">
        {matches.map((m) => (
          <AdminMatchRow key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}

export default async function AdminDashboard() {
  const t = await getActiveTournament();
  const all = await getMatchesForTournament(t.id);
  const live = all.filter((m) => m.status === "ao_vivo");
  const scheduled = all.filter((m) => m.status === "agendado");
  const done = all.filter((m) => m.status === "finalizado" || m.status === "wo");

  return (
    <div>
      <RealtimeRefresher />
      <p className="mb-4 text-sm text-muted">
        Toque em um jogo para abrir a mesa e lançar o placar.
      </p>
      <Group title="Ao vivo agora" matches={live} />
      <Group title="Agendados" matches={scheduled} />
      <Group title="Encerrados" matches={done} />
    </div>
  );
}
