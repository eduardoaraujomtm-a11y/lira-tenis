-- Horários próprios de cada dia do torneio.
-- Formato: { "2026-08-10": ["18:00","20:00"], "2026-08-13": ["15:00","16:30"] }
-- Dia sem entrada aqui usa a lista padrão em tournaments.slots.
-- Dia com lista VAZIA é dia sem jogos.
alter table public.tournaments
  add column if not exists slots_by_day jsonb not null default '{}'::jsonb;
