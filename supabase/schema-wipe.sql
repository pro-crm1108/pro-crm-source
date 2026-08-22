-- ============================================================
-- ПРО CRM · Полная очистка данных (по ПИН-коду, только директор)
-- Вставьте весь этот файл в SQL Editor и нажмите Run.
-- Скрипт безопасен для повторного запуска.
-- ============================================================

-- 1) Хранилище ПИН-кода (одна строка). Прямой доступ запрещён всем —
--    ПИН проверяется только внутри функции wipe_all_data.
create table if not exists public.wipe_config (
  id int primary key default 1,
  pin text not null default '0880'
);

insert into public.wipe_config (id, pin) values (1, '0880')
on conflict (id) do nothing;

alter table public.wipe_config enable row level security;
drop policy if exists "team" on public.wipe_config;
drop policy if exists "director" on public.wipe_config;

-- 2) Функция полной очистки: проверяет директора и ПИН, затем удаляет ВСЁ.
--    (Версия с поставками — в schema-warehouse.sql — перезаписывает эту.)
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

-- Готово! Должно появиться зелёное «Success».
