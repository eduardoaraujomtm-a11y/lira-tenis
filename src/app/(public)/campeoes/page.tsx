import Link from "next/link";
import { getChampions } from "@/lib/repo";
import { SHOW_RANKING } from "@/lib/features";
import type { Champion } from "@/lib/types";

export const metadata = { title: "Campeões · Lira Tênis" };

function ChampionCard({ c }: { c: Champion }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-lira-yellow/50 bg-card shadow-sm">
      <div className="bg-lira-purple px-4 py-2 text-sm font-bold text-lira-yellow">
        {c.categoryName}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Campe{c.type === "duplas" ? "ões" : "ão"}
            </p>
            <p className="text-lg font-extrabold leading-tight">{c.champion}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <span className="text-xl">🥈</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Vice-campe{c.type === "duplas" ? "ões" : "ão"}
            </p>
            <p className="text-sm font-semibold">{c.runnerUp}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CampeoesPage() {
  const champions = await getChampions();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Campeões 🏆</h2>
        {SHOW_RANKING && (
          <Link href="/ranking" className="text-sm font-semibold text-accent">
            📊 Ranking →
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">Torneio 100 Anos · Lira Tênis Clube</p>

      {champions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted">
          Os campeões aparecem aqui assim que as finais forem encerradas. 🎾
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {champions.map((c) => (
            <ChampionCard key={c.categoryId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
