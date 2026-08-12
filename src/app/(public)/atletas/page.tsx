import Link from "next/link";
import { getAllAthletes } from "@/lib/repo";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { AtletaSearch } from "./AtletaSearch";

export const metadata = { title: "Atletas · Lira Tênis" };

export default async function AtletasPage() {
  const athletes = await getAllAthletes();

  return (
    <div>
      <RealtimeRefresher />
      <h2 className="mb-1 text-xl font-extrabold">Atletas</h2>
      <p className="mb-4 text-sm text-muted">
        {athletes.length} atletas participando do torneio.
      </p>
      <AtletaSearch athletes={athletes} />
    </div>
  );
}
