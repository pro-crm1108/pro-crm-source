import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Avatar, Seg, Modal } from "../components/ui";
import { useCRM, useCan, usePermScope, uid } from "../store";
import { authLogout, inviteLink, pushInvite, fetchAiConfig, saveAiConfig, aiChatRpc, wipeAllData } from "../lib/sync";
import { playNotifSound } from "../lib/sound";
import { PERMS, ROLE_COLORS, SCOPE_LABEL, SCOPE_SHORT } from "../lib/perms";
import { AI_PROVIDERS, friendlyAiError, normalizeModel } from "../components/assistant";
import type { RoleDef, Invite, PermScope, User } from "../types";

const NOTIF: { key: string; label: string; desc: string }[] = [
  { key: "overdue", label: "Просроченные задачи", desc: "Сигнал сразу, как задача просрочена" },
  { key: "newTask", label: "Новые задачи", desc: "Ответственный получает уведомление при назначении" },
  { key: "payments", label: "Платежи", desc: "Оповещение о каждом поступлении и расходе" },
  { key: "stage", label: "Смена стадии сделки", desc: "Когда сделка двигается по воронке" },
  { key: "sound", label: "Звук уведомлений", desc: "Мягкий сигнал при появлении всплывающего уведомления" },
  { key: "booking", label: "Бронь товара", desc: "Закупщику — о новых бронированиях со склада и нехватке товара" },
];

const copy = (text: string) => {
  navigator.clipboard?.writeText(text).catch(() => {});
  useCRM.getState().toast("Ссылка скопирована в буфер обмена");
};

