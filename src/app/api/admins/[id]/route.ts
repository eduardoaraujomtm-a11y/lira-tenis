import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Remove um acesso (só organizador)
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (user.app_metadata?.role as string) ?? "organizador";
  if (role !== "organizador")
    return NextResponse.json({ error: "Apenas organizadores podem remover acessos." }, { status: 403 });

  const { id } = await ctx.params;
  if (id === user.id)
    return NextResponse.json(
      { error: "Você não pode remover a si mesmo." },
      { status: 400 }
    );

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao remover" },
      { status: 500 }
    );
  }
}
