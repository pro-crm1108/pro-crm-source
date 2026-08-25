import { supabase } from "./supabase";

export const TABLES = [
  "profiles", "stages", "products", "clients", "deals",
  "objects", "tasks", "jobs", "payments", "supplies", "roles", "invites", "notifications",
] as const;
export type Table = (typeof TABLES)[number] | "settings";

let onError: ((msg: string) => void) | null = null;
export const setSyncErrorHandler = (fn: (msg: string) => void) => { onError = fn; };
const fail = (e: any, ctx: string) => { if (e) onError?.(`Ошибка синхронизации (${ctx}): ${e.message ?? e}`); };

/* ---------- чтение ----------
   Устойчиво к «отстающей» базе: если какой-то таблицы ещё нет
   (не выполнен новый SQL-скрипт), она пропускается, а вход не ломается. */
export async function fetchAll(): Promise<{ rows: Record<string, any[]>; missing: string[] }> {
  const rows: Record<string, any[]> = {};
  const missing: string[] = [];
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) {
      if (error.code === "42P01" || /does not exist/i.test(error.message)) {
        missing.push(t);
        rows[t] = [];
        continue;
      }
      throw error;
    }
    rows[t] = (data ?? []) as any[];
  }
  const { data: st, error: se } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (se && se.code !== "42P01") throw se;
  rows.settings = st ? [st] : [];
  return { rows, missing };
}

/* ---------- запись ---------- */
export function pushUpsert(table: Table, row: any) {
  supabase.from(table).upsert(row).then(({ error }) => fail(error, table));
}
export function pushDelete(table: Table, id: string) {
  supabase.from(table).delete().eq("id", id).then(({ error }) => fail(error, table));
}
export function pushSettings(s: { leadSources: string[]; expenseCats?: string[]; objectStatuses: string[]; notifPrefs: any; rolePerms: any }) {
  pushUpsert("settings", { id: 1, ...s });
}

/** Строка сотрудника: только колонки таблицы profiles (включая сброс значений) */
export function profileRow(u: any) {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    color: u.color,
    phone: u.phone ?? null,
    email: u.email ?? null,
    blocked: !!u.blocked,
    overrides: u.overrides ?? {},
  };
}
export function pushProfile(u: any) {
  pushProfileAwait(u).catch((e) => fail(e, "profiles"));
}

/** Подтверждённая запись профиля: БРОСАЕТ ошибку, если база не приняла.
    Экран обновляется ТОЛЬКО после успешного подтверждения — рассинхрон невозможен. */
export async function pushProfileAwait(u: any): Promise<void> {
  const row = profileRow(u);
  let { error } = await supabase.from("profiles").upsert(row);
  if (error && /column/i.test(error.message)) {
    /* в базе старая схема — сохраняем базовые поля */
    ({ error } = await supabase.from("profiles").upsert({ id: u.id, name: u.name, role: u.role, color: u.color }));
  }
  if (error) throw new Error(error.message);
}

/** Текущая сессия Supabase (null, если вход не выполнен / демо-режим) */
export async function currentAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/* ---------- уведомления (запись — через служебную функцию notify_user, обходит RLS-запрет на чужие строки) ---------- */
export function pushNotification(n: { id: string; userId: string; type: string; title: string; text?: string; dealId?: string; taskId?: string; createdAt: string }) {
  supabase.rpc("notify_user", {
    p_id: n.id, p_user_id: n.userId, p_type: n.type, p_title: n.title,
    p_text: n.text ?? null, p_deal_id: n.dealId ?? null, p_task_id: n.taskId ?? null,
    p_created_at: n.createdAt,
  }).then(({ error }) => fail(error, "notifications"));
}
export function markNotificationReadRemote(id: string) {
  supabase.from("notifications").update({ read: true }).eq("id", id).then(({ error }) => fail(error, "notifications"));
}

/* ---------- полная очистка данных (только директор, по ПИН-коду) ---------- */
export async function wipeAllData(pin: string) {
  const { data, error } = await supabase.rpc("wipe_all_data", { p_pin: pin });
  if (error) throw new Error(error.message);
  return data;
}

/* Проверка ПИН-кода для точечных операций (удаление сделки из архива).
   true/false — если функция есть в базе; null — функции нет, решение за клиентом. */
export async function checkPin(pin: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("check_pin", { p_pin: pin });
  if (error) return null;
  return data === true;
}

/* ---------- ИИ-ассистент (ключ живёт только в базе, браузер его не видит) ---------- */
export async function fetchAiConfig(): Promise<{ provider: string; model: string; enabled: boolean; hasKey: boolean; keyHint: string } | null> {
  const { data, error } = await supabase.rpc("get_ai_config");
  if (error) return null;
  const d = (data ?? {}) as any;
  if (!d || Object.keys(d).length === 0) return null;
  return {
    provider: d.provider ?? "gemini",
    model: d.model ?? "",
    enabled: d.enabled ?? true,
    hasKey: !!d.has_key,
    keyHint: d.key_hint ?? "",
  };
}

export async function saveAiConfig(p: { provider: string; model: string; apiKey: string; enabled: boolean }) {
  const { error } = await supabase.rpc("save_ai_config", {
    p_provider: p.provider, p_model: p.model, p_api_key: p.apiKey, p_enabled: p.enabled,
  });
  if (error) throw new Error(friendlyAiError(error.message));
}

export async function aiChatRpc(messages: { role: string; content: string }[]): Promise<string> {
  const { data, error } = await supabase.rpc("ai_chat", { p_messages: messages });
  if (error) throw new Error(friendlyAiError(error.message));
  return (data as string) ?? "";
}

