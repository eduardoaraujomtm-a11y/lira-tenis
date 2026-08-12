import Image from "next/image";
import { Suspense } from "react";
import { getActiveTournament, getAllTournaments } from "@/lib/repo";
import { TournamentSwitcher } from "./TournamentSwitcher";

export async function Header() {
  const [active, all] = await Promise.all([getActiveTournament(), getAllTournaments()]);

  const tournaments = all.map((t) => ({
    id: t.id,
    name: t.name,
    edition: t.edition,
    active: t.id === active.id,
  }));

  return (
    <header className="sticky top-0 z-20 bg-lira-purple">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <div className="rounded-xl bg-white px-3 py-1.5 shadow-sm">
          <Image
            src="/logo-100anos.png"
            alt="Lira Tênis Clube — 100 Anos"
            width={1000}
            height={417}
            priority
            className="h-10 w-auto"
          />
        </div>
        <Suspense
          fallback={
            <span className="text-sm font-bold uppercase tracking-wide text-lira-yellow">
              {[active.name, active.edition].filter(Boolean).join(" ")}
            </span>
          }
        >
          <TournamentSwitcher tournaments={tournaments} />
        </Suspense>
      </div>
    </header>
  );
}
