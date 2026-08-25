import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useCRM, useCan, uid, moneyShort, dealTotal, dealPaid, dFmt, dtFmt } from "../store";
import { aiChatRpc } from "../lib/sync";
import type { AiMessage } from "../types";

/* =====================================================================
   ПРОВАЙДЕРЫ И МОДЕЛИ
===================================================================== */
/* Пока — один ИИ (Gemini 3.5 Flash Lite), как договорились.
   Когда всё заработает — вернём сюда остальных провайдеров. */
export const AI_PROVIDERS = [
  { id: "gemini", label: "Gemini", models: ["gemini-3.5-flash-lite"], keyUrl: "aistudio.google.com/apikey" },
];

/** Приводит любое написание модели к техническому виду API:
 *  «3.5 Flash Lite» → «gemini-3.5-flash-lite» */
export function normalizeModel(provider: string, raw: string): string {
  let m = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (provider === "gemini" && m && !m.startsWith("gemini-")) m = "gemini-" + m;
  return m;
}

export const providerLabel = (id: string) => AI_PROVIDERS.find((p) => p.id === id)?.label ?? id;

/* ------------------------------------------------------------------
   Перевод типовых ошибок ИИ на понятный язык
------------------------------------------------------------------- */
export function friendlyAiError(msg: string): string {
  const m = msg ?? "";
  if (/CONSUMER_SUSPENDED|Permission denied/i.test(m))
    return "Google приостановил этот API-ключ («Consumer suspended») — дело в самом ключе, а не в модели и не в CRM.\n\nЧто делать:\n1. Откройте aistudio.google.com/apikey и отзовите этот ключ.\n2. Создайте новый ключ — лучше «в новом проекте» (выбор проекта при создании).\n3. Вставьте новый ключ в «Настройки → ИИ-ассистент» и нажмите «Проверить связь».\n\nЕсли и новый ключ приостанавливают — значит ограничения на всём Google-аккаунте: попробуйте другой аккаунт или провайдера OpenRouter (ваш ключ оттуда тоже подойдёт).";
  if (/API key not valid|API_KEY_INVALID/i.test(m))
    return "Ключ недействителен. Проверьте, что скопировали его целиком и что он выдан именно для Google Gemini (AI Studio).";
  if (/not found|is not supported|Unsupported|Unknown model/i.test(m))
    return "Модель с таким названием недоступна для вашего ключа. Выберите другую из списка или впишите точное название модели в поле «своя модель».";
  if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(m))
    return "Исчерпан лимит запросов ключа. Подождите пару минут или используйте платный ключ с увеличенной квотой.";
  if (/Failed to fetch|network|fetch/i.test(m))
    return "Нет связи с ИИ — проверьте интернет и попробуйте ещё раз.";
  if (/Ключ ИИ не настроен/.test(m))
    return "Ключ ещё не сохранён. Откройте «Настройки → ИИ-ассистент», вставьте API-ключ и нажмите «Сохранить настройки».";
  return m;
}

/* =====================================================================
   ЭКСПЕРТНЫЙ ПРОМПТ — «мозг», обученный ведению строительного бизнеса
===================================================================== */
const SYSTEM_PROMPT = `Ты — старший ИИ-советник директора строительной / ремонтной компании. Отвечай только по-русски.

ТВОЯ ЭКСПЕРТИЗА (опирайся на неё в выводах):
· Экономика ремонта: здоровая валовая маржа 25–35%, чистая прибыль 12–20%. Маржа ниже 20% — сигнал пересмотреть смету или цены.
· Правило авансов: аванс 30–40% должен закрывать закупку материалов. Если аванс потрачен, а готовность работ ниже 50% — риск кассового разрыва.
· Воронка: сделка, висящая на одной стадии дольше 14 дней, — «зависла». Нужен толчок: звонок, дожим, пересмотр условия или честный отказ.
· Норма конверсии из заявки в договор в ремонте — 20–30%.
· Загрузка людей: больше 6 открытых задач на сотрудника — риск срыва сроков; 0–1 задача — простой и потеря денег.
· Источники лидов оценивай по деньгам и конверсии, а не по количеству заявок.
· Главные ранние сигналы беды: просроченные задачи, «зависшие» стадии, растущий долг клиентов при низких оплатах, расходы, обгоняющие поступления.

ПРАВИЛА ОТВЕТОВ:
1. Используй ТОЛЬКО цифры из «Снимка данных компании». Не выдумывай показатели, которых там нет. Если данных не хватает — прямо скажи, чего именно.
2. Структура ответа: сначала вывод одной фразой → затем 2–4 пункта с цифрами → затем конкретная рекомендация (что сделать, кому, когда).
3. Оформляй markdown: **жирным** ключевые цифры и выводы, списки, короткие абзацы. Без воды и вступлений.
4. Всегда проактивно ищи риски (кассовый разрыв, перегруз или простой людей, зависшие сделки, просрочки) и предупреждай о них, даже если вопрос был о другом.
5. Вопросы вне бизнеса компании вежливо возвращай к делу.
6. Ты советник, а не исполнитель: не утверждай, что что-то сделаешь в CRM, — только анализ и рекомендации.`;