export default function Settings() {
  const crm = useCRM();
  const can = useCan();
  const { users, currentUserId, theme, setTheme, logout, leadSources, addSource, removeSource, expenseCats, addExpenseCat, removeExpenseCat, objectStatuses, addObjectStatus, removeObjectStatus, notifPrefs, setNotifPref, roles, toast, loginDemo, mode } = crm;
  /* Защищённый поиск: если текущего пользователя вдруг нет в списке,
     берём первого — страница не упадёт с ошибкой «reading 'role'». */
  const me = users.find((u) => u.id === currentUserId) ?? users[0];
  /* директор — по имени должности или по системной записи */
  const isDirector = me?.role === "Директор" || me?.role === (roles.find((r) => r.id === "role-director")?.name ?? "");
  const [src, setSrc] = useState("");
  const [st, setSt] = useState("");
  const [expCat, setExpCat] = useState("");
  /* право управлять должностями и приглашениями (новые id прав) */
  const canManageRoles = can("settings.permissions") || can("roles.create") || can("roles.edit");
  const canInvite = can("staff.invite") || can("settings.invite");
  const doLogout = () => { if (mode === "cloud") authLogout().catch(() => {}); logout(); };

  return (
    <div className="p-6 max-w-[980px] mx-auto">
      <h1 className="font-display text-[22px] font-bold tracking-wide mb-5">Настройки</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* левая колонка: профиль + сотрудники */}
        <div className="flex flex-col gap-4">
        {/* profile */}
        <div className="card p-5">
          <SectionTitle icon="user" title="Профиль" />
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl mb-4" style={{ background: "var(--panel2)" }}>
            <Avatar user={me} size={46} ring />
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-extrabold">{me?.name ?? "Сотрудник"}</div>
              <span className="chip mt-1" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{me?.role ?? "—"}</span>
            </div>
            {mode === "demo" && (
              <select className="select !w-auto" value={currentUserId} onChange={(e) => { loginDemo(e.target.value); toast("Аккаунт переключён", "bell"); }} title="Сменить аккаунт">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
              </select>
            )}
            {mode === "cloud" && (
              <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                <Icon name="cloud" size={12} /> облако
              </span>
            )}
          </div>

          <div className="label">Тема оформления</div>
          <div className="flex items-center gap-3 mb-5">
            <Seg value={theme} onChange={(v) => { setTheme(v as any); }} options={[{ v: "light", t: "Светлая" }, { v: "dark", t: "Тёмная" }]} />
            <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              <Icon name={theme === "dark" ? "moon" : "sun"} size={14} /> {theme === "dark" ? "Тёмная активна" : "Светлая активна"}
            </span>
          </div>

          <button className="btn btn-danger w-full" onClick={doLogout}>
            <Icon name="logout" size={15} /> Выйти из аккаунта
          </button>
        </div>

        {/* employees — под профилем, заполняет левую колонку */}
        <EmployeesCard />
        </div>

        <div className="flex flex-col gap-4">
          {/* notifications — доступно по праву «Настройка уведомлений» */}
          {can("settings.notifications") && <div className="card p-5">
            <SectionTitle icon="bell" title="Настройка уведомлений" />
            <div className="space-y-1">
              {NOTIF.map((n) => (
                <div key={n.key} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--line)" }}>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold">{n.label}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{n.desc}</div>
                  </div>
                  {n.key === "sound" && (
                    <button className="btn btn-soft btn-sm" onClick={() => playNotifSound()} title="Прослушать сигнал">
                      <Icon name="volume" size={14} /> Проверить
                    </button>
                  )}
                  <button className={`toggle ${notifPrefs[n.key] ? "on" : ""}`} onClick={() => setNotifPref(n.key, !notifPrefs[n.key])} aria-label={n.label} />
                </div>
              ))}
            </div>
          </div>}

          {/* lead sources */}
          <div className="card p-5">
            <SectionTitle icon="funnel" title="Настройка прихода лидов" sub="Источники, доступные при создании сделки" />
            <div className="flex flex-wrap gap-2 mb-3">
              {leadSources.map((s) => (
                <span key={s} className="chip !py-1.5 !px-3 !text-[12px]" style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)" }}>
                  {s}
                  <button className="cursor-pointer opacity-50 hover:opacity-100 hover:text-[var(--red)]" onClick={() => { removeSource(s); toast(`Источник «${s}» удалён`); }} title="Удалить">
                    <Icon name="x" size={12} sw={2.4} />
                  </button>
                </span>
              ))}
              {leadSources.length === 0 && <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Список пуст — добавьте источник</span>}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Новый источник, например «Выставка»" value={src}
                onChange={(e) => setSrc(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && src.trim()) { addSource(src.trim()); setSrc(""); toast(`Источник «${src.trim()}» добавлен`); } }} />
              <button className="btn btn-primary" onClick={() => { if (src.trim()) { addSource(src.trim()); setSrc(""); toast("Источник добавлен"); } }}>
                <Icon name="plus" size={15} sw={2.4} />
              </button>
            </div>
          </div>

          {/* expense categories */}
          <div className="card p-5">
            <SectionTitle icon="wallet" title="Категории расходов" sub="Используются при оформлении расходов" />
            <div className="flex flex-wrap gap-2 mb-3">
              {expenseCats.map((c) => (
                <span key={c} className="chip !py-1.5 !px-3 !text-[12px]" style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)" }}>
                  {c}
                  <button className="cursor-pointer opacity-50 hover:opacity-100 hover:text-[var(--red)]"
                    onClick={() => { removeExpenseCat(c); toast(`Категория «${c}» удалена`); }} title="Удалить категорию">
                    <Icon name="x" size={12} sw={2.4} />
                  </button>
                </span>
              ))}
              {expenseCats.length === 0 && <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Список пуст — добавьте категорию</span>}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Новая категория, например «Спецтехника»" value={expCat}
                onChange={(e) => setExpCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && expCat.trim()) { addExpenseCat(expCat.trim()); setExpCat(""); toast(`Категория «${expCat.trim()}» добавлена`); } }} />
              <button className="btn btn-primary" onClick={() => { if (expCat.trim()) { addExpenseCat(expCat.trim()); setExpCat(""); toast("Категория добавлена"); } }}>
                <Icon name="plus" size={15} sw={2.4} />
              </button>
            </div>
          </div>

          {/* object statuses */}
          <div className="card p-5">
            <SectionTitle icon="building" title="Статусы объектов" sub="Используются в карточках объектов" />
            <div className="flex flex-wrap gap-2 mb-3">
              {objectStatuses.map((s) => (
                <span key={s} className="chip !py-1.5 !px-3 !text-[12px]" style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)" }}>
                  {s}
                  <button className="cursor-pointer opacity-50 hover:opacity-100 hover:text-[var(--red)]"
                    onClick={() => { removeObjectStatus(s); toast(`Статус «${s}» удалён`); }} title="Удалить статус">
                    <Icon name="x" size={12} sw={2.4} />
                  </button>
                </span>
              ))}
              {objectStatuses.length === 0 && <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Список пуст — добавьте статус</span>}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Новый статус, например «Гарантия»" value={st}
                onChange={(e) => setSt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && st.trim()) { addObjectStatus(st.trim()); setSt(""); toast(`Статус «${st.trim()}» добавлен`); } }} />
              <button className="btn btn-primary" onClick={() => { if (st.trim()) { addObjectStatus(st.trim()); setSt(""); toast("Статус добавлен"); } }}>
                <Icon name="plus" size={15} sw={2.4} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ИИ-ассистент */}
      <AiCard />

      {/* конструктор должностей и приглашения — по соответствующим правам */}
      {canManageRoles && <RolesConstructor />}
      {canInvite && <InvitesCard />}

      {!canManageRoles && !canInvite && (
        <div className="card p-5 mt-4" style={{ opacity: 0.9 }}>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              <Icon name="eye" size={16} />
            </span>
            <div>
              <div className="font-display text-[13px] font-semibold">Должности и приглашения</div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Управление должностями, правами и приглашениями доступно сотрудникам с соответствующим правом (обычно Директору).</div>
            </div>
          </div>
        </div>
      )}

      {/* опасная зона — только директору */}
      {isDirector && <DangerZone />}
    </div>
  );
}

