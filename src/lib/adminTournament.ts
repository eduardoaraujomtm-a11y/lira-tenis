/** Torneio que o organizador está editando no admin (guardado em cookie,
 *  para que páginas de servidor e de cliente concordem sobre o mesmo alvo). */
export const ADMIN_TID_COOKIE = "admin_tid";

/** Lê o id do torneio selecionado no admin (somente no navegador). */
export function readAdminTidCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)admin_tid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Grava o torneio selecionado (1 ano, caminho global). */
export function writeAdminTidCookie(id: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_TID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}
