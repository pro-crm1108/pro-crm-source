import React, { useEffect, useRef, useState } from "react";
import { Sidebar, TopBar, CreateMenu, NotificationPopups, SyncBanner } from "./components/layout";
import { ToastHost, Avatar, ModalStackCtx } from "./components/ui";
import { Icon } from "./components/icons";
import { useCRM } from "./store";
import type { ModalState, User } from "./types";
import {
  fetchAll, subscribeRemote, setSyncErrorHandler, uploadAll,
  authLogin, authRegister, authLogout, authSession, ensureProfile,
  lookupInvite, redeemInvite, fetchAiConfig,
} from "./lib/sync";
import { DEFAULT_ROLES } from "./lib/perms";
import { AiAssistant } from "./components/assistant";
import Home from "./pages/Home";
import Sales from "./pages/Sales";
import Clients from "./pages/Clients";
import Objects from "./pages/Objects";
import Jobs from "./pages/Jobs";
import Tasks from "./pages/Tasks";
import Warehouse, { ProductModal, SupplyModal, BookingModal } from "./pages/Warehouse";
import Finance from "./pages/Finance";
import Settings from "./pages/Settings";
import DealModal from "./modals/DealModal";
import { ClientModal, ObjectModal, TaskModal, JobModal, PaymentModal } from "./modals/modals";
import { EmployeeModal } from "./modals/EmployeeModal";

function renderModal(m: ModalState) {
  if (!m) return null;
  switch (m.type) {
    case "create-menu": return <CreateMenu />;
    case "employee": return <EmployeeModal key={m.id} id={m.id} />;
    case "client": return <ClientModal key={m.id ?? "new"} id={m.id} />;
    case "deal": return <DealModal key={(m.id ?? "new") + (m.stageId ?? "")} id={m.id} stageId={m.stageId} />;
    case "task": return <TaskModal key={m.id ?? "new"} id={m.id} />;
    case "object": return <ObjectModal key={m.id ?? "new"} id={m.id} dealId={m.dealId} />;
    case "job": return <JobModal key={m.id ?? "new"} id={m.id} objectId={m.objectId} />;
    case "payment": return <PaymentModal key={(m.payId ?? m.dealId ?? "") + (m.clientId ?? "") + m.kind} kind={m.kind} dealId={m.dealId} clientId={m.clientId} payId={m.payId} />;
    case "product": return <ProductModal key={m.id ?? "new"} id={m.id} />;
    case "supply": return <SupplyModal />;
    case "booking": return <BookingModal key={m.dealId + m.productId} dealId={m.dealId} productId={m.productId} />;
    default: return null;
  }
}

/* заставка, пока проверяется облачная сессия */
function BootSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: "var(--sidebar)" }}>
      <span className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,163,61,0.14)" }}>
        <Icon name="crane" size={34} className="text-[#e8a33d]" sw={1.9} />
      </span>
      <span className="font-display text-[18px] font-bold tracking-wider text-white">ПРО <span className="text-[#e8a33d]">CRM</span></span>
      <span className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: "rgba(233,239,233,0.55)" }}>
        <Spinner /> Подключаемся к облаку…
      </span>
    </div>
  );
}

