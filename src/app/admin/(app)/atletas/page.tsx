import { AtletasManager } from "./AtletasManager";

export const metadata = { title: "Atletas · Lira Tênis" };

export default function AtletasPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">Atletas</h1>
      <AtletasManager />
    </div>
  );
}
