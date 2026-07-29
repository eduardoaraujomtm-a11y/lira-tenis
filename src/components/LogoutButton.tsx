"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="rounded-lg border border-white/30 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/10"
    >
      Sair
    </button>
  );
}
