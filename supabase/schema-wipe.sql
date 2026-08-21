-- ============================================================
--  ПРО CRM · Полная очистка данных (только директор, по ПИН-коду)
--  Вставьте весь файл в SQL Editor и нажмите Run.
--  Скрипт безопасен для повторного запуска.
--
--  ПИН-код хранится в базе и проверяется НА СЕРВЕРЕ,
--  поэтому его не видно в коде приложения. По умолчанию: 0880
-- ============================================================

-- Хранилище ПИН-кода (одна строка). Прямой доступ запрещён всем —
-- читают только служебные функции ниже.
create table if not exists public.wipe_config (
  id int primary key default 1,
  pin text not null default '0880'
);
insert into public.wipe_config (id, pin) values (1, '0880') on conflict (id) do nothing;
alter table public.wipe_config enable row level security;
-- политик чтения НЕ создаём: никто не может прочитать ПИН напрямую

-- Полный сброс «с чистого листа». Удаляет ВСЁ:
--   уведомления, приглашения, платежи, работы, задачи, объекты, сделки, клиентов,
--   профили ВСЕХ сотрудников (включая директора), должности, воронку, каталог
--   товаров, настройки и ключ ИИ.
-- Сразу после этого CRM сама вернёт в базу заводские справочники
-- (стандартную воронку, должности, каталог и настройки) — структура останется
-- рабочей, а все введённые данные исчезнут. Следующий зарегистрированный
-- сотрудник автоматически получит роль «Директор».
create or replace function public.wipe_all_data(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  -- только директор
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

  -- операционные данные
  delete from public.notifications;
  delete from public.invites;
  delete from public.payments;
  delete from public.jobs;
  delete from public.tasks;
  delete from public.objects;
  delete from public.deals;
  delete from public.clients;
  -- сотрудники (все, включая директора — чтобы следующий вошедший стал Директором)
  delete from public.profiles;
  -- справочники и настройки (CRM вернёт заводские сразу после сброса)
  delete from public.roles;
  delete from public.settings;
  delete from public.stages;
  delete from public.products;
  delete from public.ai_config;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.wipe_all_data(text) to authenticated;

-- Готово! Должно появиться зелёное «Success».
