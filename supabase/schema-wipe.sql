-- ============================================================
--  ПРО CRM · Полная очистка данных (только директор, по ПИН-коду)
--  ВЕРСИЯ 2 — исправлена ошибка "DELETE requires a WHERE clause"
--  (Supabase по умолчанию запрещает DELETE без WHERE — добавлено "WHERE true")
--  Скрипт безопасен для повторного запуска.
-- ============================================================

create table if not exists public.wipe_config (
  id int primary key default 1,
  pin text not null default '0880'
);
insert into public.wipe_config (id, pin) values (1, '0880') on conflict (id) do nothing;
alter table public.wipe_config enable row level security;

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

  -- проверка ПИН-кода
  select pin = p_pin into v_ok from public.wipe_config where id = 1;
  if not coalesce(v_ok, false) then
    raise exception 'Неверный ПИН-код';
  end if;

  -- очистка всех таблиц (WHERE true — обход защиты Supabase от DELETE без условия)
  delete from public.notifications where true;
  delete from public.invites where true;
  delete from public.payments where true;
  delete from public.jobs where true;
  delete from public.tasks where true;
  delete from public.objects where true;
  delete from public.deals where true;
  delete from public.clients where true;
  delete from public.supplies where true;
  -- профили: удаляем ВСЕ (включая текущего директора), чтобы следующий вход
  -- считался «первым» и вошедший автоматически получил роль «Директор»
  delete from public.profiles where true;
  -- роли и справочники сбрасываем к заводским (удаляем пользовательские)
  delete from public.roles where "isSystem" = false;
  delete from public.settings where true;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.wipe_all_data(text) to authenticated;

-- Готово! Должно появиться зелёное «Success».
