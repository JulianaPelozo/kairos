-- Kairós — esquema inicial
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).

-- Estado completo do app por pessoa (perfil, cuidados, tarefas, ajustes).
-- Um único documento JSON mantém o app funcionando offline e simplifica a sincronização.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Histórico de autocuidado: cada vez que algo é marcado como feito.
create table if not exists public.care_logs (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null references auth.users (id) on delete cascade,
  care_id  text        not null,
  done_at  timestamptz not null default now(),
  source   text        not null default 'app' check (source in ('app', 'notificacao'))
);

create index if not exists care_logs_user_done_idx on public.care_logs (user_id, done_at desc);

-- Segurança: cada pessoa só enxerga e altera os próprios dados.
alter table public.app_state enable row level security;
alter table public.care_logs enable row level security;

create policy "app_state: dono lê"      on public.app_state for select using (auth.uid() = user_id);
create policy "app_state: dono insere"  on public.app_state for insert with check (auth.uid() = user_id);
create policy "app_state: dono altera"  on public.app_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "app_state: dono apaga"   on public.app_state for delete using (auth.uid() = user_id);

create policy "care_logs: dono lê"      on public.care_logs for select using (auth.uid() = user_id);
create policy "care_logs: dono insere"  on public.care_logs for insert with check (auth.uid() = user_id);
create policy "care_logs: dono apaga"   on public.care_logs for delete using (auth.uid() = user_id);
