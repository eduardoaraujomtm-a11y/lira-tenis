import Link from "next/link";
import { AgendaEditor } from "./AgendaEditor";

export const metadata = { title: "Agenda · Lira Tênis" };

export default function AdminAgendaPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold">Agenda</h1>
      <p className="mb-4 text-sm text-muted">
        Ajuste dia, horário e quadra de cada jogo. As mudanças salvam sozinhas. Os
        dias e as quadras disponíveis são definidos em{" "}
        <Link href="/admin/torneio" className="font-semibold text-accent underline">
          Torneio
        </Link>
        .
      </p>
      <AgendaEditor />
    </div>
  );
}
