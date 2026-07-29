import { TorneioSettings } from "./TorneioSettings";

export const metadata = { title: "Torneio · Lira Tênis" };

export default function TorneioPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold">Configurações do torneio</h1>
      <p className="mb-4 text-sm text-muted">
        Dados gerais, dias de jogo e quadras do clube.
      </p>
      <TorneioSettings />
    </div>
  );
}
