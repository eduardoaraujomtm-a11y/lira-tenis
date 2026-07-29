import { CategoriasManager } from "./CategoriasManager";

export const metadata = { title: "Chaveamento · Lira Tênis" };

export default function ChaveamentoPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">Chaveamento</h1>
      <CategoriasManager />
    </div>
  );
}
