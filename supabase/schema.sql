-- =====================================================================
--  Lira Tênis Clube — Torneio 100 Anos  |  Schema do banco (Supabase)
--  Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- =====================================================================

-- ---------- Tipos (enums) ----------
create type gender          as enum ('M', 'F');
create type competitor_type as enum ('simples', 'duplas');
create type tourney_format  as enum ('grupos_mata_mata', 'mata_mata');
create type match_status    as enum ('agendado', 'ao_vivo', 'finalizado', 'wo');
create type match_phase     as enum ('grupo', 'oitavas', 'quartas', 'semi', 'final', 'terceiro');

-- ---------- Torneio ----------
create table tournaments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  club       text not null,
  edition    text,
  days       date[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- Categorias ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name        text not null,
  short_name  text not null,
  gender      gender not null,
  type        competitor_type not null default 'duplas',
  format      tourney_format  not null default 'mata_mata',
  -- Regras de placar (best_of_sets, games_per_set, tiebreak_to, super_tiebreak, super_tiebreak_to, no_ad)
  rule        jsonb not null default
    '{"bestOfSets":3,"gamesPerSet":6,"tiebreakTo":7,"superTiebreak":true,"superTiebreakTo":10,"noAd":false}',
  sort_order  int not null default 0
);

-- ---------- Quadras ----------
create table courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name          text not null
);

-- ---------- Atletas ----------
create table athletes (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  photo_url text
);

-- ---------- Competidores (dupla ou jogador simples) ----------
create table competitors (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  seed        int,
  group_id    text          -- 'A', 'B', ... quando há fase de grupos
);

-- Vínculo competidor <-> atletas (1 para simples, 2 para duplas)
create table competitor_athletes (
  competitor_id uuid not null references competitors(id) on delete cascade,
  athlete_id    uuid not null references athletes(id)    on delete cascade,
  position      int  not null default 1,
  primary key (competitor_id, athlete_id)
);

-- ---------- Jogos ----------
create table matches (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories(id) on delete cascade,
  phase         match_phase not null,
  group_id      text,
  round         int,
  court_id      uuid references courts(id) on delete set null,
  day           date not null,
  time          text not null,                       -- 'HH:mm'
  status        match_status not null default 'agendado',
  competitor_a  uuid references competitors(id) on delete set null,
  competitor_b  uuid references competitors(id) on delete set null,
  -- Placar por set: [{"a":6,"b":4,"tbA":null,"tbB":null}, ...]
  sets          jsonb not null default '[]',
  -- Game em andamento (ao vivo): {"server":"A","a":"30","b":"40"}
  live          jsonb,
  winner_id     uuid references competitors(id) on delete set null,
  -- Avanço no mata-mata
  next_match_id uuid references matches(id) on delete set null,
  next_slot     char(1),                             -- 'A' ou 'B'
  updated_at    timestamptz not null default now()
);

create index on matches (category_id);
create index on matches (status);
create index on matches (day);

-- Mantém updated_at em dia (útil pro realtime saber o que mudou)
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger matches_touch before update on matches
  for each row execute function touch_updated_at();

-- =====================================================================
--  Realtime: publica alterações da tabela matches (placar ao vivo)
-- =====================================================================
alter publication supabase_realtime add table matches;

-- =====================================================================
--  RLS — público LÊ tudo; apenas usuários autenticados ESCREVEM
-- =====================================================================
alter table tournaments        enable row level security;
alter table categories         enable row level security;
alter table courts             enable row level security;
alter table athletes           enable row level security;
alter table competitors        enable row level security;
alter table competitor_athletes enable row level security;
alter table matches            enable row level security;

-- Leitura pública (anon + authenticated)
create policy "leitura publica" on tournaments        for select using (true);
create policy "leitura publica" on categories         for select using (true);
create policy "leitura publica" on courts             for select using (true);
create policy "leitura publica" on athletes           for select using (true);
create policy "leitura publica" on competitors        for select using (true);
create policy "leitura publica" on competitor_athletes for select using (true);
create policy "leitura publica" on matches            for select using (true);

-- Escrita só para autenticados (organizadores/mesários fazem login)
create policy "escrita autenticada" on tournaments        for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on categories         for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on courts             for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on athletes           for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on competitors        for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on competitor_athletes for all to authenticated using (true) with check (true);
create policy "escrita autenticada" on matches            for all to authenticated using (true) with check (true);
