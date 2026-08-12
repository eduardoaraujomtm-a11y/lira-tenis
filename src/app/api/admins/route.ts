import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Role = "organizador" | "mesario";

/** Retorna o usuário logado e seu papel (default: organizador). */
async function getCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = (user.app_metadata?.role as Role) ?? "organizador";
  return { user, role };
}

// Lista os administradores (só organizador)
export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (caller.role !== "organizador")
    return NextResponse.json({ error: "Apenas organizadores podem ver os acessos." }, { status: 403 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: (u.user_metadata?.name as string) ?? "",
      role: (u.app_metadata?.role as Role) ?? "organizador",
      createdAt: u.created_at,
    }));
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao listar" },
      { status: 500 }
    );
  }
}

// Cria um novo acesso com papel (só organizador)
export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (caller.role !== "organizador")
    return NextResponse.json({ error: "Apenas organizadores podem criar acessos." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role: Role = body.role === "mesario" ? "mesario" : "organizador";

  if (!email || password.length < 6)
    return NextResponse.json(
      { error: "Informe e-mail e uma senha de pelo menos 6 caracteres." },
      { status: 400 }
    );

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role },
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar" },
      { status: 500 }
    );
  }
}
