import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
      <p className="mx-auto w-full max-w-3xl px-4 pb-2 pt-1 text-right text-[9px] text-muted/50">
        © Eduardo Araújo
      </p>
      <BottomNav />
    </div>
  );
}
