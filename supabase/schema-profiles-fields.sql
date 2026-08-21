-- ============================================================
--  ПРО CRM · Новые поля в таблице сотрудников (profiles)
--  Вставьте в SQL Editor и нажмите Run. Безопасен для повтора.
-- ============================================================

-- Телефон сотрудника
alter table public.profiles add column if not exists phone text;

-- Рабочий email
alter table public.profiles add column if not exists email text;

-- Блокировка сотрудника (заблокированный не сможет войти)
alter table public.profiles add column if not exists blocked boolean not null default false;

-- Личные права сотрудника (переопределения поверх прав должности)
alter table public.profiles add column if not exists overrides jsonb;

-- Готово! Должно появиться зелёное «Success».
