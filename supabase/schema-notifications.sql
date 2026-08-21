-- ============================================================
--  ПРО CRM · Уведомления (доставка в аккаунт сотрудника)
--  ВЕРСИЯ 2 — запись через служебную функцию notify_user.
--  Вставьте весь этот файл в SQL Editor и нажмите Run.
--  Скрипт безопасен для повторного запуска.
-- ============================================================

-- Уведомления: каждое адресовано конкретному сотруднику (userId)
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

-- Флаг «уже уведомляли о просрочке» в таблице задач,
-- чтобы не слать повторные сигналы (работает на всех устройствах)
alter table public.tasks add column if not exists "overdueNotified" boolean default false;

-- Защита данных
alter table public.notifications enable row level security;

drop policy if exists "read own" on public.notifications;
drop policy if exists "insert any" on public.notifications;
drop policy if exists "update own" on public.notifications;
drop policy if exists "delete own" on public.notifications;

-- читать можно только свои уведомления
-- (auth.uid()::text — приводим «пропуск» uuid к тексту, т.к. колонка "userId" текстовая)
create policy "read own" on public.notifications for select using (auth.uid()::text = "userId");
-- политика вставки больше не нужна — запись идёт через служебную функцию notify_user ниже
-- отмечать прочитанным / удалять — только свои
create policy "update own" on public.notifications for update using (auth.uid()::text = "userId");
create policy "delete own" on public.notifications for delete using (auth.uid()::text = "userId");

-- «Курьер»: доставляет уведомление получателю в обход запрета писать в чужие строки.
-- on conflict do nothing — если такое уведомление уже есть (прислали с другого устройства), дубль не создаётся.
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

-- Живая доставка: уведомление мгновенно приходит получателю.
-- SET TABLE заменяет весь список таблиц публикации (работает на всех версиях).
alter publication supabase_realtime set table
  public.profiles, public.stages, public.products, public.clients, public.deals,
  public.objects, public.tasks, public.jobs, public.payments, public.settings,
  public.roles, public.invites, public.notifications;

-- Готово! Должно появиться зелёное «Success».
