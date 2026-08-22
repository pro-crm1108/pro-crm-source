-- ============================================================
-- ПРО CRM · схема базы данных Supabase
-- Вставьте весь этот файл целиком в SQL Editor и нажмите Run.
-- Скрипт безопасен для повторного запуска.
-- ============================================================

-- Сотрудники (профили аккаунтов)
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  role text not null default 'Менеджер',
  color text not null default '#2ba184'
);
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists blocked boolean not null default false;
alter table public.profiles add column if not exists overrides jsonb;

-- Колонки воронки продаж
create table if not exists public.stages (
  id text primary key,
  title text not null,
  color text,
  pos float8
);

-- Каталог товаров и услуг
create table if not exists public.products (
  id text primary key,
  name text not null,
  unit text,
  price float8 not null default 0,
  kind text
);
alter table public.products add column if not exists photo text;
alter table public.products add column if not exists "purchasePrice" float8;
alter table public.products add column if not exists stock float8;
alter table public.products add column if not exists "lastSupplyPrice" float8;
alter table public.products add column if not exists "basePrice" float8;

-- Клиенты
create table if not exists public.clients (
  id text primary key,
  name text not null,
  kind text,
  phone text,
  email text,
  company text,
  comment text,
  "createdAt" timestamptz
);

-- Сделки
create table if not exists public.deals (
  id text primary key,
  title text,
  "clientId" text,
  "stageId" text,
  type text,
  comment text,
  estimate float8 default 0,
  source text,
  date timestamptz,
  "ownerId" text,
  items jsonb,
  "objectId" text,
  "createdAt" timestamptz
);
alter table public.deals add column if not exists log jsonb;
alter table public.deals add column if not exists archived text;

-- Объекты
create table if not exists public.objects (
  id text primary key,
  title text,
  address text,
  kind text,
  area text,
  "clientId" text,
  "dealId" text,
  status text,
  comment text,
  "startDate" timestamptz,
  "endDate" timestamptz
);

-- Задачи
create table if not exists public.tasks (
  id text primary key,
  title text,
  note text,
  due timestamptz,
  done boolean default false,
  "assigneeId" text,
  "dealId" text,
  "clientId" text,
  "createdAt" timestamptz,
  "overdueNotified" boolean default false
);

-- Работы на объектах
create table if not exists public.jobs (
  id text primary key,
  title text,
  "objectId" text,
  stage text,
  deadline timestamptz,
  "assigneeId" text,
  comment text
);

-- Платежи и расходы
create table if not exists public.payments (
  id text primary key,
  kind text,
  amount float8 default 0,
  date timestamptz,
  method text,
  "dealId" text,
  "clientId" text,
  category text,
  note text
);

-- Общие настройки (источники лидов, статусы объектов, уведомления, права)
create table if not exists public.settings (
  id int primary key default 1,
  "leadSources" jsonb,
  "objectStatuses" jsonb,
  "notifPrefs" jsonb,
  "rolePerms" jsonb
);

-- ============================================================
-- Защита данных: доступ к таблицам только вошедшим сотрудникам
-- ============================================================
alter table public.profiles enable row level security;
alter table public.stages enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.deals enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

drop policy if exists "team" on public.profiles;
drop policy if exists "team" on public.stages;
drop policy if exists "team" on public.products;
drop policy if exists "team" on public.clients;
drop policy if exists "team" on public.deals;
drop policy if exists "team" on public.objects;
drop policy if exists "team" on public.tasks;
drop policy if exists "team" on public.jobs;
drop policy if exists "team" on public.payments;
drop policy if exists "team" on public.settings;

create policy "team" on public.profiles for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.stages for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.products for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.clients for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.deals for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.objects for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.jobs for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.payments for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.settings for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- Должности и приглашения
-- ============================================================
create table if not exists public.roles (
  id text primary key,
  name text not null,
  color text not null default '#2ba184',
  "isSystem" boolean not null default false,
  permissions jsonb not null default '[]'::jsonb
);

create table if not exists public.invites (
  id text primary key,
  name text,
  email text not null,
  role text not null,
  token text not null unique,
  "createdBy" text,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null default (now() + interval '7 days'),
  "usedAt" timestamptz
);
alter table public.invites add column if not exists name text;

alter table public.roles enable row level security;
alter table public.invites enable row level security;

-- Уведомления (доставка в аккаунт сотрудника)
create table if not exists public.notifications (
  id text primary key,
  "userId" text not null,
  type text not null default 'system',
  title text not null,
  text text,
  "dealId" text,
  "taskId" text,
  read boolean not null default false,
  "createdAt" timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "read own" on public.notifications;
drop policy if exists "insert any" on public.notifications;
drop policy if exists "update own" on public.notifications;
drop policy if exists "delete own" on public.notifications;

create policy "read own" on public.notifications for select using (auth.uid()::text = "userId");
create policy "update own" on public.notifications for update using (auth.uid()::text = "userId");
create policy "delete own" on public.notifications for delete using (auth.uid()::text = "userId");

-- «Курьер»: доставляет уведомление в обход запрета писать в чужие строки
create or replace function public.notify_user(
  p_id text, p_user_id text, p_type text, p_title text,
  p_text text, p_deal_id text, p_task_id text, p_created_at timestamptz
) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (id, "userId", type, title, text, "dealId", "taskId", read, "createdAt")
  values (p_id, p_user_id, p_type, p_title, p_text, p_deal_id, p_task_id, false, p_created_at)
  on conflict (id) do nothing;
$$;

grant execute on function public.notify_user(text, text, text, text, text, text, text, timestamptz) to anon, authenticated;

drop policy if exists "team" on public.roles;
drop policy if exists "team" on public.invites;

create policy "team" on public.roles for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "team" on public.invites for all using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function public.lookup_invite(p_token text)
returns table(id text, name text, email text, role text, "expiresAt" timestamptz, "usedAt" timestamptz)
language sql security definer set search_path = public
stable as $$
  select id, name, email, role, "expiresAt", "usedAt"
  from public.invites
  where token = p_token and "usedAt" is null and "expiresAt" > now();
$$;

create or replace function public.redeem_invite(p_token text)
returns void
language sql security definer set search_path = public as $$
  update public.invites set "usedAt" = now()
  where token = p_token and "usedAt" is null;
$$;

grant execute on function public.lookup_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to anon, authenticated;

-- ============================================================
-- Живые обновления: изменения у одного сотрудника
-- мгновенно видны всем остальным
-- ============================================================
-- SET TABLE заменяет весь список таблиц публикации.
-- Эта команда работает во всех версиях PostgreSQL.
alter publication supabase_realtime set table
  public.profiles, public.stages, public.products, public.clients, public.deals,
  public.objects, public.tasks, public.jobs, public.payments, public.settings,
  public.roles, public.invites, public.notifications;

-- Готово! Должно появиться зелёное «Success». Можно закрывать SQL Editor.