export default function App() {
  const { theme, loggedIn, page, modal, mode, currentUserId } = useCRM();
  /* если открыта ссылка-приглашение (?invite=...) — показываем экран входа, даже если уже вошли */
  const [inviteFlow, setInviteFlow] = useState(() => new URLSearchParams(window.location.search).has("invite"));
  /* пока проверяется сессия — показываем заставку, чтобы не «мигать» демо-режимом */
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  /* обработчик ошибок синхронизации → постоянный баннер + редкие тосты */
  const lastErr = useRef(0);
  useEffect(() => {
    setSyncErrorHandler((msg) => {
      useCRM.getState().setSyncError(msg);
      if (Date.now() - lastErr.current > 8000) {
        lastErr.current = Date.now();
        useCRM.getState().toast(msg, "alert");
      }
    });
  }, []);

  /* автоподключение после перезапуска страницы/браузера.
     Режим («облако») теперь сохраняется вместе со входом, поэтому здесь мы
     лишь проверяем, жива ли сессия:
       · жива — молча переподключаемся к облаку и подтягиваем свежие данные;
       · истекла — выводим на экран входа;
       · нет интернета — остаёмся на последних сохранённых данных с заметным баннером.
     Тихо «проснуться» в демо-режиме больше невозможно. */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    /* Источник правды — САМА сессия Supabase, а не запись в браузере.
       Проверяем её ВСЕГДА, независимо от сохранённого режима: пока сессия
       жива, пользователь гарантированно возвращается в облако, даже если
       в памяти браузера осталась старая пометка «демо». Это исключает
       самопроизвольный «переброс» в демо-режим при обновлении страницы. */
    authSession()
      .then((session) => {
        if (session?.user) {
          /* сессия жива — (пере)подключаемся к облаку и тянем свежие данные */
          return void enterCloud(session.user);
        }
        /* живой сессии нет */
        const s = useCRM.getState();
        if (s.mode === "cloud" && s.loggedIn) {
          if (!navigator.onLine) {
            /* нет интернета — остаёмся на последних сохранённых данных */
            s.setCloudState("error");
            s.toast("Нет связи с облаком — показаны последние сохранённые данные", "alert");
          } else {
            /* сессия истекла — честный выход на экран входа */
            useCRM.setState({ loggedIn: false, mode: "demo", cloudState: "idle", cloudUser: null, modal: [] } as any);
            s.toast("Сессия истекла — войдите заново", "bell");
          }
        }
        /* иначе: пользователь и не входил в облако — остаётся демо/экран входа */
      })
      .catch(() => {
        const s = useCRM.getState();
        if (s.mode === "cloud") {
          s.setCloudState("error");
          s.toast("Нет связи с облаком — показаны последние сохранённые данные", "alert");
        }
      })
      .finally(() => setBooting(false));
  }, []);

  /* живые обновления от других сотрудников */
  useEffect(() => {
    if (mode !== "cloud") return;
    const unsub = subscribeRemote((table, action, row) => useCRM.getState().remoteApply(table, action, row));
    return unsub;
  }, [mode]);

  /* фоновая досинхронизация: раз в 20 секунд подтягиваем свежие данные из облака
     (страховка на случай, если живое событие потерялось — задачи точно доедут) */
  useEffect(() => {
    if (mode !== "cloud" || !loggedIn) return;
    const pull = () => {
      fetchAll()
        .then(({ rows }) => { useCRM.getState().hydrate(rows); useCRM.getState().setSyncError(null); })
        .catch(() => { /* молча — баннер покажет ошибку при записи */ });
      /* настройки ИИ-ассистента (директор мог поменять с другого устройства) */
      fetchAiConfig().then((c) => useCRM.getState().setAiConfig(c)).catch(() => {});
    };
    const timer = setInterval(pull, 20000);
    return () => clearInterval(timer);
  }, [mode, loggedIn]);

  /* фоновая проверка просроченных задач (уведомляет исполнителя и директора) */
  useEffect(() => {
    if (!loggedIn) return;
    const run = () => useCRM.getState().checkOverdue();
    run();
    const timer = setInterval(run, 30000);
    return () => clearInterval(timer);
  }, [loggedIn]);

  /* пока идёт проверка сессии — заставка подключения, а не «мигание» демо */
  if (booting) return <BootSplash />;

  if (!loggedIn || inviteFlow) return <><LoginScreen onInviteDone={() => setInviteFlow(false)} /><ToastHost /></>;

  const Page = { home: Home, sales: Sales, clients: Clients, objects: Objects, jobs: Jobs, tasks: Tasks, products: Warehouse, finance: Finance, settings: Settings }[page];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: "var(--bg)" }}>
        <TopBar />
        <SyncBanner />
        <main className="flex-1 min-h-0">
          <div key={page} className="anim-page">
            <Page />
          </div>
        </main>
      </div>

      {/* стек модальных окон: каждое новое открывается поверх предыдущего */}
      {modal.map((m, i) => m && (
        <ModalStackCtx.Provider key={`${m.type}-${i}`} value={{ index: i, size: modal.length }}>
          {renderModal(m)}
        </ModalStackCtx.Provider>
      ))}

      {/* всплывающие уведомления возле колокольчика */}
      {loggedIn && <NotificationPopups key={currentUserId} />}

      {/* ИИ-ассистент: плавающая кнопка + панель чата (только по праву ai.use, только в облаке) */}
      {loggedIn && mode === "cloud" && <AiAssistant />}

      <ToastHost />
    </div>
  );
}

