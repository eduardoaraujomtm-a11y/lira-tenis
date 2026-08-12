-- =====================================================================
--  Migração 03 — papéis de acesso: "organizador" e "mesario"
--
--  organizador: acesso total (cadastros, chaves, agenda, exclusões, admins)
--  mesario:     só ATUALIZA jogos (placar) — nada de cadastros/exclusões
--
--  O papel vem do app_metadata.role do usuário (no JWT). Sem papel = organizador
--  (assim os administradores atuais continuam com acesso total).
--  Rode no SQL Editor do Supabase (uma vez).
-- =====================================================================

create or replace function public.user_role() returns text
language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'organizador');
$$;

-- ---- Substitui as políticas de escrita "para qualquer autenticado" ----
-- Tabelas de cadastro: só organizador escreve
do $$
declare t text;
begin
  foreach t in array array[
    'tournaments','categories','courts','athletes','competitors','competitor_athletes'
  ] loop
    execute format('drop policy if exists "escrita autenticada" on %I', t);
    execute format('drop policy if exists "escrita organizador" on %I', t);
    execute format(
      'create policy "escrita organizador" on %I for all to authenticated
         using (public.user_role() = ''organizador'')
         with check (public.user_role() = ''organizador'')', t);
  end loop;
end $$;

-- Jogos: organizador faz tudo; mesário pode ATUALIZAR (placar)
drop policy if exists "escrita autenticada" on matches;
drop policy if exists "matches organizador" on matches;
drop policy if exists "matches mesario update" on matches;

create policy "matches organizador" on matches for all to authenticated
  using (public.user_role() = 'organizador')
  with check (public.user_role() = 'organizador');

create policy "matches mesario update" on matches for update to authenticated
  using (public.user_role() = 'mesario')
  with check (public.user_role() = 'mesario');

-- Leitura pública continua valendo (políticas "leitura publica" já existentes).
