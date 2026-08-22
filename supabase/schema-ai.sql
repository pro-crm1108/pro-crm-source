-- ============================================================
-- ПРО CRM · ИИ-ассистент
-- Вставьте весь этот файл в SQL Editor и нажмите Run.
-- Скрипт безопасен для повторного запуска.
--
-- Как это устроено:
-- · таблица ai_config хранит провайдера, модель и API-ключ;
--   прямого доступа к ней нет ни у кого — только через функции ниже
--   (браузер никогда не видит ключ);
-- · функция ai_chat() сама ходит к выбранному ИИ-провайдеру
--   (Gemini / OpenAI / Claude / DeepSeek / OpenRouter).
-- ============================================================

-- Расширение для HTTP-запросов прямо из базы (в Supabase доступно по умолчанию)
create extension if not exists http with schema extensions;

-- Хранилище настроек ИИ (одна строка)
create table if not exists public.ai_config (
  id int primary key default 1,
  provider text not null default 'gemini',
  model text not null default 'gemini-3.5-flash-lite',
  api_key text not null default '',
  enabled boolean not null default true
);

-- Включаем защиту и НЕ создаём политик: прямой доступ к таблице запрещён всем.
-- Вся работа — только через функции ниже (security definer).
alter table public.ai_config enable row level security;
drop policy if exists "team" on public.ai_config;
drop policy if exists "director" on public.ai_config;

-- 1) Чтение настроек (ключ возвращается в виде маски) — любому вошедшему
create or replace function public.get_ai_config()
returns jsonb
language sql security definer set search_path = public
stable as $$
  select coalesce(
    jsonb_build_object(
      'provider', provider,
      'model', model,
      'enabled', enabled,
      'has_key', (api_key is not null and api_key <> ''),
      'key_hint', case when api_key is not null and length(api_key) > 8
                       then '••••' || right(api_key, 4) else '' end
    ),
    '{}'::jsonb
  )
  from public.ai_config where id = 1;
$$;

-- 2) Сохранение настроек — ТОЛЬКО директор.
--    Пустой ключ = «оставить старый».
create or replace function public.save_ai_config(
  p_provider text, p_model text, p_api_key text, p_enabled boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_director boolean;
begin
  select true into v_is_director
  from public.profiles p
  where p.id = auth.uid()::text
    and (
      p.role = 'Директор'
      or p.role = (select r.name from public.roles r where r.id = 'role-director' limit 1)
      or exists (
        select 1 from public.roles r
        where r.name = p.role
          and (r.permissions->>'ai.configure' in ('granted','own')
               or r.permissions->>'settings.full' in ('granted','own'))
      )
    )
  limit 1;

  if not coalesce(v_is_director, false) then
    raise exception 'Менять настройки ИИ может только директор';
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

-- 3) Сам разговор с ИИ
create or replace function public.ai_chat(p_messages jsonb)
returns text
language plpgsql security definer set search_path = extensions, public as $$
declare
  v_provider text;
  v_model    text;
  v_key      text;
  v_url      text;
  v_headers  extensions.http_header[];
  v_body     jsonb;
  v_status   int;
  v_content  text;
  v_ans      text;
  v_sys      text := '';
  v_contents jsonb := '[]'::jsonb;
  v_last_role text := '';
  v_last_text text := '';
  v_grole    text;
  rec        record;