/* ================= подключение к облаку ================= */
async function enterCloud(user: any, nameHint?: string, roleHint?: string) {
  const crm = useCRM.getState();
  crm.setCloudState("loading");
  try {
    const profile = await ensureProfile(user, nameHint, roleHint);
    if ((profile as any)?.blocked) {
      await authLogout().catch(() => {});
      crm.setCloudState("error");
      crm.toast("Ваш аккаунт заблокирован. Обратитесь к директору.", "alert");
      return;
    }
    const prof: User = {
      id: profile.id, name: profile.name, role: profile.role, color: profile.color,
      email: (profile as any).email ?? user.email ?? undefined,
      phone: (profile as any).phone ?? undefined,
      blocked: (profile as any).blocked ?? undefined,
      overrides: (profile as any).overrides ?? undefined,
    };
    // ВАЖНО: облачная запись ВСЕГДА заменяет локальную — иначе экран и база
    // могут «разъехаться» (старая роль из памяти браузера будет побеждать)
    useCRM.setState((s) => ({ users: [...s.users.filter((u) => u.id !== prof.id), prof] }));
    const { rows: data, missing } = await fetchAll();
    crm.enterCloud(prof, user.email ?? "");
    crm.hydrate(data);
    // если в базе ещё нет должностей — выгружаем системные (Директор, Менеджер, Прораб, Закупщик)
    if (!(data.roles?.length)) {
      DEFAULT_ROLES.forEach((r) => useCRM.getState().saveRole(r, true));
    }
    const empty = (data.clients?.length ?? 0) === 0 && (data.deals?.length ?? 0) === 0 && (data.payments?.length ?? 0) === 0;
    if (empty) useCRM.setState({ askSeed: true } as any);
    else crm.toast(`Облако подключено · ${data.clients?.length ?? 0} клиентов, ${data.deals?.length ?? 0} сделок`, "bell");
    /* база «отстала»: не выполнен один из новых SQL-скриптов */
    if (missing.length) {
      crm.toast(
        missing.includes("supplies")
          ? "База устарела: в SQL Editor нужно выполнить скрипт склада (schema-warehouse.sql), иначе склад не будет работать"
          : `В базе нет таблиц: ${missing.join(", ")} — выполните недостающий SQL-скрипт`,
        "alert"
      );
    }
    /* подтягиваем настройки ИИ-ассистента (маска, без ключа) */
    fetchAiConfig().then((c) => useCRM.getState().setAiConfig(c)).catch(() => {});
  } catch (e: any) {
    crm.setCloudState("error");
    crm.toast(e.message ?? "Не удалось подключиться к облаку", "alert");
  }
}