function friendlyAiError(msg: string): string {
  const m = (msg ?? "").replace(/^.*?Exception:\s*/i, "").replace(/^.*?error:\s*/i, "");
  if (/ключ не настроен|key not configured/i.test(m)) return "ИИ не настроен: укажите API-ключ в «Настройки → ИИ-ассистент»";
  if (/401|invalid api key|unauthorized/i.test(m)) return "Неверный API-ключ — проверьте его в настройках ИИ";
  if (/429|quota|rate limit/i.test(m)) return "Превышен лимит запросов к ИИ — подождите минуту или проверьте баланс у провайдера";
  if (/model.*not found|is not supported/i.test(m)) return "Модель не найдена у провайдера — проверьте название модели";
  if (/fetch|network|econnrefused/i.test(m)) return "Нет связи с сервисом ИИ — проверьте интернет";
  return m || "Сервис ИИ вернул ошибку";
}

/* ---------- приглашения (работают через функции БД, в т.ч. до входа) ---------- */
/* Самодиагностика: что база «думает» о текущем сотруднике */
export async function whoamiRpc() {
  const { data, error } = await supabase.rpc("whoami");
  if (error) throw new Error(error.message);
  return data as {
    uid: string | null;
    found: boolean;
    name: string | null;
    role: string | null;
    is_director: boolean;
    reason: string | null;
    all_profiles: { id: string; name: string; role: string }[];
  };
}

export async function lookupInvite(token: string) {
  const { data, error } = await supabase.rpc("lookup_invite", { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { id: string; name?: string; email: string; role: string; expiresAt: string; usedAt: string | null }) ?? null;
}
/** Создание приглашения с проверкой: если в базе нет таблиц — вернёт понятную ошибку */
export async function pushInvite(inv: any) {
  const { error } = await supabase.from("invites").upsert(inv);
  if (error) throw new Error(error.message);
}
export async function redeemInvite(token: string) {
  await supabase.rpc("redeem_invite", { p_token: token });
}
export function inviteLink(token: string) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?invite=${token}`;
}

/* ---------- первая выгрузка: всё, что сейчас в CRM, → в облако ---------- */
export async function uploadAll(snap: Record<string, any[]>, settings: any) {
  const order: [string, any[]][] = [
    ["profiles", snap.users], ["stages", snap.stages], ["products", snap.products],
    ["clients", snap.clients], ["deals", snap.deals], ["objects", snap.objects],
    ["tasks", snap.tasks], ["jobs", snap.jobs], ["payments", snap.payments],
  ];
  for (const [t, rows] of order) {
    if (rows?.length) {
      const { error } = await supabase.from(t).upsert(rows);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
  const { error } = await supabase.from("settings").upsert({ id: 1, ...settings });
  if (error) throw new Error(`settings: ${error.message}`);
}

/* ---------- живые обновления ---------- */
export function subscribeRemote(onChange: (table: string, action: string, row: any) => void): () => void {
  let ch = supabase.channel("pro-crm-rt");
  ([...TABLES, "settings"] as const).forEach((t) => {
    ch = ch.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, (p: any) => {
      onChange(t, p.eventType, p.eventType === "DELETE" ? p.old : p.new);
    }) as any;
  });
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* ---------- авторизация ---------- */
const PALETTE = ["#2ba184", "#c9862d", "#4c7fb5", "#b5566e", "#7d5bb5", "#3e8757", "#c94f42", "#39708f"];

export async function authLogin(email: string, password: string) {
  const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 15000);
  if (error) throw new Error(translateAuthError(error.message));
  return data.user!;
}

export async function authRegister(name: string, role: string, email: string, password: string) {
  const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }), 15000);
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.session) return { needConfirm: true as const };
  await ensureProfile(data.user!, name, role);
  return { needConfirm: false as const, user: data.user! };
}

/** Профиль сотрудника в базе (имя, роль, цвет, email). Создаётся при первом входе. */
export async function ensureProfile(user: any, nameHint?: string, roleHint?: string) {
  const authEmail = user.email ?? null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) {
    /* если email в профиле пустой — дозаполняем из почты аккаунта (актуально для приглашённых) */
    if (!data.email && authEmail) {
      await supabase.from("profiles").update({ email: authEmail }).eq("id", user.id);
      data.email = authEmail;
    }
    return data;
  }
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  const n = (count ?? 0) % PALETTE.length;
  const profile = {
    id: user.id,
    name: nameHint || (authEmail ?? "Сотрудник").split("@")[0],
    role: roleHint || ((count ?? 0) === 0 ? "Директор" : "Менеджер"),
    color: PALETTE[n],
    email: authEmail,
  };
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) throw new Error("Не удалось создать профиль: " + error.message);
  return profile;
}

export async function authLogout() { await supabase.auth.signOut(); }
/* обещание, которое отклоняется по таймауту — страховка от «вечно висящих» запросов */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Превышено время ожидания ответа от облака")), ms)),
  ]);
}

export async function authSession() {
  /* getSession() изредка «зависает» (проект на паузе, медленная сеть) —
     ограничиваем ожидание 6 секундами, чтобы загрузка сайта не стопорилась */
  const { data } = await withTimeout(supabase.auth.getSession(), 6000);
  return data.session;
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Неверный email или пароль";
  if (/already registered/i.test(msg)) return "Такой email уже зарегистрирован — войдите";
  if (/at least 6 characters/i.test(msg)) return "Пароль должен быть не короче 6 символов";
  if (/valid email/i.test(msg)) return "Введите корректный email";
  if (/rate limit/i.test(msg)) return "Слишком много попыток — подождите минуту";
  if (/fetch/i.test(msg)) return "Нет связи с облаком — проверьте интернет";
  return msg;
}
