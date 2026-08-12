import { AdminsManager } from "./AdminsManager";

export const metadata = { title: "Administradores · Lira Tênis" };

export default function AdministradoresPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold">Administradores</h1>
      <p className="mb-4 text-sm text-muted">
        Quem pode entrar no painel e gerenciar o torneio. Todos têm acesso total.
      </p>
      <AdminsManager />
    </div>
  );
}
