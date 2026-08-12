-- =====================================================================
--  Migração 02 — torna a coluna "gender" das categorias opcional
--  Motivo: o formulário de criar categoria não envia gênero (o app não
--  usa mais esse campo), e a coluna era NOT NULL, barrando a criação.
--  Rode no SQL Editor do Supabase (uma vez).
-- =====================================================================

alter table categories alter column gender drop not null;
