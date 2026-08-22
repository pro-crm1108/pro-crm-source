-- ============================================================
-- ПРО CRM · Архив сделок + порядок колонок воронки
-- Вставьте весь этот файл в SQL Editor и нажмите Run.
-- Скрипт безопасен для повторного запуска.
-- ============================================================

-- 1) Архив: у сделки появляется статус «завершена» / «прервана».
--    NULL (по умолчанию) = сделка активна и видна в воронке.
alter table public.deals add column if not exists archived text;

-- 2) Порядок колонок воронки: каждая колонка хранит свою позицию,
--    чтобы порядок не сбрасывался и не «прыгал» после обновления из облака.
alter table public.stages add column if not exists pos float8;

-- 3) Проверка ПИН-кода для точечных операций (удаление сделки из архива).
--    ПИН хранится в wipe_config (та же таблица, что и для полной очистки).
create table if not exists public.wipe_config (
  id int primary key default 1,
  pin text not null default '0880'
);
insert into public.wipe_config (id, pin) values (1, '0880') on conflict (id) do nothing;
alter table public.wipe_config enable row level security;

create or replace function public.check_pin(p_pin text)
returns boolean
language sql security definer set search_path = public
stable as $$
  select exists (select 1 from public.wipe_config where id = 1 and pin = p_pin);
$$;

grant execute on function public.check_pin(text) to authenticated;

-- Готово! Должно появиться зелёное «Success».
