import { BrandMark } from "./Brand";

const tournament = { club: "Lira Tênis Clube", name: "Torneio 100 Anos" };

export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-lira-purple text-white">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <BrandMark size={42} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-lira-yellow">
            {tournament.club}
          </p>
          <h1 className="text-lg font-extrabold tracking-tight">
            {tournament.name}
            <span className="ml-2 align-middle text-xs font-medium text-white/70">
              · 100 anos
            </span>
          </h1>
        </div>
      </div>
    </header>
  );
}