/* ================= ОПАСНАЯ ЗОНА (полная очистка по ПИН-коду) ================= */
function DangerZone() {
  const { mode, wipeLocal, toast, users, currentUserId, logout } = useCRM();
  const me = users.find((u) => u.id === currentUserId);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doWipe = async () => {
    if (pin.length < 4) { setErr("Введите ПИН-код (4 цифры)"); return; }
    setBusy(true); setErr("");
    try {
      if (mode === "cloud") await wipeAllData(pin); // ПИН проверяется в базе
      else if (pin !== "0880") throw new Error("Неверный ПИН-код"); // демо: проверка локально
      wipeLocal();
      toast("Все данные удалены. CRM сброшена к заводскому состоянию.", "bell");
      setOpen(false); setPin("");
      setTimeout(async () => {
        await authLogout().catch(() => {});
        logout();
      }, 900);
    } catch (e: any) {
      setErr(e.message ?? "Не удалось удалить данные");
    } finally { setBusy(false); }
  };

  return (
    <div className="card p-5 mt-4" style={{ borderColor: "color-mix(in srgb, var(--red) 35%, var(--line))" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="font-display text-[13px] font-semibold">Опасная зона</div>
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              Сброс «с чистого листа»: удаляются все введённые данные{mode === "cloud" ? " из общей базы" : ""}, остаются только заводские справочники
            </div>
          </div>
        </div>
        <button className="btn btn-danger flex-none" onClick={() => { setOpen(true); setPin(""); setErr(""); }}>
          <Icon name="trash" size={14} /> Удалить все данные
        </button>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} width={420} icon="trash" title="Удаление всех данных">
          <div className="p-5">
            <div className="flex items-start gap-2.5 p-3 rounded-[10px] mb-4"
              style={{ background: "var(--red-soft)", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)" }}>
              <Icon name="alert" size={16} className="mt-px flex-none text-[var(--red)]" />
              <div className="text-[12px] font-semibold leading-relaxed" style={{ color: "var(--red)" }}>
                Будут безвозвратно удалены ВСЕ введённые данные: клиенты, сделки, задачи, объекты, работы, платежи,
                уведомления, приглашения{mode === "cloud" ? ", профили всех сотрудников (кроме вашего) и ключ ИИ" : ""}.
                После сброса CRM вернётся к заводским справочникам (стандартная воронка, должности, каталог и настройки) —
                как сразу после установки. Следующий зарегистрированный сотрудник автоматически получит роль «Директор».
              </div>
            </div>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
              {me?.name}, чтобы подтвердить удаление, введите ПИН-код директора:
            </div>
            <input
              className="input text-center !text-[20px] !font-extrabold tracking-[0.4em]"
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={pin} autoFocus
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && doWipe()}
            />
            {err && (
              <div className="flex items-center gap-2 mt-3 text-[12.5px] font-bold anim-pop" style={{ color: "var(--red)" }}>
                <Icon name="alert" size={15} /> {err}
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost flex-1" onClick={() => setOpen(false)}>Отмена</button>
              <button className="btn btn-danger flex-1" onClick={doWipe} disabled={busy}>
                {busy ? "Удаление…" : "Удалить безвозвратно"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= СОТРУДНИКИ (с учётом области действия прав) ================= */
function EmployeesCard() {
  const { users, currentUserId, roles, mode, openModal } = useCRM();
  const scope = usePermScope();

  const viewCardScope = scope("staff.viewCard");
  const viewListScope = scope("staff.view");

  const canOpenCard = (u: User) =>
    viewCardScope === "granted" || (viewCardScope === "own" && u.id === currentUserId);

  const showAll = viewListScope === "granted";
  const visible = showAll ? users : users.filter(canOpenCard);
  const sectionVisible = viewListScope !== "denied" || viewCardScope !== "denied";

  if (!sectionVisible) return null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle icon="users" title="Сотрудники" sub={mode === "cloud" ? "Общий список команды — каждый входит под своей почтой и паролем" : "Демо-режим: изменения сохраняются только в этом браузере"} />
        <span className="chip flex-none" style={{
          background: mode === "cloud" ? "var(--green-soft)" : "var(--panel2)",
          color: mode === "cloud" ? "var(--green)" : "var(--muted)",
        }}>
          <Icon name={mode === "cloud" ? "cloud" : "user"} size={12} /> {mode === "cloud" ? "облако · синхронизировано" : "локально"}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="text-[12.5px] font-semibold py-4 text-center rounded-[10px]" style={{ color: "var(--muted)", border: "1.5px dashed var(--line2)" }}>
          Вам недоступен просмотр карточек сотрудников
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((u) => {
            const urole = roles.find((r) => r.name === u.role);
            const openable = canOpenCard(u);
            const inner = (
              <>
                <Avatar user={u} size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-extrabold truncate">{u.name}</span>
                  <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>{u.phone || u.email || "контакты не заполнены"}</span>
                </span>
                <span className="chip flex-none" style={{ background: `${urole?.color ?? "#888"}22`, color: urole?.color ?? "var(--muted)" }}>{u.role}</span>
                {u.id === currentUserId && <span className="chip flex-none" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>это вы</span>}
                <Icon name={openable ? "chevR" : "lock"} size={15} className={`text-[var(--faint)] flex-none ${openable ? "group-hover:translate-x-0.5 transition-transform" : ""}`} />
              </>
            );
            return openable ? (
              <button key={u.id} onClick={() => openModal({ type: "employee", id: u.id })}
                className="w-full flex items-center gap-3 p-2.5 rounded-[10px] border cursor-pointer transition-all hover:-translate-y-px text-left group"
                style={{ borderColor: "var(--line)" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-lg)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow)")}>
                {inner}
              </button>
            ) : (
              <div key={u.id} className="w-full flex items-center gap-3 p-2.5 rounded-[10px] border opacity-55 text-left"
                style={{ borderColor: "var(--line)" }} title="Нет доступа к карточке">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {mode === "cloud" && (
        <p className="text-[11.5px] mt-3 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
          <Icon name="note" size={13} className="mt-px flex-none" />
          Список показывает только тех, чьи карточки вам разрешено просматривать согласно вашей должности.
        </p>
      )}
    </div>
  );
}

/* ================= ИИ-АССИСТЕНТ ================= */
function AiCard() {
  const { aiConfig, setAiConfig, toast, mode } = useCRM();
  const can = useCan();
  const canConfigure = can("ai.configure");
  const canUse = can("ai.use");
  if (!canUse && !canConfigure) return null;
  const isDemo = mode !== "cloud";

  const prov = AI_PROVIDERS.find((p) => p.id === (aiConfig?.provider ?? "gemini")) ?? AI_PROVIDERS[0];
  const curModel = aiConfig?.model ?? prov.models[0];
  const inList = prov.models.includes(curModel);

  const [provider, setProvider] = useState(prov.id);
  const [modelSel, setModelSel] = useState(inList ? curModel : "custom");
  const [modelCustom, setModelCustom] = useState(inList ? "" : curModel);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? true);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const activeProv = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0];
  const finalModel = modelSel === "custom" ? normalizeModel(provider, modelCustom) : modelSel;

  const save = async () => {
    if (!finalModel) { toast("Укажите модель ИИ", "alert"); return; }
    if (!aiConfig?.hasKey && !apiKey.trim()) { toast("Введите API-ключ", "alert"); return; }
    setSaving(true);
    try {
      await saveAiConfig({ provider, model: finalModel, apiKey: apiKey.trim(), enabled });
      if (modelSel === "custom") setModelCustom(finalModel);
      const cfg = await fetchAiConfig();
      setAiConfig(cfg);
      setApiKey("");
      toast("Настройки ИИ сохранены");
    } catch (e: any) {
      toast(e.message ?? "Не удалось сохранить настройки ИИ", "alert");
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setTestRes(null);
    try {
      const r = await aiChatRpc([
        { role: "system", content: "Ответь ровно одной короткой фразой по-русски: связь работает, я готов помогать директору." },
        { role: "user", content: "Проверка связи" },
      ]);
      setTestRes({ ok: true, text: r });
    } catch (e: any) {
      setTestRes({ ok: false, text: friendlyAiError(e.message ?? "Ошибка соединения") });
    } finally { setTesting(false); }
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionTitle icon="sparkle" title="ИИ-ассистент" sub="Советник директора по сделкам, финансам и команде" />
        <span className="chip flex-none" style={{
          background: aiConfig?.hasKey && aiConfig.enabled ? "var(--green-soft)" : "var(--amber-soft)",
          color: aiConfig?.hasKey && aiConfig.enabled ? "var(--green)" : "var(--amber)",
        }}>
          {aiConfig?.hasKey && aiConfig.enabled ? "готов к работе" : "требуется настройка"}
        </span>
      </div>

      {isDemo ? (
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <Icon name="cloud" size={16} />
          </span>
          <div className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Ключ ИИ хранится в защищённом хранилище <b>облака Supabase</b>, поэтому настроить ассистента можно только в командном режиме.
            Сейчас вы в демо-режиме — выйдите и войдите через вкладку «Командная (облако)», затем вернитесь сюда.
          </div>
        </div>
      ) : !canConfigure ? (
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <Icon name="eye" size={16} />
          </span>
          <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            Настройка провайдера и ключа доступна сотрудникам с правом «Настройка ИИ» (обычно Директору). Кнопка ассистента появится в правом нижнем углу.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Провайдер ИИ</label>
              <select className="select" value={provider} onChange={(e) => { setProvider(e.target.value); const p = AI_PROVIDERS.find((x) => x.id === e.target.value); setModelSel(p?.models[0] ?? ""); setModelCustom(""); setTestRes(null); }}>
                {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Модель</label>
              <select className="select" value={modelSel} onChange={(e) => { setModelSel(e.target.value); setTestRes(null); }}>
                {activeProv.models.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="custom">— ввести свою модель —</option>
              </select>
              {modelSel === "custom" && (
                <>
                  <input className="input mt-2" placeholder="Например: 3.5 Flash Lite" value={modelCustom} onChange={(e) => setModelCustom(e.target.value)} />
                  <div className="text-[10.5px] font-semibold mt-1.5 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
                    <Icon name="sparkle" size={12} className="mt-px flex-none" />
                    Можно писать как угодно — пробелы и заглавные буквы исправятся сами: «3.5 Flash Lite» → gemini-3.5-flash-lite
                  </div>
                </>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="label">
                API-ключ
                {aiConfig?.hasKey && <span className="ml-2 chip" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="check" size={11} /> сохранён {aiConfig.keyHint}</span>}
              </label>
              <div className="relative">
                <input
                  className="input !pr-11"
                  type={showKey ? "text" : "password"}
                  placeholder={aiConfig?.hasKey ? "Введите новый ключ (или оставьте пустым — останется старый)" : "Вставьте ключ сюда"}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestRes(null); }}
                />
                <button className="icon-btn absolute right-1 top-1/2 -translate-y-1/2 !w-8 !h-8" onClick={() => setShowKey(!showKey)} title={showKey ? "Скрыть ключ" : "Показать ключ"}>
                  <Icon name={showKey ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
              <div className="text-[10.5px] font-semibold mt-1.5 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
                <Icon name="lock" size={12} className="mt-px flex-none" />
                Ключ хранится в защищённом хранилище базы и не показывается никому. Получить его можно тут: {activeProv.keyUrl}
              </div>
            </div>
          </div>

          {testRes && (
            <div className="mt-3 p-3 rounded-[10px] text-[12px] font-semibold leading-relaxed flex items-start gap-2 anim-pop"
              style={testRes.ok
                ? { background: "var(--green-soft)", color: "var(--green)" }
                : { background: "var(--red-soft)", color: "var(--red)" }}>
              <Icon name={testRes.ok ? "check" : "alert"} size={15} className="mt-px flex-none" />
              <span className="min-w-0 whitespace-pre-line">{testRes.ok ? `Ответ ИИ: ${testRes.text}` : testRes.text}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : <><Icon name="check" size={15} sw={2.4} /> Сохранить настройки</>}
            </button>
            <button className="btn btn-ghost" onClick={test} disabled={testing}>
              {testing ? "Проверяем…" : <><Icon name="bolt" size={15} /> Проверить связь</>}
            </button>
            <div className="flex-1" />
            <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>Ассистент включён</span>
            <button className={`toggle ${enabled ? "on" : ""}`} onClick={() => setEnabled(!enabled)} aria-label="Включить ИИ-ассистента" />
          </div>
        </>
      )}
    </div>
  );
}

/* ================= КОНСТРУКТОР ДОЛЖНОСТЕЙ ================= */
function RolesConstructor() {
  const { roles, users, saveRole, deleteRole, toast } = useCRM();
  const [selId, setSelId] = useState(roles[0]?.id ?? "");
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<RoleDef | null>(roles[0] ? { ...roles[0], permissions: { ...roles[0].permissions } } : null);

  const select = (r: RoleDef) => {
    setSelId(r.id); setIsNew(false);
    setDraft({ ...r, permissions: { ...r.permissions } });
  };
  const startNew = () => {
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length];
    const blank: RoleDef = { id: uid(), name: "", color, isSystem: false, permissions: {} };
    setSelId(""); setIsNew(true); setDraft(blank);
  };

  const isDirector = draft?.id === "role-director" || draft?.name === "Директор";
  const memberCount = (name: string) => users.filter((u) => u.role === name).length;

  const cycleScope = (pid: string, hasOwn: boolean) => {
    if (!draft || isDirector) return;
    const cur: PermScope = draft.permissions[pid] ?? "denied";
    const next: PermScope = cur === "denied" ? "granted" : cur === "granted" ? (hasOwn ? "own" : "denied") : "denied";
    setDraft({ ...draft, permissions: { ...draft.permissions, [pid]: next } });
  };
  const setAllScope = (v: PermScope) => {
    if (!draft || isDirector) return;
    const perms: Record<string, PermScope> = {};
    PERMS.forEach((p) => { perms[p.id] = v === "own" && !p.scope ? "granted" : v; });
    setDraft({ ...draft, permissions: perms });
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { toast("Укажите название должности", "alert"); return; }
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== draft.id)) { toast("Должность с таким названием уже есть", "alert"); return; }
    saveRole({ ...draft, name }, isNew);
    toast(isNew ? `Должность «${name}» создана` : `Должность «${name}» сохранена`, "bell");
    setIsNew(false); setSelId(draft.id);
  };

  const groups = useMemo(() => {
    const g: Record<string, typeof PERMS> = {};
    PERMS.forEach((p) => { (g[p.group] = g[p.group] ?? []).push(p); });
    return g;
  }, []);

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionTitle icon="shield" title="Должности и права" sub="Создавайте должности и отмечайте, что им разрешено" />
        <button className="btn btn-primary btn-sm flex-none" onClick={startNew}><Icon name="plus" size={14} sw={2.4} /> Новая должность</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-4">
        <div className="space-y-1.5">
          {roles.map((r) => (
            <button key={r.id} onClick={() => select(r)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-[10px] border-2 cursor-pointer transition-all text-left"
              style={{
                borderColor: selId === r.id ? r.color : "var(--line)",
                background: selId === r.id ? `${r.color}18` : "var(--panel)",
              }}>
              <span className="w-3 h-3 rounded-full flex-none" style={{ background: r.color }} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-extrabold truncate">{r.name}</span>
                <span className="block text-[10.5px]" style={{ color: "var(--muted)" }}>
                  {memberCount(r.name)} чел. · {Object.keys(r.permissions).length} прав
                </span>
              </span>
              {r.isSystem && <span className="chip !text-[9.5px]" style={{ background: "var(--panel2)", color: "var(--muted)" }}>системная</span>}
            </button>
          ))}
        </div>

        {draft ? (
          <div className="rounded-[12px] border p-4" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start mb-3">
              <div>
                <label className="label">Название должности</label>
                <input className="input font-bold" placeholder="Например: Сметчик" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                {draft.isSystem && <div className="text-[10.5px] mt-1" style={{ color: "var(--faint)" }}>При переименовании должность обновится у всех сотрудников автоматически</div>}
              </div>
              <div>
                <label className="label">Цвет</label>
                <div className="flex gap-1.5 flex-wrap max-w-[150px]">
                  {ROLE_COLORS.map((c) => (
                    <button key={c} onClick={() => !isDirector && setDraft({ ...draft, color: c })}
                      className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110"
                      style={{ background: c, outline: draft.color === c ? `2px solid ${c}` : "none", outlineOffset: 2, opacity: isDirector ? 0.5 : 1 }}
                      aria-label={c} />
                  ))}
                </div>
              </div>
            </div>

            {isDirector && (
              <div className="flex items-center gap-2 p-2.5 rounded-[9px] mb-3 text-[11.5px] font-semibold" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                <Icon name="note" size={14} className="flex-none" /> У Директора всегда полный доступ — права изменить нельзя.
              </div>
            )}

            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="label !mb-0">
                Права · разрешено {Object.values(draft.permissions).filter((v) => v !== "denied").length} из {PERMS.length}
              </span>
              {!isDirector && (
                <span className="flex gap-2 text-[11px] font-bold">
                  <button className="cursor-pointer hover:opacity-70" style={{ color: "var(--green)" }} onClick={() => setAllScope("granted")}>разрешить все</button>
                  <button className="cursor-pointer hover:opacity-70" style={{ color: "var(--red)" }} onClick={() => setAllScope("denied")}>запретить все</button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-2 text-[10.5px] font-semibold flex-wrap" style={{ color: "var(--faint)" }}>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[4px] inline-block" style={{ background: "var(--line2)" }} /> Запрещено</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[4px] inline-block" style={{ background: "var(--green)" }} /> Разрешено</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-[4px] inline-block" style={{ background: "var(--amber)" }} /> Только свои</span>
              <span className="ml-auto">клик переключает состояние</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {Object.entries(groups).map(([group, perms]) => (
                <div key={group} className="mb-2">
                  <div className="text-[10px] font-extrabold tracking-[0.12em] uppercase mb-1.5" style={{ color: "var(--faint)" }}>{group}</div>
                  {perms.map((p) => {
                    const scope: PermScope = isDirector ? "granted" : (draft.permissions[p.id] ?? "denied");
                    const color = scope === "granted" ? "var(--green)" : scope === "own" ? "var(--amber)" : undefined;
                    return (
                      <button key={p.id} onClick={() => cycleScope(p.id, !!p.scope)} disabled={isDirector}
                        className="w-full flex items-center gap-2.5 py-1.5 text-left cursor-pointer group"
                        title={SCOPE_LABEL[scope]}>
                        <span className="w-[18px] h-[18px] rounded-[5px] border-2 flex-none flex items-center justify-center transition-all"
                          style={{ borderColor: color ?? "var(--line2)", background: color ?? "transparent" }}>
                          {scope === "granted" && <Icon name="check" size={11} sw={3.2} className="text-white" />}
                          {scope === "own" && <Icon name="user" size={11} sw={2.6} className="text-white" />}
                        </span>
                        <span className="text-[12.5px] font-semibold flex-1" style={{ color: scope === "denied" ? "var(--muted)" : "var(--ink)" }}>{p.label}</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide flex-none"
                          style={{ color: scope === "denied" ? "var(--faint)" : color }}>
                          {SCOPE_SHORT[scope]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4">
              {!isNew && (
                <button className="btn btn-danger" onClick={() => { deleteRole(draft.id); toast(`Должность «${draft.name}» удалена`); const next = roles.find((r) => r.id !== draft.id); if (next) select(next); }}>
                  <Icon name="trash" size={14} /> Удалить
                </button>
              )}
              <div className="flex-1" />
              <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> {isNew ? "Создать должность" : "Сохранить"}</button>
            </div>
          </div>
        ) : (
          <div className="rounded-[12px] border p-4 flex items-center justify-center text-[12.5px] font-semibold" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            Выберите должность слева или создайте новую
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= ПРИГЛАШЕНИЯ ================= */
function InvitesCard() {
  const { roles, invites, users, currentUserId, addInvite, revokeInvite, toast, mode } = useCRM();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles.find((r) => r.name !== "Директор")?.name ?? roles[0]?.name ?? "");
  const [lastLink, setLastLink] = useState("");
  const [busy, setBusy] = useState(false);

  const status = (inv: Invite): "used" | "expired" | "valid" =>
    inv.usedAt ? "used" : new Date(inv.expiresAt).getTime() < Date.now() ? "expired" : "valid";

  const create = async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast("Введите корректный email", "alert"); return; }
    if (!role) { toast("Выберите должность", "alert"); return; }
    const token = (crypto as any).randomUUID ? crypto.randomUUID() : uid() + Date.now().toString(36);
    const inv: Invite = {
      id: uid(), name: name.trim() || undefined, email: em, role, token, createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      usedAt: null,
    };
    if (mode === "cloud") {
      setBusy(true);
      try {
        await pushInvite(inv);
      } catch (e: any) {
        setBusy(false);
        const msg = e?.message ?? "";
        toast(/exist|rpc|schema/i.test(msg)
          ? "В базе нет таблицы приглашений — выполните SQL-скрипт «должности и приглашения» (инструкция в чате)"
          : `Не удалось создать приглашение: ${msg}`, "alert");
        return;
      }
      setBusy(false);
    }
    addInvite(inv);
    const link = inviteLink(token);
    setLastLink(link);
    setName(""); setEmail("");
    navigator.clipboard?.writeText(link).catch(() => {});
    toast(`Приглашение для ${inv.name || em} создано — ссылка скопирована`, "bell");
  };

  const active = invites.filter((i) => status(i) === "valid");
  const past = invites.filter((i) => status(i) !== "valid");

  return (
    <div className="card p-5 mt-4">
      <SectionTitle icon="mail" title="Пригласить сотрудника" sub="Сотрудник перейдёт по ссылке, задаст пароль и получит выбранную должность" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
        <div>
          <label className="label">Имя сотрудника</label>
          <input className="input" placeholder="Иван Иванов" value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email сотрудника</label>
          <input className="input" type="email" placeholder="manager@mail.ru" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()} />
        </div>
        <div>
          <label className="label">Должность</label>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          <Icon name="plus" size={15} sw={2.4} /> {busy ? "Создаём…" : "Создать приглашение"}
        </button>
      </div>

      {lastLink && (
        <div className="mt-3 p-3 rounded-[10px] border anim-pop" style={{ borderColor: "color-mix(in srgb, var(--brand) 40%, var(--line))", background: "var(--brand-soft)" }}>
          <div className="text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: "var(--brand)" }}>Ссылка-приглашение (действует 7 дней)</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11.5px] font-semibold truncate px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel)", color: "var(--muted)" }}>{lastLink}</code>
            <button className="btn btn-primary btn-sm flex-none" onClick={() => copy(lastLink)}><Icon name="link" size={13} /> Копировать</button>
          </div>
          <div className="text-[10.5px] mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>
            Отправьте ссылку в мессенджере или по почте. Сотрудник откроет её → попадёт на регистрацию, где email и должность уже подставлены → задаст имя и пароль → войдёт в CRM сразу с должностью «{role}».
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-4">
          <div className="label">Приглашения</div>
          <div className="space-y-1.5">
            {[...active, ...past].map((inv) => {
              const stt = status(inv);
              const inviter = users.find((u) => u.id === inv.createdBy);
              return (
                <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-[10px] border" style={{ borderColor: "var(--line)", opacity: stt === "valid" ? 1 : 0.65 }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--panel2)", color: "var(--muted)" }}>
                    <Icon name="mail" size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{inv.name ? `${inv.name} · ` : ""}{inv.email}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                      {inv.role}{inviter ? ` · от ${inviter.name}` : ""} · {new Date(inv.createdAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  <span className="chip flex-none" style={{
                    background: stt === "valid" ? "var(--green-soft)" : stt === "used" ? "var(--blue-soft)" : "var(--red-soft)",
                    color: stt === "valid" ? "var(--green)" : stt === "used" ? "var(--blue)" : "var(--red)",
                  }}>
                    {stt === "valid" ? "ожидает" : stt === "used" ? "принято" : "истекло"}
                  </span>
                  {stt === "valid" && (
                    <>
                      <button className="icon-btn !w-7 !h-7" title="Скопировать ссылку" onClick={() => copy(inviteLink(inv.token))}><Icon name="link" size={14} /></button>
                      <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" title="Отозвать" onClick={() => { revokeInvite(inv.id); toast("Приглашение отозвано"); }}><Icon name="x" size={14} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "demo" && (
        <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
          <Icon name="note" size={13} className="mt-px flex-none" /> В демо-режиме приглашения хранятся только в этом браузере. В командном режиме они общие для всей бригады.
        </p>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
        <Icon name={icon} size={16} />
      </span>
      <div>
        <div className="font-display text-[13px] font-semibold">{title}</div>
        {sub && <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}
