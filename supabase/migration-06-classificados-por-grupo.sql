-- Quantidade de competidores que se classificam de cada grupo para o mata-mata.
-- 2 = semi direto pra quem tem 4 classificados no total (2 grupos x 2), ou final
-- direto com 1 grupo x 2. 4 = mais rodadas (semi entra automaticamente quando
-- o total de classificados permitir).
alter table public.categories
  add column if not exists qualifiers_per_group int not null default 2;