/* ================= LOGIN ================= */
function LoginScreen({ onInviteDone }: { onInviteDone?: () => void }) {
  const { users, roles, loginDemo, toast, cloudState, markInviteUsed } = useCRM();
  const [tab, setTab] = useState<"cloud" | "demo">("cloud");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Менеджер");
  const [sel, setSel] = useState(users[0]?.id ?? "u1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [invite, setInvite] = useState<{ token: string; name?: string; email: string; role: string } | null>(null);

  /* если открыли ссылку-приглашение — проверяем токен и подставляем данные */
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    let cancelled = false;
    lookupInvite(token)
      .then((inv) => {
        if (cancelled) return;
        if (inv) {
          setInvite({ token, name: inv.name, email: inv.email, role: inv.role });
          setTab("cloud");
          setEmail(inv.email); setRole(inv.role);
          if (inv.name) setName(inv.name);
        } else {
          setErr("Приглашение недействительно: ссылка устарела или уже использована");
        }
      })
      .catch(() => {
        if (!cancelled) setErr("Не удалось проверить приглашение — возможно, в базе ещё нет таблицы приглашений. Попросите директора выполнить SQL-скрипт из инструкции.");
      });
    return () => { cancelled = true; };
  }, []);

  const clearInviteUrl = () => {
    try { window.history.replaceState({}, "", window.location.pathname); } catch { /* noop */ }
  };

  const doLogin = async () => {
    if (!email.trim() || !password) { setErr("Введите email и пароль"); return; }
    setBusy(true); setErr("");
    try {
      const user = await authLogin(email.trim(), password);
      toast("Добро пожаловать в ПРО CRM!", "bell");
      await enterCloud(user);
      clearInviteUrl(); onInviteDone?.();
    } catch (e: any) {
      setErr(e.message ?? "Не удалось войти");
    } finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (!name.trim()) { setErr("Введите имя и фамилию"); return; }
    if (!email.trim() || !password) { setErr("Введите email и пароль"); return; }
    setBusy(true); setErr("");
    try {
      const finalRole = invite?.role ?? role; // по приглашению должность фиксирована
      const res = await authRegister(name.trim(), finalRole, email.trim(), password);
      if ("needConfirm" in res && res.needConfirm) {
        setErr("Мы отправили письмо для подтверждения почты — откройте его и войдите снова");
      } else {
        // гасим приглашение, чтобы ссылкой нельзя было воспользоваться повторно
        if (invite) {
          redeemInvite(invite.token).catch(() => {});
          markInviteUsed(invite.token);
          clearInviteUrl();
        }
        toast(invite ? `Аккаунт создан — должность «${invite.role}»` : "Аккаунт создан — добро пожаловать!", "bell");
        await enterCloud((res as any).user, name.trim(), finalRole);
        clearInviteUrl(); onInviteDone?.();
      }
    } catch (e: any) {
      setErr(e.message ?? "Не удалось зарегистрироваться");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* brand side */}
      <div className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden" style={{ background: "var(--sidebar)" }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden>
          <defs>
            <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M42 0H0v42" fill="none" stroke="#e8a33d" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="flex items-center gap-3 relative">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,163,61,0.14)" }}>
            <Icon name="crane" size={26} className="text-[#e8a33d]" sw={1.9} />
          </span>
          <span>
            <span className="font-display text-[18px] font-bold tracking-wider text-white block leading-none">ПРО <span className="text-[#e8a33d]">CRM</span></span>
            <span className="text-[10.5px] tracking-[0.2em] uppercase text-white/50 mt-1 block">стройка · контроль</span>
          </span>
        </div>
        <div className="relative max-w-[440px]">
          <h1 className="font-display text-[29px] leading-[1.22] font-bold text-white">
            Сделки, объекты и&nbsp;деньги — в&nbsp;одном окне
          </h1>
          <p className="text-[14px] mt-4 text-white/60 leading-relaxed">
            Воронка продаж с канбаном, задачи с ответственными, работы по объектам и живая финансовая сводка.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7">
            {[["kanban", "Воронка"], ["hammer", "Работы"], ["ruble", "Финансы"], ["bolt", "Облако Supabase"]].map(([ic, t]) => (
              <span key={t} className="flex items-center gap-2 text-white/70 text-[12.5px] font-bold">
                <Icon name={ic} size={16} className="text-[#e8a33d]" /> {t}
              </span>
            ))}
          </div>
        </div>
        <div className="text-[11.5px] text-white/35 relative">© {new Date().getFullYear()} ПРО CRM · данные бригады хранятся в вашем облаке Supabase</div>
      </div>

      {/* login side */}
      <div className="flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "var(--sidebar)" }}>
              <Icon name="crane" size={20} className="text-[#e8a33d]" />
            </span>
            <span className="font-display text-[16px] font-bold tracking-wider">ПРО <span className="text-[var(--amber)]">CRM</span></span>
          </div>

          <div className="seg w-full !p-1 mb-5">
            <button className={`flex-1 !py-2.5 flex items-center justify-center gap-2 ${tab === "cloud" ? "on" : ""}`} onClick={() => { setTab("cloud"); setErr(""); }}>
              <Icon name="cloud" size={15} /> Командная (облако)
            </button>
            <button className={`flex-1 !py-2.5 flex items-center justify-center gap-2 ${tab === "demo" ? "on" : ""}`} onClick={() => { setTab("demo"); setErr(""); }}>
              <Icon name="user" size={15} /> Демо-режим
            </button>
          </div>

          {tab === "cloud" ? (
            <div className="anim-fade">
              <h2 className="font-display text-[19px] font-bold">{invite ? "Регистрация по приглашению" : "Вход для сотрудников"}</h2>
              <p className="text-[13px] mt-1.5 mb-5" style={{ color: "var(--muted)" }}>
                {invite
                  ? "Директор пригласил вас в бригаду — создайте аккаунт"
                  : "Общие данные бригады — сделки, объекты и финансы — в облаке Supabase"}
              </p>
              <div className="space-y-3">
                {invite && (
                  <div className="flex items-start gap-2.5 p-3 rounded-[10px] anim-pop" style={{ background: "var(--brand-soft)", border: "1px solid color-mix(in srgb, var(--brand) 35%, var(--line))" }}>
                    <Icon name="mail" size={16} className="mt-px flex-none text-[var(--brand)]" />
                    <div className="text-[12px] font-semibold leading-relaxed" style={{ color: "var(--brand)" }}>
                      Вас пригласили в бригаду! Должность <b>«{invite.role}»</b> и email закреплены за этим приглашением — осталось задать имя и пароль.
                    </div>
                  </div>
                )}
                {invite && (
                  <>
                    <div>
                      <label className="label">Имя и фамилия</label>
                      <input className="input" placeholder="Иван Петров" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Должность</label>
                      <div className="input !py-2.5 !text-[13px] font-bold inline-flex items-center gap-2 cursor-default" style={{ color: "var(--brand)", background: "var(--brand-soft)", borderColor: "color-mix(in srgb, var(--brand) 35%, var(--line))" }}>
                        <Icon name="shield" size={15} /> {invite.role} <span className="text-[10.5px] font-semibold opacity-70">· по приглашению</span>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="ivan@brigada.ru" value={email}
                    disabled={!!invite}
                    onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !invite && doLogin()} />
                </div>
                <div>
                  <label className="label">Пароль</label>
                  <input className="input" type="password" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !invite && doLogin()} />
                </div>
                {err && (
                  <div className="flex items-start gap-2 p-3 rounded-[10px] text-[12.5px] font-semibold anim-pop"
                    style={{ background: "var(--red-soft)", color: "var(--red)" }}>
                    <Icon name="alert" size={15} className="mt-px flex-none" /> {err}
                  </div>
                )}
                <button className="btn btn-primary w-full !py-3" disabled={busy} onClick={invite ? doRegister : doLogin}>
                  {busy ? <Spinner /> : invite ? "Создать аккаунт" : <>Войти <Icon name="arrowR" size={16} /></>}
                </button>
                {!invite && (
                  <div className="flex items-center justify-center gap-2 pt-1 text-[12px] font-semibold" style={{ color: "var(--faint)" }}>
                    <Icon name="lock" size={13} /> Регистрация — только по приглашению директора
                  </div>
                )}
                {cloudState === "loading" && (
                  <div className="flex items-center justify-center gap-2 text-[12.5px] font-bold pt-1" style={{ color: "var(--muted)" }}>
                    <Spinner /> Подключаемся к облаку…
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="anim-fade">
              <h2 className="font-display text-[19px] font-bold">Демо-режим</h2>
              <p className="text-[13px] mt-1.5 mb-3" style={{ color: "var(--muted)" }}>
                Данные хранятся только в этом браузере — чтобы посмотреть CRM без подключения бригады
              </p>
              <div className="flex items-start gap-2.5 p-3 rounded-[10px] mb-4"
                style={{ background: "var(--amber-soft)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)" }}>
                <Icon name="alert" size={16} className="mt-px flex-none text-[var(--amber)]" />
                <span className="text-[11.5px] font-semibold leading-relaxed" style={{ color: "var(--amber)" }}>
                  Это НЕ ваш рабочий аккаунт, а отдельный «мир-пример» с выдуманной бригадой.
                  Ваши реальные клиенты, сделки и ключ ИИ здесь недоступны.
                </span>
              </div>
              <div className="space-y-2 mb-5">
                {users.filter((u) => u.id.startsWith("u")).map((u) => (
                  <button key={u.id} onClick={() => setSel(u.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all text-left"
                    style={{ borderColor: sel === u.id ? "var(--brand)" : "var(--line)", background: sel === u.id ? "var(--brand-soft)" : "var(--panel)" }}>
                    <Avatar user={u} size={38} />
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-extrabold">{u.name}</span>
                      <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>{u.role}</span>
                    </span>
                    {sel === u.id && <Icon name="check" size={17} sw={2.6} className="text-[var(--brand)]" />}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary w-full !py-3" onClick={() => { loginDemo(sel); toast("Демо-режим: данные сохраняются в этом браузере", "bell"); }}>
                Войти <Icon name="arrowR" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <SeedAsk />
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-current inline-block" style={{ borderRightColor: "transparent", animation: "spin 0.7s linear infinite" }} />;
}

/* ================= первый запуск: база пуста ================= */
function SeedAsk() {
  const ask = (useCRM() as any).askSeed as boolean | undefined;
  const crm = useCRM();
  const [busy, setBusy] = useState<"" | "up" | "clean">("");
  if (!ask) return null;

  const upload = async () => {
    setBusy("up");
    const s = useCRM.getState();
    try {
      await uploadAll(
        { users: s.users, stages: s.stages, products: s.products, clients: s.clients, deals: s.deals, objects: s.objects, tasks: s.tasks, jobs: s.jobs, payments: s.payments },
        { leadSources: s.leadSources, objectStatuses: s.objectStatuses, notifPrefs: s.notifPrefs, rolePerms: s.rolePerms }
      );
      crm.toast("Данные выгружены в облако — бригада увидит их сразу", "bell");
    } catch (e: any) {
      crm.toast("Не удалось выгрузить данные: " + (e.message ?? e), "alert");
    } finally { setBusy(""); useCRM.setState({ askSeed: false } as any); }
  };

  const clean = () => {
    const s = useCRM.getState();
    useCRM.setState({
      clients: [], deals: [], objects: [], tasks: [], jobs: [], payments: [],
      users: s.users.filter((u) => u.id === s.currentUserId),
      askSeed: false,
    } as any);
    crm.toast("Чистый лист: справочники сохранены, данные пусты", "bell");
  };

  return (
    <ModalStackCtx.Provider value={{ index: 5, size: 6 }}>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 anim-fade" style={{ background: "rgba(14,20,17,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="card anim-pop w-full max-w-[520px] p-6" style={{ boxShadow: "var(--shadow-lg)" }}>
          <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <Icon name="cloud" size={22} />
          </span>
          <div className="font-display text-[16px] font-bold">Облако пока пустое</div>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>
            База данных подключена, но в ней ещё нет ни одной записи. Выберите, с чего начать:
          </p>
          <div className="grid grid-cols-1 gap-2.5 mt-4">
            <button className="text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ borderColor: "var(--brand)", background: "var(--brand-soft)" }} onClick={upload} disabled={busy !== ""}>
              <span className="flex items-center gap-2 text-[13.5px] font-extrabold" style={{ color: "var(--brand)" }}>
                {busy === "up" ? <Spinner /> : <Icon name="box" size={17} />} Выгрузить мои текущие данные
              </span>
              <span className="block text-[12px] mt-1" style={{ color: "var(--muted)" }}>
                Всё, что вы видите сейчас (демо-бригада: клиенты, сделки, объекты…), станет общим для команды
              </span>
            </button>
            <button className="text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ borderColor: "var(--line)", background: "var(--panel)" }} onClick={clean} disabled={busy !== ""}>
              <span className="flex items-center gap-2 text-[13.5px] font-extrabold">
                {busy === "clean" ? <Spinner /> : <Icon name="sparkle" size={17} />} Начать с чистого листа
              </span>
              <span className="block text-[12px] mt-1" style={{ color: "var(--muted)" }}>
                Пустые списки; воронка продаж и каталог товаров останутся настроенными
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalStackCtx.Provider>
  );
}