begin
  select provider, model, api_key into v_provider, v_model, v_key
  from public.ai_config where id = 1;

  if v_key is null or v_key = '' then
    raise exception 'Ключ ИИ не настроен. Откройте: Настройки → ИИ-ассистент.';
  end if;

  v_model := replace(lower(trim(coalesce(v_model, ''))), ' ', '-');
  if v_provider = 'gemini' and v_model <> '' and v_model not like 'gemini-%' then
    v_model := 'gemini-' || v_model;
  end if;
  v_key := trim(v_key);

  if v_provider = 'gemini' then
    v_url := 'https://generativelanguage.googleapis.com/v1beta/models/'
             || v_model || ':generateContent?key=' || v_key;

    for rec in
      select value->>'role' as role, coalesce(value->>'content', '') as content
      from jsonb_array_elements(p_messages)
    loop
      if rec.role = 'system' then
        v_sys := v_sys || E'\n\n' || rec.content;
      else
        v_grole := case when rec.role = 'assistant' then 'model' else 'user' end;
        if v_grole = v_last_role then
          v_last_text := v_last_text || E'\n\n' || rec.content;
          v_contents := jsonb_set(
            v_contents,
            array[(jsonb_array_length(v_contents) - 1)::text, 'parts', '0', 'text'],
            to_jsonb(v_last_text)
          );
        else
          v_contents := v_contents || jsonb_build_array(jsonb_build_object(
            'role', v_grole,
            'parts', jsonb_build_array(jsonb_build_object('text', rec.content))
          ));
          v_last_role := v_grole;
          v_last_text := rec.content;
        end if;
      end if;
    end loop;

    v_body := jsonb_build_object(
      'contents', v_contents,
      'generationConfig', jsonb_build_object('temperature', 0.4, 'maxOutputTokens', 1500)
    );
    if trim(v_sys) <> '' then
      v_body := v_body || jsonb_build_object(
        'systemInstruction', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', trim(leading E'\n' from v_sys))))
      );
    end if;

    select status, content into v_status, v_content
    from extensions.http_post(v_url, v_body::text, 'application/json');

    if v_status between 200 and 299 then
      v_ans := v_content::jsonb -> 'candidates' -> 0 -> 'content' -> 'parts' -> 0 ->> 'text';
      if v_ans is null then
        v_ans := v_content::jsonb -> 'error' ->> 'message';
        raise exception 'Gemini вернул ошибку: %', coalesce(v_ans, left(v_content, 300));
      end if;
    else
      raise exception 'Ошибка Gemini (HTTP %): %', v_status, left(v_content, 400);
    end if;

  elsif v_provider = 'anthropic' then
    v_url := 'https://api.anthropic.com/v1/messages';
    v_headers := array[
      extensions.http_header('x-api-key', v_key),
      extensions.http_header('anthropic-version', '2023-06-01'),
      extensions.http_header('Content-Type', 'application/json')
    ];

    for rec in
      select value->>'role' as role, coalesce(value->>'content', '') as content
      from jsonb_array_elements(p_messages)
    loop
      if rec.role = 'system' then
        v_sys := v_sys || E'\n\n' || rec.content;
      else
        v_contents := v_contents || jsonb_build_array(jsonb_build_object('role', rec.role, 'content', rec.content));
      end if;
    end loop;

    v_body := jsonb_build_object('model', v_model, 'max_tokens', 1500, 'messages', v_contents);
    if trim(v_sys) <> '' then
      v_body := v_body || jsonb_build_object('system', trim(leading E'\n' from v_sys));
    end if;

    select status, content into v_status, v_content
    from extensions.http(row('POST', v_url, v_headers, 'application/json', v_body::text)::extensions.http_request);

    if v_status between 200 and 299 then
      v_ans := v_content::jsonb -> 'content' -> 0 ->> 'text';
      if v_ans is null then
        raise exception 'Claude вернул пустой ответ: %', left(v_content, 300);
      end if;
    else
      raise exception 'Ошибка Claude (HTTP %): %', v_status, left(v_content, 400);
    end if;

  else
    if v_provider = 'openai' then
      v_url := 'https://api.openai.com/v1/chat/completions';
    elsif v_provider = 'deepseek' then
      v_url := 'https://api.deepseek.com/chat/completions';
    else
      v_url := 'https://openrouter.ai/api/v1/chat/completions';
    end if;

    v_body := jsonb_build_object(
      'model', v_model,
      'messages', p_messages,
      'temperature', 0.4,
      'max_tokens', 1200
    );

    select status, content into v_status, v_content
    from extensions.http(row('POST', v_url,
      array[
        extensions.http_header('Authorization', 'Bearer ' || v_key),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json', v_body::text)::extensions.http_request);

    if v_status between 200 and 299 then
      v_ans := v_content::jsonb -> 'choices' -> 0 -> 'message' ->> 'content';
      if v_ans is null then
        raise exception 'ИИ вернул пустой ответ: %', left(v_content, 300);
      end if;
    else
      raise exception 'Ошибка ИИ (HTTP %): %', v_status, left(v_content, 400);
    end if;
  end if;

  return trim(v_ans);
end;
$$;

grant execute on function public.get_ai_config() to authenticated;
grant execute on function public.save_ai_config(text, text, text, boolean) to authenticated;
grant execute on function public.ai_chat(jsonb) to authenticated;

-- Готово! Должно появиться зелёное «Success».
-- Дальше: Настройки → ИИ-ассистент → выбрать провайдера, модель и вставить ключ.
