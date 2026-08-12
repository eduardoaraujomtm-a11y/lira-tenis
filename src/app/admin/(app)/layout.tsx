import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/AdminNav";

export const metadata = { title: "Painel · Lira Tênis" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const role = (user.app_metadata?.role as string) ?? "organizador";
  const isMesario = role === "mesario";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 bg-lira-purple-dark text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-lira-yellow">
              {isMesario ? "Painel do mesário" : "Painel do organizador"}
            </p>
            <Link href="/admin" className="text-base font-extrabold">
              Mesa de jogos
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs font-semibold text-white/80 hover:text-white">
              Ver site ↗
            </Link>
            <LogoutButton />
          </div>
        </div>
        <AdminNav isMesario={isMesario} />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
      <p className="mx-auto w-full max-w-3xl px-4 pb-3 pt-2 text-right text-[9px] text-muted/50">
        © Eduardo Araújo
      </p>
    </div>
  );
}
