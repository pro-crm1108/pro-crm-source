import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { Avatar, ToneChip, useClickOutside, useModalStack } from "./ui";
import { useCRM, useCan, dealTotal, dealPaid, dueLabel, dFmt, dtFmt } from "../store";
import { authLogout } from "../lib/sync";
import { playNotifSound } from "../lib/sound";
import { PAGE_PERM, CREATE_PERM } from "../lib/perms";
import type { Page, Notification } from "../types";

const NAV: { id: Page; icon: string; label: string }[] = [
  { id: "home", icon: "home", label: "Главная" },
  { id: "sales", icon: "kanban", label: "Продажи" },
  { id: "clients", icon: "users", label: "Клиенты" },
  { id: "objects", icon: "building", label: "Объекты" },
  { id: "jobs", icon: "hammer", label: "Работы" },
  { id: "tasks", icon: "checkSq", label: "Задачи" },
  { id: "products", icon: "box", label: "Склад" },
  { id: "finance", icon: "wallet", label: "Финансы" },
  { id: "settings", icon: "gear", label: "Настройки" },
];

export function Sidebar() {
  const { page, setPage, users, currentUserId, tasks, deals, logout, collapsed, toggleCollapsed, mode, cloudState } = useCRM();
  const can = useCan();
  const doLogout = () => { if (mode === "cloud") authLogout().catch(() => {}); logout(); };
  const me = users.find((u) => u.id === currentUserId);
  const [accOpen, setAccOpen] = useState(false);
  const accRef = useClickOutside(() => setAccOpen(false));
  const overdue = tasks.filter((t) => !t.done && new Date(t.due).getTime() < Date.now()).length;
  const activeDeals = deals.filter((d) => d.stageId !== "st6").length;

  /* разделы, доступные по правам текущей должности */
  const nav = NAV.filter((n) => {
    const perm = PAGE_PERM[n.id];
    return !perm || can(perm);
  });

  /* если должность сменили и текущий раздел стал недоступен — возвращаем на главную */
  useEffect(() => {
    const perm = PAGE_PERM[page];
    if (perm && !can(perm)) setPage("home");
  }, [page, can, setPage]);

  return (
    <aside
      className={`flex-none h-screen sticky top-0 flex flex-col transition-[width] duration-300 ease-in-out ${collapsed ? "w-[76px]" : "w-[228px]"}`}
      style={{ background: "var(--sidebar)", color: "var(--sidebar-ink)" }}>
      {/* brand */}
      <div className={`flex items-center h-[64px] flex-none ${collapsed ? "justify-center" : "justify-between pl-5 pr-2"}`}>
        <button className={`flex items-center gap-3 cursor-pointer group ${collapsed ? "" : "text-left"}`} onClick={() => setPage("home")} title="На главную">
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none transition-transform group-hover:scale-105" style={{ background: "rgba(232,163,61,0.14)" }}>
            <Icon name="crane" size={21} className="text-[#e8a33d]" sw={1.9} />
          </span>
          {!collapsed && (
            <span className="overflow-hidden">
              <span className="font-display text-[15px] font-bold tracking-wider text-white leading-none block whitespace-nowrap">ПРО <span className="text-[#e8a33d]">CRM</span></span>
              <span className="text-[10px] tracking-[0.18em] uppercase opacity-60 mt-1 block whitespace-nowrap">стройка · контроль</span>
            </span>
          )}
        </button>
        {!collapsed && (
          <button className="icon-btn !text-[var(--sidebar-ink)] hover:!bg-white/10" onClick={toggleCollapsed} title="Свернуть меню">
            <Icon name="panelL" size={17} />
          </button>
        )}
      </div>

      {collapsed ? (
        <button className="mx-auto mb-1 icon-btn !text-[var(--sidebar-ink)] hover:!bg-white/10" onClick={toggleCollapsed} title="Развернуть меню">
          <Icon name="panelL" size={17} />
        </button>
      ) : (
        <div className="px-5 pt-3 pb-2 text-[10px] font-bold tracking-[0.22em] uppercase opacity-45">Разделы</div>
      )}

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 ${collapsed ? "px-2.5" : "px-3"}`}>
        {nav.map((n) => {
          const on = page === n.id;
          const badge = n.id === "tasks" && overdue > 0 ? overdue : n.id === "sales" ? activeDeals : null;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} title={collapsed ? n.label : undefined}
              className={`nav-item relative w-full flex items-center rounded-[9px] text-[13.5px] font-semibold cursor-pointer transition-colors ${on ? "on text-white" : "hover:text-white"} ${collapsed ? "justify-center py-[11px]" : "gap-3 px-3 py-[9px]"}`}
              style={on ? { background: collapsed ? "transparent" : "rgba(255,255,255,0.08)" } : undefined}>
              <span className={collapsed && on ? "flex items-center justify-center w-9 h-9 rounded-[9px]" : "flex items-center"} style={collapsed && on ? { background: "rgba(255,255,255,0.08)" } : undefined}>
                <Icon name={n.icon} size={18} sw={on ? 2 : 1.7} className={on ? "text-[#e8a33d]" : ""} />
              </span>
              {!collapsed && <span className="flex-1 text-left">{n.label}</span>}
              {collapsed && on && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "var(--amber)" }} />}
              {badge !== null && badge > 0 && (collapsed ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white" style={{ background: n.id === "tasks" ? "var(--red)" : "rgba(255,255,255,0.16)" }}>{badge}</span>
              ) : (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold ${n.id === "tasks" ? "text-white pulse-dot" : "opacity-55"}`} style={n.id === "tasks" ? { background: "var(--red)" } : undefined}>{badge}</span>
              ))}
            </button>
          );
        })}
      </nav>

      {/* cloud status */}
      {mode === "cloud" && !collapsed && (
        <div className="mx-3 mb-1 px-3 py-2 rounded-[9px] flex items-center gap-2 text-[11px] font-bold"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--sidebar-ink)" }}>
          <span className={`w-2 h-2 rounded-full flex-none ${cloudState === "loading" ? "pulse-dot" : ""}`}
            style={{ background: cloudState === "error" ? "var(--red)" : cloudState === "loading" ? "var(--amber)" : "#5fd0b2" }} />
          {cloudState === "error" ? "Ошибка связи с облаком" : cloudState === "loading" ? "Синхронизация…" : "Облако · синхронизировано"}
          <Icon name="cloud" size={14} className="ml-auto" />
        </div>
      )}
      {mode === "cloud" && collapsed && (
        <div className="flex justify-center mb-1">
          <span className="w-2 h-2 rounded-full" title="Облако подключено"
            style={{ background: cloudState === "error" ? "var(--red)" : cloudState === "loading" ? "var(--amber)" : "#5fd0b2" }} />
        </div>
      )}

      {/* account */}
      <div className={`relative ${collapsed ? "p-2.5" : "p-3"}`} ref={accRef}>
        {accOpen && (
          <div className={`absolute bottom-[calc(100%+6px)] card p-1.5 z-40 anim-pop ${collapsed ? "left-2 w-[210px]" : "left-3 right-3"}`} style={{ boxShadow: "var(--shadow-lg)", background: "var(--panel)" }}>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg row-hover text-left" style={{ color: "var(--ink)" }} onClick={() => { setPage("settings"); setAccOpen(false); }}>
              <Icon name="user" size={16} className="text-[var(--muted)]" /> <span className="text-[13px] font-semibold flex-1">Профиль</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg row-hover text-left" style={{ color: "var(--ink)" }} onClick={() => { setPage("settings"); setAccOpen(false); }}>
              <Icon name="gear" size={16} className="text-[var(--muted)]" /> <span className="text-[13px] font-semibold flex-1">Настройки</span>
            </button>
            <div className="my-1 border-t" style={{ borderColor: "var(--line)" }} />
            <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--red-soft)]" style={{ color: "var(--red)" }} onClick={() => { doLogout(); setAccOpen(false); }}>
              <Icon name="logout" size={16} /> <span className="text-[13px] font-semibold flex-1">Выйти</span>
            </button>
          </div>
        )}
        <button onClick={() => setAccOpen(!accOpen)} title={collapsed ? `${me?.name} — ${me?.role}` : undefined}
          className={`w-full flex items-center rounded-[10px] cursor-pointer transition-colors hover:bg-white/5 ${collapsed ? "justify-center py-2" : "gap-2.5 px-2.5 py-2.5"}`}
          style={accOpen ? { background: "rgba(255,255,255,0.07)" } : undefined}>
          <Avatar user={me} size={collapsed ? 36 : 34} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left min-w-0">
                <span className="block text-[13px] font-bold text-white truncate leading-tight">{me?.name}</span>
                <span className="block text-[11px] opacity-60">{me?.role}</span>
              </span>
              <Icon name="chevD" size={15} className={`transition-transform ${accOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/* ================= БАННЕР ОШИБОК СИНХРОНИЗАЦИИ ================= */
export function SyncBanner() {
  const { lastSyncError, setSyncError, mode } = useCRM();
  if (mode !== "cloud" || !lastSyncError) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b anim-pop"
      style={{ background: "var(--red-soft)", borderColor: "color-mix(in srgb, var(--red) 40%, var(--line))" }}>
      <Icon name="alert" size={17} className="text-[var(--red)] mt-px flex-none" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-extrabold text-[var(--red)]">Не удалось сохранить данные в облако</div>
        <div className="text-[12px] mt-0.5 break-words" style={{ color: "var(--red)", opacity: 0.85 }}>{lastSyncError}</div>
        <div className="text-[11px] mt-1 font-semibold" style={{ color: "var(--muted)" }}>
          Изменение осталось только на этом устройстве. Пришлите этот текст — мы починим доступ к базе.
        </div>
      </div>
      <button className="icon-btn !w-7 !h-7 flex-none" style={{ color: "var(--red)" }} onClick={() => setSyncError(null)} aria-label="Скрыть">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

/* ================= TOP BAR ================= */
/* индикатор «Облако / Демо» — всегда на виду, чтобы режим не вызывал вопросов */
function ModeChip() {
  const { mode, cloudState } = useCRM();
  if (mode !== "cloud") {
    return (
      <span className="chip flex-none !py-1.5 cursor-help" title="Данные хранятся только в этом браузере. Чтобы работать с командой и настроить ИИ — войдите в облачный режим."
        style={{ background: "var(--amber-soft)", color: "var(--amber)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)" }}>
        <Icon name="user" size={13} /> Демо-режим
      </span>
    );
  }
  return (
    <span className="chip flex-none !py-1.5 cursor-help" title="Данные синхронизированы с облаком Supabase и общие для всей бригады"
      style={{ background: "var(--green-soft)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)" }}>
      <Icon name="cloud" size={13} /> {cloudState === "loading" ? "Синхронизация…" : "Облако"}
    </span>
  );
}

export function TopBar() {
  const { clients, deals, objects, tasks, openModal, setPage, users, payments } = useCRM();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const searchRef = useClickOutside(() => setFocus(false));

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return null;
    const has = (v?: string) => v?.toLowerCase().includes(s);
    return {
      clients: clients.filter((c) => has(c.name) || has(c.phone) || has(c.company)).slice(0, 4),
      deals: deals.filter((d) => has(d.title)).slice(0, 4),
      objects: objects.filter((o) => has(o.title) || has(o.address)).slice(0, 3),
      tasks: tasks.filter((t) => has(t.title)).slice(0, 3),
    };
  }, [q, clients, deals, objects, tasks]);

  const noRes = results && results.clients.length + results.deals.length + results.objects.length + results.tasks.length === 0;

  const go = (fn: () => void) => { fn(); setQ(""); setFocus(false); };

  return (
    <header className="h-[64px] flex-none flex items-center gap-3 px-6 sticky top-0 z-40 border-b"
      style={{ background: "color-mix(in srgb, var(--bg) 86%, transparent)", backdropFilter: "blur(10px)", borderColor: "var(--line)" }}>
      {/* search */}
      <div className="relative flex-1 max-w-[460px]" ref={searchRef}>
        <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input className="input !pl-10 !py-[9px] !rounded-[10px]" placeholder="Поиск: клиенты, сделки, объекты, задачи…"
          value={q} onChange={(e) => { setQ(e.target.value); setFocus(true); }} onFocus={() => setFocus(true)} />
        {focus && results && (
          <div className="absolute top-full left-0 right-0 mt-2 card p-2 anim-pop max-h-[420px] overflow-y-auto" style={{ boxShadow: "var(--shadow-lg)" }}>
            {noRes && <div className="px-3 py-5 text-center text-[13px] font-semibold" style={{ color: "var(--muted)" }}>Ничего не найдено по запросу «{q}»</div>}
            {results.clients.length > 0 && <GroupLabel t="Клиенты" />}
            {results.clients.map((c) => (
              <ResRow key={c.id} icon="users" title={c.name} sub={c.phone} onClick={() => go(() => openModal({ type: "client", id: c.id }))} />
            ))}
            {results.deals.length > 0 && <GroupLabel t="Сделки" />}
            {results.deals.map((d) => {
              const cl = clients.find((c) => c.id === d.clientId);
              return <ResRow key={d.id} icon="kanban" title={d.title} sub={cl?.name ?? ""} onClick={() => go(() => openModal({ type: "deal", id: d.id }))} />;
            })}
            {results.objects.length > 0 && <GroupLabel t="Объекты" />}
            {results.objects.map((o) => (
              <ResRow key={o.id} icon="building" title={o.title} sub={o.address} onClick={() => go(() => openModal({ type: "object", id: o.id }))} />
            ))}
            {results.tasks.length > 0 && <GroupLabel t="Задачи" />}
            {results.tasks.map((t) => (
              <ResRow key={t.id} icon="checkSq" title={t.title} sub={dtFmt(t.due)} onClick={() => go(() => openModal({ type: "task", id: t.id }))} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* индикатор режима — чтобы всегда было видно, облако это или демо */}
      <ModeChip />

      {/* create */}
      <button className="btn btn-primary" onClick={() => openModal({ type: "create-menu" })}>
        <Icon name="plus" size={16} sw={2.4} /> Создать
      </button>

      {/* bell */}
      <Bell />
    </header>
  );
}

function GroupLabel({ t }: { t: string }) {
  return <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--faint)" }}>{t}</div>;
}
function ResRow({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg row-hover text-left" onClick={onClick}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--panel2)", color: "var(--muted)" }}>
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold truncate">{title}</span>
        <span className="block text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{sub}</span>
      </span>
      <Icon name="arrowR" size={14} className="ml-auto text-[var(--faint)]" />
    </button>
  );
}

/* ---------- bell / notifications ---------- */
/* относительное время: «только что», «5 мин», «2 ч», «вчера» */
function relTime(isoStr: string): string {
  const diff = Date.now() - +new Date(isoStr);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  return `${d} дн назад`;
}

function Bell() {
  const { notifications, currentUserId, openModal, markNotifRead, markAllNotifsRead, setPage } = useCRM();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const mine = notifications
    .filter((n) => n.userId === currentUserId)
    .sort((a, b) => (a.read !== b.read ? (a.read ? 1 : -1) : +new Date(b.createdAt) - +new Date(a.createdAt)));
  const unread = mine.filter((n) => !n.read).length;

  const openItem = (n: any) => {
    markNotifRead(n.id);
    setOpen(false);
    if (n.dealId) openModal({ type: "deal", id: n.dealId });
    else if (n.taskId) openModal({ type: "task", id: n.taskId });
    else setPage("tasks");
  };

  const iconFor = (type: string) =>
    type === "overdue" ? "alert" : type === "task" ? "checkSq" : type === "payment" ? "ruble" : "bell";
  const colorFor = (type: string) =>
    type === "overdue" ? "var(--red)" : type === "task" ? "var(--brand)" : type === "payment" ? "var(--green)" : "var(--muted)";

  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn !w-[38px] !h-[38px] !rounded-[10px] !border" style={{ borderColor: "var(--line2)", background: "var(--panel)" }}
        onClick={() => setOpen(!open)} aria-label="Оповещения">
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10.5px] font-extrabold text-white pulse-dot" style={{ background: "var(--red)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] card anim-pop overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
            <span className="font-display text-[12px] font-semibold tracking-wide">Оповещения</span>
            {unread > 0 ? (
              <button className="text-[11.5px] font-bold cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "var(--brand)" }}
                onClick={markAllNotifsRead}>
                Прочитать все ({unread})
              </button>
            ) : (
              <span className="chip" style={{ background: "var(--panel2)", color: "var(--muted)" }}>всё прочитано</span>
            )}
          </div>
          <div className="max-h-[440px] overflow-y-auto p-2">
            {mine.length === 0 && (
              <div className="px-3 py-10 text-center">
                <span className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--panel2)", color: "var(--faint)" }}>
                  <Icon name="bell" size={19} />
                </span>
                <div className="text-[13px] font-bold">Пока нет уведомлений</div>
                <div className="text-[11.5px] mt-1" style={{ color: "var(--muted)" }}>
                  Здесь появятся назначенные вам задачи и сигналы о просрочках
                </div>
              </div>
            )}
            {mine.map((n) => (
              <div key={n.id}
                className="flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg row-hover cursor-pointer transition-colors"
                style={{ background: n.read ? "transparent" : "color-mix(in srgb, var(--brand) 6%, transparent)" }}
                onClick={() => openItem(n)}>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-none mt-0.5"
                  style={{ background: "var(--panel2)", color: colorFor(n.type) }}>
                  <Icon name={iconFor(n.type)} size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12.5px] leading-snug truncate ${n.read ? "font-semibold" : "font-extrabold"}`}
                      style={{ color: n.read ? "var(--muted)" : "var(--ink)" }}>
                      {n.title}
                    </span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: "var(--brand)" }} />}
                  </div>
                  {n.text && <span className="block text-[11.5px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{n.text}</span>}
                  <span className="block text-[10.5px] font-semibold mt-1" style={{ color: "var(--faint)" }}>{relTime(n.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-2.5 text-[12.5px] font-bold border-t transition-colors hover:bg-[var(--panel2)] cursor-pointer" style={{ borderColor: "var(--line)", color: "var(--brand)" }}
            onClick={() => { setOpen(false); setPage("tasks"); }}>
            Все задачи →
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= POP-УВЕДОМЛЕНИЯ (возле колокольчика) ================= */
const NOTIF_STYLE: Record<Notification["type"], { icon: string; color: string; label: string }> = {
  task: { icon: "checkSq", color: "#5fd0b2", label: "Задача" },
  overdue: { icon: "alert", color: "#ff8a7a", label: "Просрочка" },
  payment: { icon: "ruble", color: "#8fd6a4", label: "Платёж" },
  system: { icon: "bell", color: "#e8a33d", label: "Система" },
  booking: { icon: "box", color: "#c9a227", label: "Бронь товара" },
};

export function NotificationPopups() {
  const { notifications, currentUserId, users, roles, markNotifRead, openModal, setPage } = useCRM();
  const [pops, setPops] = useState<Notification[]>([]);
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* директор определяется по системной роли role-director (название может быть переименовано) */
  const me = users.find((u) => u.id === currentUserId);
  const directorRoleName = roles.find((r) => r.id === "role-director")?.name ?? "Директор";
  const isDirector = me?.role === directorRoleName;
  /* автозакрытие 6,5 с — только для просроченных задач у директора;
     у остальных сотрудников уведомления «липкие» — висят, пока не закроют или не откроют */
  const autoClose = (n: Notification) => n.type === "overdue" && isDirector;

  /* новые входящие (только свежие — не вываливаем всё при входе) */
  useEffect(() => {
    const fresh = notifications.filter((n) =>
      n.userId === currentUserId && !n.read && !seen.current.has(n.id) && Date.now() - +new Date(n.createdAt) < 30000
    );
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.id));
    setPops((p) => [...fresh, ...p].slice(0, 5));
    /* звук — один раз на партию, если не выключен в настройках */
    if (useCRM.getState().notifPrefs.sound !== false) playNotifSound();
    /* таймер автозакрытия — только для «не липких» */
    fresh.forEach((n) => { if (autoClose(n)) timers.current.set(n.id, setTimeout(() => dismiss(n.id), 6500)); });
  }, [notifications, currentUserId]);

  /* уведомления, прочитанные из колокольчика, убираем и из всплывающих */
  useEffect(() => {
    setPops((p) => p.filter((x) => {
      if (closing.has(x.id)) return true;
      const n = notifications.find((q) => q.id === x.id);
      return !!n && !n.read;
    }));
  }, [notifications]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const dismiss = (id: string) => {
    const tm = timers.current.get(id); if (tm) clearTimeout(tm); timers.current.delete(id);
    setClosing((s) => new Set(s).add(id));
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 180);
  };

  const open = (n: Notification) => {
    markNotifRead(n.id);
    dismiss(n.id);
    if (n.type === "booking" && n.dealId && n.taskId) {
      /* бронь товара → раздел «Склад» с открытой карточкой конкретной брони */
      setPage("products");
      openModal({ type: "booking", dealId: n.dealId, productId: n.taskId });
    } else if (n.dealId) openModal({ type: "deal", id: n.dealId });
    else if (n.taskId) openModal({ type: "task", id: n.taskId });
  };

  if (!pops.length) return null;
  return (
    <div className="fixed right-5 top-[74px] z-[75] flex flex-col gap-2.5 items-end pointer-events-none">
      {pops.map((n) => {
        const st = NOTIF_STYLE[n.type];
        const sticky = !autoClose(n);
        return (
          <div key={n.id}
            className="pointer-events-auto w-[344px] rounded-[13px] overflow-hidden relative cursor-pointer group"
            style={{
              background: "var(--sidebar)", color: "#e9efe9", boxShadow: "var(--shadow-lg)",
              animation: closing.has(n.id) ? "popOutRight 0.18s ease forwards" : "popInRight 0.28s cubic-bezier(0.22,1.2,0.36,1) both",
              border: `1px solid ${st.color}33`,
            }}
            onClick={() => open(n)}
            title={sticky ? "Нажмите, чтобы открыть, или закройте крестиком" : undefined}>
            <div className="flex items-start gap-3 p-3.5 pb-4">
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none transition-transform group-hover:scale-110"
                style={{ background: `${st.color}22`, color: st.color }}>
                <Icon name={st.icon} size={17} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] font-extrabold tracking-[0.16em] uppercase" style={{ color: st.color }}>{st.label}</span>
                  {sticky
                    ? <span className="w-1.5 h-1.5 rounded-full ml-auto pulse-dot flex-none" style={{ background: st.color }} title="Останется, пока не закроете" />
                    : <span className="text-[10px] font-bold ml-auto opacity-45">только что</span>}
                </div>
                <div className="text-[13px] font-extrabold leading-snug mt-0.5">{n.title}</div>
                {n.text && <div className="text-[12px] leading-snug mt-0.5 truncate opacity-65">{n.text}</div>}
              </div>
              <button className="icon-btn !w-6 !h-6 flex-none" style={{ color: "#8fa095" }}
                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} aria-label="Скрыть">
                <Icon name="x" size={13} />
              </button>
            </div>
            {/* полоска автозакрытия — только у «не липких» (просрочки директора) */}
            {!sticky && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] block" style={{ background: `${st.color}22` }}>
                <span className="block h-full origin-left"
                  style={{ background: st.color, animation: closing.has(n.id) ? "none" : "countdownBar 6.5s linear forwards" }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================= CREATE MENU ================= */
const CREATE_TILES = [
  { type: "client", icon: "users", title: "Клиент", desc: "Физ. или юр. лицо", color: "#39708f" },
  { type: "deal", icon: "kanban", title: "Сделка", desc: "Новая заявка в воронку", color: "#17705c" },
  { type: "task", icon: "checkSq", title: "Задача", desc: "Срок и ответственный", color: "#c07f14" },
  { type: "object", icon: "building", title: "Объект", desc: "Адрес и параметры", color: "#b5566e" },
  { type: "job", icon: "hammer", title: "Работа", desc: "Этап на объекте", color: "#4c7fb5" },
  { type: "payment", icon: "ruble", title: "Платёж", desc: "Поступление или расход", color: "#3e8757" },
] as const;

export function CreateMenu() {
  const { replaceModal, closeModal } = useCRM();
  const { index } = useModalStack();
  const can = useCan();
  /* показываем только то, что пользователю разрешено создавать */
  const tiles = CREATE_TILES.filter((t) => can(CREATE_PERM[t.type]));
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 anim-fade"
      style={{ zIndex: 60 + index, background: "rgba(14,20,17,0.5)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="card anim-pop w-full max-w-[560px] p-5" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-display text-[14px] font-semibold tracking-wide">Создать</div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>Выберите, что нужно добавить</div>
          </div>
          <button className="icon-btn" onClick={closeModal}><Icon name="x" size={17} /></button>
        </div>
        {tiles.length === 0 ? (
          <div className="text-[13px] font-semibold text-center py-6 rounded-[10px]" style={{ color: "var(--muted)", border: "1.5px dashed var(--line2)" }}>
            У вашей должности нет прав на создание записей
          </div>
        ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {tiles.map((t, i) => (
            <button key={t.type}
              className="text-left p-3.5 rounded-xl border transition-all cursor-pointer anim-page group"
              style={{ borderColor: "var(--line)", background: "var(--panel2)", animationDelay: `${i * 0.04}s` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--panel2)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              onClick={() => replaceModal({ type: t.type } as any)}>
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-2.5 transition-transform group-hover:scale-110" style={{ background: `${t.color}1f`, color: t.color }}>
                <Icon name={t.icon} size={18} />
              </span>
              <span className="block text-[13.5px] font-extrabold">{t.title}</span>
              <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--muted)" }}>{t.desc}</span>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
