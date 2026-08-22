-- ============================================================
-- ПРО CRM · Склад (Товары)
-- Вставьте весь этот файл в SQL Editor и нажмите Run.
-- Скрипт безопасен для повторного запуска.
-- ============================================================

-- 1) Поставки товаров на склад
create table if not exists public.supplies (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  date timestamptz,
  note text,
  "createdAt" timestamptz
);
-- Стоимость доставки по поставке (распределяется на себестоимость)
alter table public.supplies add column if not exists delivery float8;

-- 2) Складские поля в карточке товара
alter table public.products add column if not exists photo text;
alter table public.products add column if not exists "purchasePrice" float8;
alter table public.products add column if not exists stock float8;
alter table public.products add column if not exists "lastSupplyPrice" float8;
alter table public.products add column if not exists "basePrice" float8;

-- 3) Журнал действий в сделке (бронирования, «Оплачено» и т.п.)
alter table public.deals add column if not exists log jsonb;

-- 4) Защита: доступ только вошедшим сотрудникам
alter table public.supplies enable row level security;

drop policy if exists "team" on public.supplies;

create policy "team" on public.supplies for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 5) Обновляем функцию полной очистки — добавляем в неё поставки
create or replace function public.wipe_all_data(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()::text
      and ( p.role = 'Директор'
         or p.role = (select r.name from public.roles r where r.id = 'role-director' limit 1) )
  ) then
    raise exception 'Удалять данные может только директор';
  end if;

  select pin = p_pin into v_ok from public.wipe_config where id = 1;
  if not coalesce(v_ok, false) then
    raise exception 'Неверный ПИН-код';
  end if;

  delete from public.notifications;
  delete from public.invites;
  delete from public.payments;
  delete from public.jobs;
  delete from public.tasks;
  delete from public.objects;
  delete from public.deals;
  delete from public.clients;
  delete from public.supplies;
  delete from public.profiles where id <> auth.uid()::text;
  delete from public.roles;
  delete from public.stages;
  delete from public.products;
  delete from public.settings;
  delete from public.ai_config;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.wipe_all_data(text) to authenticated;

-- 6) Живые обновления: поставки видны всем сотрудникам сразу
alter publication supabase_realtime set table
  public.profiles, public.stages, public.products, public.clients, public.deals,
  public.objects, public.tasks, public.jobs, public.payments, public.settings,
  public.roles, public.invites, public.notifications, public.supplies;

-- Готово! Должно появиться зелёное «Success».
