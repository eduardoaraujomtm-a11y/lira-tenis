-- =====================================================================
--  Migração 01 — adiciona o formato "somente grupos"
--  Rode no SQL Editor do Supabase (uma vez).
-- =====================================================================

-- Novo valor no enum de formato (além de 'mata_mata' e 'grupos_mata_mata')
alter type tourney_format add value if not exists 'grupos';
