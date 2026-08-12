import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave service_role — PODE TUDO, ignora o RLS.
 * Uso EXCLUSIVO no servidor (route handlers). Nunca importar em componentes client.
 * A chave vem de SUPABASE_SERVICE_ROLE_KEY (variável de servidor, sem NEXT_PUBLIC).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
