-- ПРО CRM · колонка «Доставка» у поставок
-- Исправляет ошибку: "Could not find the 'delivery' column of 'supplies'".
-- Безопасен для повторного запуска.

alter table public.supplies add column if not exists delivery float8;

-- Готово! Должно появиться зелёное «Success».
