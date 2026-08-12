import Image from "next/image";
import { getTournamentInfo } from "@/lib/repo";

export async function Header() {
  const { name, edition } = await getTournamentInfo();
  const label = [name, edition].filter(Boolean).join(" ") || "Torneio";

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
        <span className="text-sm font-bold uppercase tracking-wide text-lira-yellow">
          {label}
        </span>
      </div>
    </header>
  );
}