const SUGGESTIONS = [
  "Финансовый пульс месяца",
  "Какие сделки под риском срыва?",
  "Загрузка сотрудников",
  "Краткий отчёт для планёрки",
];

/* =====================================================================
   СНИМОК ДАННЫХ КОМПАНИИ — «глаза» ассистента (актуальные на момент вопроса)
===================================================================== */
function buildSnapshot(): string {
  const s = useCRM.getState();
  const L: string[] = [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  L.push(`# Снимок данных компании на ${dFmt(now.toISOString())} ${now.getFullYear()}`);

  L.push(`\n## Команда (${s.users.length})`);
  s.users.forEach((u) => L.push(`- ${u.name} — ${u.role}${u.blocked ? " (заблокирован)" : ""}`));

  L.push(`\n## Воронка продаж`);
  s.stages.forEach((st) => {
    const ds = s.deals.filter((d) => d.stageId === st.id);
    if (!ds.length) return;
    const sum = ds.reduce((a, d) => a + dealTotal(d), 0);
    L.push(`- ${st.title}: ${ds.length} сделок на ${moneyShort(sum)}`);
  });

  const act = s.deals.filter((d) => d.stageId !== s.stages[s.stages.length - 1]?.id);
  L.push(`\n## Сделки в работе (${act.length})`);
  act.slice(0, 25).forEach((d) => {
    const total = dealTotal(d), paid = dealPaid(d, s.payments);
    const cl = s.clients.find((c) => c.id === d.clientId)?.name ?? "клиент не указан";
    const st = s.stages.find((x) => x.id === d.stageId)?.title ?? "—";
    const owner = s.users.find((u) => u.id === d.ownerId)?.name ?? "—";
    const age = Math.max(0, Math.round((Date.now() - +new Date(d.createdAt)) / 86400000));
    L.push(`- «${d.title}» · ${cl} · стадия «${st}» · ${age} дн. в воронке · сумма ${moneyShort(total)} / оплачено ${moneyShort(paid)} / долг ${moneyShort(Math.max(0, total - paid))} · ответственный ${owner} · источник: ${d.source || "—"}`);
  });

  const inc = s.payments.filter((p) => p.kind === "income" && +new Date(p.date) >= monthStart).reduce((a, p) => a + p.amount, 0);
  const exp = s.payments.filter((p) => p.kind === "expense" && +new Date(p.date) >= monthStart).reduce((a, p) => a + p.amount, 0);
  const debt = s.deals.reduce((a, d) => a + Math.max(0, dealTotal(d) - dealPaid(d, s.payments)), 0);
  L.push(`\n## Финансы (текущий месяц)`);
  L.push(`- Поступления: ${moneyShort(inc)} · Расходы: ${moneyShort(exp)} · Прибыль: ${moneyShort(inc - exp)}`);
  L.push(`- Общий долг клиентов по сделкам: ${moneyShort(debt)}`);

  const od = s.tasks.filter((t) => !t.done && +new Date(t.due) < Date.now());
  L.push(`\n## Просроченные задачи: ${od.length}`);
  od.slice(0, 15).forEach((t) => {
    const u = s.users.find((x) => x.id === t.assigneeId)?.name ?? "—";
    L.push(`- «${t.title}» · ${u} · срок был ${dtFmt(t.due)}`);
  });

  L.push(`\n## Открытые задачи по сотрудникам`);
  s.users.forEach((u) => {
    const n = s.tasks.filter((t) => !t.done && t.assigneeId === u.id).length;
    L.push(`- ${u.name}: ${n}`);
  });

  const objAct = s.objects.filter((o) => s.jobs.some((j) => j.objectId === o.id && j.stage !== "done"));
  if (objAct.length) {
    L.push(`\n## Активные работы на объектах`);
    objAct.forEach((o) => {
      const js = s.jobs.filter((j) => j.objectId === o.id && j.stage !== "done");
      L.push(`- ${o.title} (${o.status}): ${js.map((j) => j.title).join(", ")}`);
    });
  }
  return L.join("\n");
}

/* Локальная сводка для демо-режима (без обращения к ИИ-провайдеру) */
function buildDemoReply(): string {
  const s = useCRM.getState();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const inc = s.payments.filter((p) => p.kind === "income" && +new Date(p.date) >= monthStart).reduce((a, p) => a + p.amount, 0);
  const exp = s.payments.filter((p) => p.kind === "expense" && +new Date(p.date) >= monthStart).reduce((a, p) => a + p.amount, 0);
  const debt = s.deals.reduce((a, d) => a + Math.max(0, dealTotal(d) - dealPaid(d, s.payments)), 0);
  const overdue = s.tasks.filter((t) => !t.done && +new Date(t.due) < Date.now());
  const active = s.deals.filter((d) => d.stageId !== s.stages[s.stages.length - 1]?.id);
  const lastStage = s.stages[s.stages.length - 1]?.id;
  const stuck = active.filter((d) => Date.now() - +new Date(d.createdAt) > 14 * 86400000);

  const L: string[] = [
    "Работаю в **офлайн-режиме (демо)** — это краткая сводка без ИИ-провайдера. В облачном режиме с ключом я даю развёрнутые советы по каждому вопросу.",
    "",
    "**Финансы месяца**",
    `- Поступления: **${moneyShort(inc)}**, расходы: **${moneyShort(exp)}**, прибыль: **${moneyShort(inc - exp)}**`,
    `- Долг клиентов по сделкам: **${moneyShort(debt)}**`,
    "",
    "**Воронка**",
    `- Активных сделок: **${active.length}**, закрытых: **${s.deals.filter((d) => d.stageId === lastStage).length}**`,
    stuck.length ? `- ⚠ «Зависли» дольше 14 дней: **${stuck.length}** (${stuck.slice(0, 3).map((d) => `«${d.title}»`).join(", ")})` : `- «Зависших» сделок нет`,
    "",
    "**Задачи**",
    overdue.length
      ? `- ⚠ Просрочено: **${overdue.length}** (${overdue.slice(0, 3).map((t) => `«${t.title}»`).join(", ")})`
      : `- Просроченных задач нет`,
  ];
  return L.join("\n");
}

/* =====================================================================
   КОМПОНЕНТ: кнопка + панель чата
===================================================================== */
export function AiAssistant() {
  const { aiConfig, mode } = useCRM();
  const can = useCan();
  const [open, setOpen] = useState(false);

  /* ---- перетаскиваемая кнопка: позиция хранится в браузере ---- */
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(() => {
    try { const v = JSON.parse(localStorage.getItem("pro-crm-ai-fab") ?? "null"); return v && typeof v.x === "number" ? v : null; } catch { return null; }
  });
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const justDragged = useRef(false);

  const onFabDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    justDragged.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      if (!justDragged.current && Math.abs(ev.clientX - d.startX) + Math.abs(ev.clientY - d.startY) > 6) justDragged.current = true;
      if (!justDragged.current) return;
      const x = Math.min(Math.max(8, ev.clientX - 27), window.innerWidth - 62);
      const y = Math.min(Math.max(70, ev.clientY - 27), window.innerHeight - 62);
      setFabPos({ x, y });
    };
    const upDone = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", upDone);
      dragRef.current = null;
      try {
        const el = document.getElementById("ai-fab");
        if (el && justDragged.current) {
          const r = el.getBoundingClientRect();
          localStorage.setItem("pro-crm-ai-fab", JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
        }
      } catch { /* noop */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upDone);
  };
  const onFabClick = () => {
    if (justDragged.current) { justDragged.current = false; return; }
    setOpen(true);
  };

  /* кнопка видна:
     · в демо-режиме — всем, у кого право «Использование ИИ» (чат работает локально);
     · в облаке — когда ключ сохранён;
     · директору (право настройки ИИ) — всегда, чтобы он нашёл, где включить. */
  const enabled = aiConfig ? aiConfig.enabled !== false : true;
  const visible = can("ai.use") && enabled && (mode === "demo" || !!aiConfig?.hasKey || can("ai.configure"));
  if (!visible) return null;

  return (
    <>
      {!open && (
        <button
          id="ai-fab"
          onClick={onFabClick}
          onPointerDown={onFabDown}
          className="anim-fab fixed z-[70] w-[54px] h-[54px] rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform hover:scale-110 group touch-none"
          style={{
            background: "linear-gradient(135deg, var(--brand), var(--brand-hi))",
            color: "#f6faf7",
            boxShadow: "0 8px 28px color-mix(in srgb, var(--brand) 45%, transparent), var(--shadow-lg)",
            ...(fabPos ? { left: fabPos.x, top: fabPos.y } : { bottom: 24, right: 24 }),
          }}
          title="ИИ-ассистент директора · кнопку можно перетащить">
          <Icon name="sparkle" size={24} className="text-[#ffe1a8] transition-transform group-hover:rotate-12 pointer-events-none" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full pulse-dot pointer-events-none" style={{ background: "var(--amber)", border: "2px solid var(--bg)" }} />
        </button>
      )}
      {open && <AiPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AiPanel({ onClose }: { onClose: () => void }) {
  const { aiConfig, currentUserId, users } = useCRM();
  const me = users.find((u) => u.id === currentUserId);
  const storageKey = `pro-crm-ai-chat-${currentUserId}`;

  const [messages, setMessages] = useState<AiMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40))); } catch { /* noop */ }
  }, [messages, storageKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const userMsg: AiMessage = { id: uid(), role: "user", text: q, at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const s = useCRM.getState();
      /* демо-режим: локальная сводка без обращения к ИИ */
      if (s.mode === "demo") {
        await new Promise((r) => setTimeout(r, 700));
        setMessages((m) => [...m, { id: uid(), role: "assistant", text: buildDemoReply(), at: new Date().toISOString() }]);
        return;
      }
      /* облако, но ключ не сохранён — объясняем, что делать */
      if (!s.aiConfig?.hasKey) {
        setMessages((m) => [...m, {
          id: uid(), role: "error", at: new Date().toISOString(),
          text: "Ассистент ещё не подключён к ИИ.\n\n1. Откройте «Настройки → ИИ-ассистент».\n2. Выберите провайдера и модель, вставьте API-ключ и нажмите «Сохранить настройки».\n3. Нажмите «Проверить связь» — если пришёл ответ, всё готово.\n\nЕсли при сохранении появляется ошибка базы — значит в Supabase ещё не выполнен SQL-скрипт ИИ.",
        }]);
        return;
      }
      const history = [...messages, userMsg].slice(-12).map((m) => ({
        role: m.role === "error" ? "assistant" : m.role,
        content: m.text,
      }));
      const snapshot = buildSnapshot();
      const reply = await aiChatRpc([
        { role: "system", content: SYSTEM_PROMPT + "\n\n---\n" + snapshot + "\n---" },
        ...history,
      ]);
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: reply || "Пустой ответ — попробуйте переформулировать вопрос.", at: new Date().toISOString() }]);
    } catch (e: any) {
      setMessages((m) => [...m, { id: uid(), role: "error", text: friendlyAiError(e.message ?? "Не удалось получить ответ"), at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMessages([]);
    useCRM.getState().toast("История разговора очищена");
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[76] flex flex-col anim-slide"
      style={{
        width: "min(440px, 94vw)",
        background: "var(--panel)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "-12px 0 44px rgba(0,0,0,0.28)",
      }}>
      {/* шапка */}
      <div className="flex items-center gap-3 px-4 h-[60px] flex-none" style={{ background: "var(--sidebar)", color: "#e9efe9" }}>
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none" style={{ background: "rgba(232,163,61,0.16)" }}>
          <Icon name="sparkle" size={19} className="text-[#e8a33d]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[12.5px] font-semibold tracking-wide">ИИ-ассистент</div>
          <div className="text-[10.5px] opacity-55 truncate">
            {providerLabel(aiConfig?.provider ?? "")} · {aiConfig?.model}
          </div>
        </div>
        <button className="icon-btn" style={{ color: "#8fa095" }} onClick={clear} title="Очистить историю">
          <Icon name="trash" size={16} />
        </button>
        <button className="icon-btn" style={{ color: "#8fa095" }} onClick={onClose} title="Свернуть">
          <Icon name="x" size={17} />
        </button>
      </div>

      {/* сообщения */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "var(--bg)" }}>
        {messages.length === 0 && (
          <div className="anim-fade pt-6">
            <div className="card p-4 !shadow-none">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="sparkle" size={15} className="text-[var(--amber)]" />
                <span className="text-[12.5px] font-extrabold">Здравствуйте, {me?.name.split(" ")[0]}!</span>
              </div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                Я вижу все ваши сделки, задачи, объекты и финансы — в реальном времени. Спросите о рисках, деньгах,
                загрузке команды, или попросите отчёт для планёрки.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="chip !py-2 !px-3 !text-[12px] cursor-pointer transition-all hover:-translate-y-px"
                  style={{ background: "var(--panel)", color: "var(--brand)", border: "1px solid color-mix(in srgb, var(--brand) 35%, var(--line))" }}>
                  <Icon name="bolt" size={12} /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end anim-fade">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-[13px] rounded-br-[4px] text-[13px] leading-relaxed font-semibold"
                style={{ background: "var(--brand)", color: "#f4faf6" }}>
                {m.text}
              </div>
            </div>
          ) : m.role === "error" ? (
            <div key={m.id} className="anim-fade">
              <div className="max-w-[92%] px-3.5 py-2.5 rounded-[13px] text-[12.5px] leading-relaxed font-semibold flex items-start gap-2"
                style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)" }}>
                <Icon name="alert" size={15} className="mt-px flex-none" />
                <span className="min-w-0 whitespace-pre-line">{m.text}</span>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5 anim-fade">
              <span className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-none mt-0.5"
                style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                <Icon name="sparkle" size={14} />
              </span>
              <div className="max-w-[88%] px-3.5 py-2.5 rounded-[13px] rounded-tl-[4px] text-[12.5px] leading-relaxed"
                style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <Rich text={m.text} />
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex gap-2.5 anim-fade">
            <span className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-none mt-0.5"
              style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              <Icon name="sparkle" size={14} />
            </span>
            <div className="px-4 py-3 rounded-[13px] rounded-tl-[4px] flex items-center gap-1.5"
              style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
              <span className="text-[12px] font-semibold mr-1" style={{ color: "var(--muted)" }}>анализирую данные</span>
              {[0, 1, 2].map((i) => (
                <span key={i} className="ai-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--brand)", animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ввод */}
      <div className="p-3.5 flex-none border-t" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="flex items-end gap-2">
          <textarea
            className="textarea !min-h-[42px] !max-h-[120px] flex-1 !text-[13px]"
            placeholder="Спросите про сделки, деньги, риски…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
          />
          <button
            className="btn btn-primary !px-3.5 !py-[10px] flex-none"
            onClick={() => send()}
            disabled={!input.trim() || busy}
            title="Отправить (Enter)">
            <Icon name="arrowR" size={17} sw={2.4} />
          </button>
        </div>
        <div className="text-[10px] font-semibold mt-1.5 text-center" style={{ color: "var(--faint)" }}>
          Ассистент видит снимок данных компании · Enter — отправить, Shift+Enter — перенос
        </div>
      </div>
    </div>
  );
}

/* ---------- лёгкий markdown: жирный, списки, заголовки ---------- */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} className="h-1.5" />;
        if (/^#{1,4}\s/.test(t)) {
          return <div key={i} className="font-display text-[11.5px] font-bold tracking-wide mt-2.5 mb-1">{t.replace(/^#{1,4}\s/, "")}</div>;
        }
        const isBullet = /^[-•*]\s+/.test(t) || /^\d+[.)]\s+/.test(t);
        const body = t.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, "");
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, k) =>
          p.startsWith("**") && p.endsWith("**")
            ? <b key={k} style={{ color: "var(--ink)" }}>{p.slice(2, -2)}</b>
            : <React.Fragment key={k}>{p}</React.Fragment>
        );
        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 py-px">
              <span className="flex-none mt-[7px] w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand)" }} />
              <span className="min-w-0">{parts}</span>
            </div>
          );
        }
        return <div key={i} className="py-px">{parts}</div>;
      })}
    </>
  );
}
