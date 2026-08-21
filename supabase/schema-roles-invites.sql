-- ============================================================
--  ПРО CRM · Должности и приглашения сотрудников
--  Вставьте весь этот файл в SQL Editor и нажмите Run.
--  Скрипт безопасен для повторного запуска.
-- ============================================================

-- Должности (название, цвет, набор прав)
create table if not exists public.roles (
  id text primary key,
  name text not null,
  color text not null default '#2ba184',
  "isSystem" boolean not null default false,
  permissions jsonb not null default '[]'::jsonb
);

-- Приглашения сотрудников (email + должность + секретный токен-ссылка)
create table if not exists public.invites (
  id text primary key,
  email text not null,
  role text not null,
  token text not null unique,
  "createdBy" text,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null default (now() + interval '7 days'),
  "usedAt" timestamptz
);

-- Поле «имя сотрудника» — добавится, даже если таблица уже была создана ранее
alter table public.invites add column if not exists name text;

-- Защита: доступ только вошедшим сотрудникам
alter table public.roles enable row level security;
alter table public.invites enable row level security;

drop policy if exists "team" on public.roles;
drop policy if exists "team" on public.invites;

create policy "team" on public.roles for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.invites for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Проверка ссылки-приглашения (работает ДО входа — для невошедших посетителей)
create or replace function public.lookup_invite(p_token text)
returns table(id text, name text, email text, role text, "expiresAt" timestamptz, "usedAt" timestamptz)
language sql security definer set search_path = public
stable as $$
  select id, name, email, role, "expiresAt", "usedAt"
  from public.invites
  where token = p_token and "usedAt" is null and "expiresAt" > now();
$$;

-- Пометить приглашение использованным (после регистрации)
create or replace function public.redeem_invite(p_token text)
returns void
language sql security definer set search_path = public as $$
  update public.invites set "usedAt" = now()
  where token = p_token and "usedAt" is null;
$$;

grant execute on function public.lookup_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to anon, authenticated;

-- Живые обновления: новые должности и приглашения видны всем сразу.
-- SET TABLE работает во всех версиях PostgreSQL.
alter publication supabase_realtime set table
  public.profiles, public.stages, public.products, public.clients, public.deals,
  public.objects, public.tasks, public.jobs, public.payments, public.settings,
  public.roles, public.invites;

-- Готово! Должно появиться зелёное «Success».
