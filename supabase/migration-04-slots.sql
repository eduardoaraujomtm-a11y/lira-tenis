-- Slots de horário do torneio (editáveis pelo organizador).
-- Cada string é um horário HH:mm (ex: "09:00"). Se vazio, o app usa um padrão.
alter table public.tournaments
  add column if not exists slots text[] not null default array[
    '09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30'
  ];
