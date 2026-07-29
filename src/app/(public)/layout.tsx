import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
