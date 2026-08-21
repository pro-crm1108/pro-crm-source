-- ============================================================
--  ПРО CRM · Диагностика и самодиагностика доступа директора
--  Вставьте весь файл в SQL Editor и нажмите Run.
--  Скрипт безопасен для повторного запуска.
-- ============================================================

-- ------------------------------------------------------------
-- 1) whoami() — вызывается ИЗ CRM (кнопка «Диагностика аккаунта»
--    в Настройках) и честно показывает, что база «думает» о вас:
--    ваш id, имя, должность и проходит ли проверка директора.
-- ------------------------------------------------------------
create or replace function public.whoami()
returns jsonb
language plpgsql security definer set search_path = public
stable as $$
declare
  v_uid    text := auth.uid()::text;
  v_name   text;
  v_role   text;
  v_found  boolean := false;
  v_is_dir boolean := false;
  v_reason text;
begin
  select name, role into v_name, v_role
  from public.profiles where id = v_uid;

  if v_name is not null then
    v_found := true;
    v_is_dir :=
      v_role = 'Директор'
      or v_role = (select r.name from public.roles r where r.id = 'role-director' limit 1)
      or exists (
        select 1 from public.roles r
        where r.name = v_role
          and (r.permissions->>'ai.configure' in ('granted','own')
               or r.permissions->>'settings.full' in ('granted','own'))
      );
    if not v_is_dir then
      v_reason := 'Должность в базе — «' || coalesce(v_role, '—') || '», а требуется «Директор»';
    end if;
  else
    v_reason := 'Запись сотрудника с таким id вообще не найдена в таблице profiles';
  end if;

  return jsonb_build_object(
    'uid', v_uid,
    'found', v_found,
    'name', v_name,
    'role', v_role,
    'is_director', v_is_dir,
    'reason', v_reason,
    'all_profiles', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
                              from public.profiles order by name), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 2) save_ai_config — та же функция сохранения настроек ИИ,
--    но теперь при отказе ОНА САМА говорит причину:
--    «ваша должность в базе такая-то» или «запись не найдена».
-- ------------------------------------------------------------
create or replace function public.save_ai_config(
  p_provider text, p_model text, p_api_key text, p_enabled boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_role text; v_is_director boolean := false;
begin
  select name, role into v_name, v_role
  from public.profiles where id = auth.uid()::text;

  if v_name is null then
    raise exception 'Не получается сохранить: запись вашего сотрудника не найдена в базе (id: %). Нажмите «Диагностика аккаунта» в Настройках.', coalesce(auth.uid()::text, 'нет входа');
  end if;

  v_is_director :=
    v_role = 'Директор'
    or v_role = (select r.name from public.roles r where r.id = 'role-director' limit 1)
    or exists (
      select 1 from public.roles r
      where r.name = v_role
        and (r.permissions->>'ai.configure' in ('granted','own')
             or r.permissions->>'settings.full' in ('granted','own'))
    );

  if not v_is_director then
    raise exception 'Менять настройки ИИ может только директор. Ваша должность в базе: «%» (имя: %). Исправьте должность в Настройках → Сотрудники или через SQL.', coalesce(v_role, '—'), v_name;
  end if;

  p_model := replace(lower(trim(p_model)), ' ', '-');
  if p_provider = 'gemini' and p_model <> '' and p_model not like 'gemini-%' then
    p_model := 'gemini-' || p_model;
  end if;
  p_api_key := trim(coalesce(p_api_key, ''));

  insert into public.ai_config (id, provider, model, api_key, enabled)
  values (1, p_provider, p_model, p_api_key, p_enabled)
  on conflict (id) do update set
    provider = excluded.provider,
    model    = excluded.model,
    enabled  = excluded.enabled,
    api_key  = case when excluded.api_key = '' then public.ai_config.api_key
                    else excluded.api_key end;
end;
$$;

grant execute on function public.whoami() to authenticated;
grant execute on function public.save_ai_config(text, text, text, boolean) to authenticated;

-- Готово! Должно появиться зелёное «Success».
