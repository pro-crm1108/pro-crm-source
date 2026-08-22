import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/icons";
import { Modal, Avatar, AvatarPicker, ToneChip, PayExpScale, Empty, Seg } from "../components/ui";
import { useCRM, useCan, usePermScope, uid, iso, money, moneyShort, dealTotal, dealPaid, productName, toLocal, fromLocal, dtFmt, dFmt, dueLabel } from "../store";
import type { Deal, DealItem, Task, Payment } from "../types";

type Tab = "overview" | "items" | "object" | "finance" | "history";
const TABS: { id: Tab; t: string }[] = [
  { id: "overview", t: "Обзор" }, { id: "items", t: "Товар" }, { id: "object", t: "Объект" },
  { id: "finance", t: "Финансы" }, { id: "history", t: "История" },
];

export default function DealModal({ id, stageId }: { id?: string; stageId?: string }) {
  const crm = useCRM();
  const { deals, stages, clients, users, products, tasks, payments, objects, leadSources,
    currentUserId, closeModal, openModal, saveDeal, deleteDeal, archiveDeal, toast } = crm;
  const existing = deals.find((d) => d.id === id);
  const isNew = !existing;
  const creatingRef = useRef(false);

  const [tab, setTab] = useState<Tab>("overview");
  // new-deal local form
  const [f, setF] = useState<Deal>(() => existing ?? {
    id: uid(), title: "", clientId: "",
    /* если открыли из конкретной колонки канбана — сделка сразу в этой стадии */
    stageId: stageId ?? stages[0]?.id ?? "st1",
    type: "Услуга",
    comment: "", estimate: 0, source: leadSources[0] ?? "", date: new Date().toISOString(),
    ownerId: currentUserId, items: [], createdAt: iso(Date.now()),
  });
  const [dateLocal, setDateLocal] = useState(toLocal(f.date));
  const [clientMode, setClientMode] = useState<"base" | "new">("base");
  const [nc, setNc] = useState({ name: "", phone: "", email: "", company: "", kind: "fiz" as "fiz" | "yur" });
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [pendingPays, setPendingPays] = useState<Payment[]>([]);

  // маркер отложенной привязки объекта, созданного до сохранения сделки
  const pendingMark = `pending:${f.id}`;

  const set = (p: Partial<Deal>) => {
    if (isNew) setF((x) => ({ ...x, ...p }));
    else saveDeal({ ...(existing as Deal), ...p }, false);
  };
  const d = isNew ? f : (existing as Deal);

  // объект, созданный «поверх» новой сделки, автоматически выбирается
  useEffect(() => {
    if (!isNew) return;
    const po = objects.find((o) => o.dealId === pendingMark);
    if (po && f.objectId !== po.id) setF((x) => ({ ...x, objectId: po.id }));
  }, [objects, isNew, pendingMark, f.objectId]);

  // при отмене — снимаем отложенную привязку, чтобы объект остался «свободным»
  const handleClose = () => {
    if (isNew) {
      useCRM.getState().objects.filter((o) => o.dealId === pendingMark)
        .forEach((o) => crm.saveObject({ ...o, dealId: undefined }, false));
    }
    closeModal();
  };

  const client = clients.find((c) => c.id === d.clientId);
  const total = dealTotal(d);
  const paid = dealPaid(d, payments);
  const rest = Math.max(0, total - paid);
  const itemsTotal = d.items.reduce((a, i) => a + i.qty * i.price, 0);
  const obj = objects.find((o) => o.id === d.objectId);
  const stageIdx = stages.findIndex((s) => s.id === d.stageId);

  /* -------- ПРАВА -------- */
  const scope = usePermScope();
  const can = useCan();
  const isOwner = d.ownerId === currentUserId;
  /* просмотр карточки: «только свои» → чужие карточки закрыты */
  const viewScope = scope("deals.viewCard");
  const canOpen = isNew || viewScope === "granted" || (viewScope === "own" && isOwner);
  /* редактирование полей сделки (тип, комментарии, дата, состав, перевод по воронке) */
  const editScope = scope("deals.edit");
  const canEdit = isNew || editScope === "granted" || (editScope === "own" && isOwner);

  const create = () => {
    /* защита от повторного создания (двойной клик / двойное нажатие Enter) */
    if (creatingRef.current) return;
    creatingRef.current = true;
    let clientId = d.clientId;
    if (clientMode === "new") {
      if (!nc.name.trim()) { toast("Укажите ФИО клиента", "alert"); return; }
      const c = { id: uid(), name: nc.name.trim(), kind: nc.kind, phone: nc.phone, email: nc.email, company: nc.company, comment: "", createdAt: iso(Date.now()) };
      crm.saveClient(c, true);
      clientId = c.id;
    }
    if (!clientId) { toast("Выберите клиента из базы", "alert"); return; }
    const cl = clientMode === "new" ? nc.name : clients.find((c) => c.id === clientId)?.name;
    const deal: Deal = {
      ...f, clientId, date: fromLocal(dateLocal),
      title: f.title.trim() || `Сделка — ${cl ?? "клиент"}`,
    };
    saveDeal(deal, true);
    pendingTasks.forEach((t) => crm.saveTask({ ...t, dealId: deal.id }, true));
    pendingPays.forEach((p) => crm.addPayment({ ...p, dealId: deal.id, clientId: deal.clientId }));
    const pendingObjs = useCRM.getState().objects.filter((o) => o.dealId === pendingMark);
    pendingObjs.forEach((o) => crm.saveObject({ ...o, dealId: o.id === deal.objectId ? deal.id : undefined }, false));
    const others = new Set(pendingTasks.filter((t) => t.assigneeId !== currentUserId).map((t) => users.find((u) => u.id === t.assigneeId)?.name).filter(Boolean));
    toast(`Сделка «${deal.title}» создана`);
    const linkedObj = pendingObjs.find((o) => o.id === deal.objectId);
    if (linkedObj) toast(`Объект «${linkedObj.title}» привязан к сделке`, "bell");
    if (pendingPays.length > 0) toast(`Проведено платежей: ${pendingPays.length}`, "ruble");
    others.forEach((n) => toast(`Уведомление отправлено: ${n}`, "bell"));
    closeModal();
  };

  const footerBar = (
    <>
      {!isNew && !d.archived && canEdit && (
        <>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 40%, var(--line))" }}
            onClick={() => { archiveDeal(d.id, "done"); toast("Сделка завершена и перенесена в архив", "bell"); closeModal(); }}
            title="Завершить сделку и перенести в архив">
            <Icon name="check" size={15} sw={2.2} /> Сделка завершена
          </button>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 40%, var(--line))" }}
            onClick={() => { archiveDeal(d.id, "lost"); toast("Сделка прервана и перенесена в архив", "alert"); closeModal(); }}
            title="Прервать сделку и перенести в архив">
            <Icon name="x" size={15} sw={2.2} /> Сделка прервана
          </button>
        </>
      )}
      {!isNew && d.archived && (
        <span className="chip" style={{ background: d.archived === "done" ? "var(--green-soft)" : "var(--red-soft)", color: d.archived === "done" ? "var(--green)" : "var(--red)" }}>
          <Icon name="archive" size={12} /> {d.archived === "done" ? "в архиве: завершена" : "в архиве: прервана"}
        </span>
      )}
      {!isNew && canEdit && !d.archived && (
        <button className="btn btn-danger" onClick={() => { deleteDeal(d.id); toast("Сделка удалена"); closeModal(); }}>
          <Icon name="trash" size={15} /> Удалить
        </button>
      )}
      {!isNew && !canEdit && (
        <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
          <Icon name="eye" size={12} /> только просмотр
        </span>
      )}
      <div className="flex-1" />
      <span className="text-[12px] font-bold mr-1" style={{ color: "var(--muted)" }}>
        Сумма: <span className="font-display" style={{ color: "var(--ink)" }}>{money(total)}</span>
      </span>
      <button className="btn btn-ghost" onClick={handleClose}>{isNew ? "Отмена" : "Закрыть"}</button>
      {isNew && <button className="btn btn-primary" onClick={create}><Icon name="check" size={15} sw={2.4} /> Создать сделку</button>}
    </>
  );

  /* нет права на просмотр этой карточки */
  if (!canOpen) {
    return (
      <Modal onClose={closeModal} width={440} icon="lock" title="Нет доступа">
        <div className="p-6 text-center">
          <div className="text-[13.5px] font-semibold leading-relaxed" style={{ color: "var(--muted)" }}>
            Ваша должность позволяет просматривать только свои сделки. Эта сделка закреплена за другим сотрудником.
          </div>
          <button className="btn btn-ghost mt-4" onClick={closeModal}>Понятно</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={handleClose} width={1080} icon="kanban" fill footer={footerBar}
      title={isNew ? "Новая сделка" : <span className="flex items-center gap-2.5 min-w-0">
        <span className="truncate">{d.title}</span>
        <ToneChip tone={stageIdx >= stages.length - 1 ? "green" : "muted"}>{stages[stageIdx]?.title}</ToneChip>
      </span>}>
      {/* funnel progress */}
      <FunnelProgress stages={stages} current={d.stageId} onSelect={canEdit ? (sid) => {
        set({ stageId: sid });
        if (!isNew) toast(`Стадия: «${stages.find((s) => s.id === sid)?.title}»`, "bell");
      } : undefined} />

      {/* tabs */}
      <div className="flex items-center gap-1 px-5 border-b overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        {TABS.map((t) => {
          const disabled = isNew && t.id === "history";
          return (
            <button key={t.id} disabled={disabled} onClick={() => setTab(t.id)}
              className="px-3.5 py-2.5 text-[12.5px] font-extrabold whitespace-nowrap cursor-pointer transition-colors relative disabled:cursor-not-allowed disabled:opacity-35"
              style={{ color: tab === t.id ? "var(--brand)" : "var(--muted)" }}>
              {t.t}
              {tab === t.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full" style={{ background: "var(--brand)" }} />}
            </button>
          );
        })}
        {isNew && <span className="ml-auto text-[11px] font-semibold pb-1" style={{ color: "var(--faint)" }}>история появится после создания</span>}
      </div>

      {/* body: two equal halves, independent scroll */}
      <div className="grid grid-cols-2 flex-1 min-h-0" style={{ borderColor: "var(--line)" }}>
        <div className="p-5 overflow-y-auto min-h-0 border-r" style={{ borderColor: "var(--line)" }}>
          {tab === "overview" && (
            isNew ? <NewDealForm d={d} set={set} dateLocal={dateLocal} setDateLocal={setDateLocal}
              clientMode={clientMode} setClientMode={setClientMode} nc={nc} setNc={setNc}
              itemsTotal={itemsTotal} />
              : <OverviewPane d={d} set={set} dateLocal={dateLocal} setDateLocal={setDateLocal}
                total={total} paid={paid} rest={rest} client={client} obj={obj} goItems={() => setTab("items")} />
          )}
          {tab === "items" && <ItemsTab d={d} set={set} isNew={isNew} />}
          {tab === "object" && (isNew
            ? <ObjectNewPane d={d} set={set} pendingMark={pendingMark} />
            : <ObjectTab d={d} set={set} obj={obj} />)}
          {tab === "finance" && (
            isNew
              ? <FinanceNewPane total={total} pending={pendingPays}
                  onAdd={(p) => setPendingPays((x) => [...x, p])}
                  onRemove={(pid) => setPendingPays((x) => x.filter((q) => q.id !== pid))} />
              : <FinanceTab d={d} total={total} paid={paid} rest={rest} />
          )}
          {tab === "history" && (isNew
            ? <Empty icon="clock" text="История сделки появится после её создания" />
            : <HistoryTab d={d} />)}
        </div>
        <div className="overflow-y-auto min-h-0" style={{ background: "var(--panel2)" }}>
          <TaskPanel dealId={isNew ? undefined : d.id} isNew={isNew} pending={pendingTasks} setPending={setPendingTasks} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- funnel progress ---------- */
function FunnelProgress({ stages, current, onSelect }: { stages: any[]; current: string; onSelect?: (id: string) => void }) {
  const idx = stages.findIndex((s: any) => s.id === current);
  return (
    <div className="px-5 pt-4 pb-2.5 border-b" style={{ borderColor: "var(--line)" }}>
      {/* items-start: все полоски выровнены по верхнему краю, даже если подпись в 2 строки */}
      <div className="flex items-start gap-1">
        {stages.map((s: any, i: number) => (
          <button key={s.id} className={`flex-1 group flex flex-col ${onSelect ? "cursor-pointer" : "cursor-default"}`}
            onClick={() => onSelect?.(s.id)}
            title={onSelect ? `Перевести в «${s.title}»` : `«${s.title}» — нет права на изменение стадии`}>
            <div className="h-[5px] rounded-full w-full transition-all flex-none"
              style={{ background: i <= idx ? s.color : "var(--line)", opacity: i === idx ? 1 : i < idx ? 0.75 : 1 }} />
            {/* единая высота в 2 строки: длинные названия переносятся, короткие — не смещают ряд */}
            <div className="text-[10px] font-extrabold mt-1.5 text-center leading-tight min-h-[26px] line-clamp-2 transition-colors"
              style={{ color: i === idx ? s.color : i < idx ? "var(--muted)" : "var(--faint)" }}>
              {s.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- NEW DEAL form ---------- */
function NewDealForm({ d, set, dateLocal, setDateLocal, clientMode, setClientMode, nc, setNc, itemsTotal }: any) {
  const { clients, stages, users, leadSources } = useCRM();
  return (
    <div className="space-y-5">
      {/* 1. client */}
      <Block n={1} title="Клиент">
        <div className="flex items-center justify-between mb-2.5">
          <Seg value={clientMode} onChange={setClientMode} options={[{ v: "base", t: "Из базы" }, { v: "new", t: "Регистрация" }]} />
        </div>
        {clientMode === "base" ? (
          <select className="select" value={d.clientId} onChange={(e) => set({ clientId: e.target.value })}>
            <option value="">— выберите клиента —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
          </select>
        ) : (
          <div className="space-y-2.5">
            <input className="input" placeholder="ФИО клиента *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2.5">
              <input className="input" placeholder="Телефон" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} />
              <input className="input" placeholder="Почта" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-2.5">
              <Seg value={nc.kind} onChange={(v) => setNc({ ...nc, kind: v })} options={[{ v: "fiz", t: "Физ. лицо" }, { v: "yur", t: "Юр. лицо" }]} />
              {nc.kind === "yur" && <input className="input flex-1" placeholder="Фирма" value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} />}
            </div>
          </div>
        )}
      </Block>

      {/* 2. need */}
      <Block n={2} title="Выявление потребности">
        <div className="label">Тип сделки</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(["Товар", "Услуга", "Комплекс"] as const).map((t) => (
            <button key={t} onClick={() => set({ type: t })}
              className="py-2 rounded-[9px] border-2 text-[12.5px] font-bold cursor-pointer transition-all"
              style={{ borderColor: d.type === t ? "var(--brand)" : "var(--line)", background: d.type === t ? "var(--brand-soft)" : "var(--panel)", color: d.type === t ? "var(--brand)" : "var(--muted)" }}>
              {t}
            </button>
          ))}
        </div>
        <div className="label">Комментарий</div>
        <textarea className="textarea" placeholder="Что нужно клиенту, детали запроса…" value={d.comment} onChange={(e) => set({ comment: e.target.value })} />
        <div className="label mt-3">Примерный расчёт стоимости</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input className="input !pr-8 font-display !font-bold" inputMode="numeric" value={d.estimate || ""} placeholder="0"
              onChange={(e) => set({ estimate: parseFloat(e.target.value) || 0 })} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: "var(--faint)" }}>₽</span>
          </div>
          <button className="btn btn-soft btn-sm whitespace-nowrap" title="Подтянуть сумму из позиций каталога"
            onClick={() => set({ estimate: itemsTotal })}>
            <Icon name="box" size={14} /> из каталога · {moneyShort(itemsTotal)}
          </button>
        </div>
      </Block>

      {/* 3. stage & meta */}
      <Block n={3} title="Стадия и ответственный">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="label">Стадия (канбан)</div>
            <select className="select" value={d.stageId} onChange={(e) => set({ stageId: e.target.value })}>
              {stages.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Источник лида</div>
            <select className="select" value={d.source} onChange={(e) => set({ source: e.target.value })}>
              {leadSources.map((s: string) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Дата</div>
            <input type="datetime-local" className="input" value={dateLocal} onChange={(e) => setDateLocal(e.target.value)} />
          </div>
          <div>
            <div className="label">Ответственный</div>
            <div className="flex items-center gap-2">
              <AvatarPicker value={d.ownerId} onChange={(v) => set({ ownerId: v })} users={users} />
              <span className="text-[12px] font-bold truncate">{users.find((u: any) => u.id === d.ownerId)?.name}</span>
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <div className="label">Название сделки</div>
          <input className="input" placeholder="Например: Ремонт квартиры под ключ" value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </Block>

      {/* 4. items */}
      <Block n={4} title="Товары и услуги (каталог)">
        <ItemsEditor items={d.items} onItems={(next) => set({ items: next })} compact />
      </Block>
    </div>
  );
}

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[11.5px] font-extrabold font-display flex-none" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{n}</span>
        <span className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>{title}</span>
      </div>
      {children}
    </section>
  );
}

/* ---------- OVERVIEW (existing) ---------- */
function OverviewPane({ d, set, dateLocal, setDateLocal, total, paid, rest, client, obj, goItems }: any) {
  const { users, stages, leadSources, payments, openModal, products, jobs, currentUserId, clients, toast } = useCRM();
  const scope = usePermScope();
  const can = useCan();
  /* режим замены клиента (карандашик) */
  const [swapClient, setSwapClient] = useState(false);
  const expense = payments.filter((p: any) => p.kind === "expense" && p.dealId === d.id).reduce((a: number, p: any) => a + p.amount, 0);
  /* права на редактирование этой сделки */
  const isOwner = d.ownerId === currentUserId;
  const editScope = scope("deals.edit");
  const canEdit = editScope === "granted" || (editScope === "own" && isOwner);
  const canAssignee = can("deals.assignee") && canEdit; /* смена ответственного */
  const dis = !canEdit; /* заблокировать поля */
  return (
    <div className="space-y-5">
      {/* finances */}
      <section>
        <div className="grid grid-cols-4 gap-2.5">
          <FinTile label="Сумма сделки" val={moneyShort(total)} tone="var(--ink)" />
          <FinTile label="Оплачено" val={moneyShort(paid)} tone="var(--green)" />
          <FinTile label="Расход" val={moneyShort(expense)} tone="var(--red)" />
          <FinTile label="Остаток" val={moneyShort(rest)} tone={rest > 0 ? "var(--amber)" : "var(--green)"} />
        </div>
        <div className="mt-2.5">
          <PayExpScale total={total} paid={paid} expense={expense} />
        </div>
      </section>

      {/* client */}
      <Block n={1} title="Клиент">
        {client ? (
          <div className="flex items-center gap-3 p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none" style={{ background: client.kind === "yur" ? "var(--blue-soft)" : "var(--brand-soft)", color: client.kind === "yur" ? "var(--blue)" : "var(--brand)" }}>
              <Icon name={client.kind === "yur" ? "firm" : "user"} size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold truncate">{client.name}</div>
              <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{client.phone}{client.company ? ` · ${client.company}` : ""}</div>
            </div>
            {/* смена клиента (карандашик) — если выбрали не того */}
            {canEdit && (
              swapClient ? (
                <select className="select !w-auto !py-1.5 !px-2 !text-[12px] font-bold" autoFocus
                  value={d.clientId}
                  onChange={(e) => { set({ clientId: e.target.value }); setSwapClient(false); toast("Клиент сделки изменён"); }}
                  onBlur={() => setSwapClient(false)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <button className="icon-btn !w-8 !h-8" onClick={() => setSwapClient(true)} title="Сменить клиента">
                  <Icon name="pencil" size={15} />
                </button>
              )
            )}
            <button className="btn btn-soft btn-sm" onClick={() => openModal({ type: "client", id: client.id })}>Карточка</button>
          </div>
        ) : <Empty icon="user" text="Клиент не привязан" />}
      </Block>

      {/* object */}
      <Block n={2} title="Объект">
        {obj ? (
          <div className="p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <div className="flex items-center gap-2">
              <Icon name="building" size={16} className="text-[var(--blue)]" />
              <span className="text-[13px] font-extrabold flex-1 truncate">{obj.title}</span>
              <ToneChip tone="muted">{obj.status}</ToneChip>
            </div>
            <div className="text-[11.5px] mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--muted)" }}>
              <span>{obj.address}</span><span>{obj.kind} · {obj.area}</span>
              <span>{jobs.filter((j: any) => j.objectId === obj.id && j.stage !== "done").length} активных работ</span>
            </div>
            <button className="btn btn-soft btn-sm mt-2.5" onClick={() => openModal({ type: "object", id: obj.id })}>Открыть объект</button>
          </div>
        ) : (
          <div className="p-3 rounded-[10px]" style={{ border: "1.5px dashed var(--line2)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>Объект не привязан к сделке</span>
              {can("objects.create") && canEdit && (
                <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "object", dealId: d.id })}><Icon name="plus" size={13} sw={2.4} /> Создать</button>
              )}
            </div>
          </div>
        )}
      </Block>

      {/* deal meta */}
      <Block n={3} title="Параметры сделки">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="label">Тип сделки</div>
            <select className="select" value={d.type} disabled={dis} onChange={(e) => set({ type: e.target.value })}>
              {["Товар", "Услуга", "Комплекс"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Источник лида</div>
            <select className="select" value={d.source} disabled={dis} onChange={(e) => set({ source: e.target.value })}>
              {leadSources.map((s: string) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Дата</div>
            <input type="datetime-local" className="input" value={dateLocal} disabled={dis} onChange={(e) => { setDateLocal(e.target.value); set({ date: fromLocal(e.target.value) }); }} />
          </div>
          <div>
            <div className="label">Ответственный</div>
            <div className="flex items-center gap-2">
              {canAssignee ? (
                <AvatarPicker value={d.ownerId} onChange={(v) => set({ ownerId: v })} users={users} />
              ) : (
                <Avatar user={users.find((u: any) => u.id === d.ownerId)} size={28} />
              )}
              <span className="text-[12px] font-bold truncate">{users.find((u: any) => u.id === d.ownerId)?.name}</span>
            </div>
          </div>
          <div className="col-span-2">
            <div className="label">Комментарии</div>
            <textarea className="textarea" value={d.comment} readOnly={dis} onChange={(e) => set({ comment: e.target.value })} placeholder="Заметки по сделке…" />
          </div>
        </div>
        {dis && (
          <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
            <Icon name="lock" size={12} /> Поля доступны только для просмотра — нет права «Редактирование сделки»
          </p>
        )}
      </Block>

      {/* items preview */}
      <Block n={4} title="Товары и услуги">
        {d.items.length === 0 ? (
          <div className="flex items-center justify-between p-3 rounded-[10px]" style={{ border: "1.5px dashed var(--line2)" }}>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>Позиции из каталога не добавлены</span>
            {canEdit && <button className="btn btn-soft btn-sm" onClick={goItems}><Icon name="plus" size={13} sw={2.4} /> Добавить</button>}
          </div>
        ) : (
          <div>
            {d.items.map((i: DealItem, k: number) => (
              <div key={k} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
                <span className="flex-1 truncate font-semibold">{productName(i.productId, products)}</span>
                <span style={{ color: "var(--muted)" }}>{i.qty} × {money(i.price)}</span>
                <span className="font-extrabold w-[90px] text-right">{money(i.qty * i.price)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <button className="text-[12px] font-bold cursor-pointer hover:opacity-75" style={{ color: "var(--brand)" }} onClick={goItems}>Редактировать состав →</button>
              <span className="font-display text-[13.5px] font-bold">{money(itemsSum(d.items))}</span>
            </div>
          </div>
        )}
      </Block>
    </div>
  );
}

const itemsSum = (items: DealItem[]) => items.reduce((a, i) => a + i.qty * i.price, 0);

function FinTile({ label, val, tone }: { label: string; val: string; tone: string }) {
  return (
    <div className="p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
      <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-display text-[15px] font-bold mt-1" style={{ color: tone }}>{val}</div>
    </div>
  );
}

/* ---------- FINANCE for a NEW deal (pending payments) ---------- */
function FinanceNewPane({ total, pending, onAdd, onRemove }: {
  total: number; pending: Payment[];
  onAdd: (p: Payment) => void; onRemove: (id: string) => void;
}) {
  const { toast } = useCRM();
  const paid = pending.reduce((a, p) => a + p.amount, 0);
  const rest = Math.max(0, total - paid);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Перевод на р/с");
  const [note, setNote] = useState("");
  const [dateL, setDateL] = useState(toLocal(new Date().toISOString()).slice(0, 10));

  const add = () => {
    const sum = parseFloat(amount.replace(",", "."));
    if (!sum || sum <= 0) { toast("Укажите сумму платежа", "alert"); return; }
    onAdd({ id: uid(), kind: "income", amount: sum, date: new Date(dateL + "T12:00").toISOString(), method, note: note.trim() || "Платёж по сделке" });
    toast(`Платёж ${money(sum)} будет проведён при создании сделки`, "ruble");
    setAmount(""); setNote("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>Финансы сделки</div>
        <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>проведутся при создании</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <FinTile label="Сумма" val={moneyShort(total)} tone="var(--ink)" />
        <FinTile label="Оплачено" val={moneyShort(paid)} tone="var(--green)" />
        <FinTile label="Остаток" val={moneyShort(rest)} tone={rest > 0 ? "var(--amber)" : "var(--green)"} />
      </div>
      <PayExpScale total={total} paid={paid} expense={0} />

      <div className="mt-5">
        <div className="label">Планируемые платежи</div>
        {pending.length === 0 ? (
          <div className="text-[12.5px] font-semibold p-4 rounded-[10px] text-center" style={{ color: "var(--faint)", border: "1.5px dashed var(--line2)" }}>
            Платежей пока нет — добавьте первый ниже
          </div>
        ) : (
          <div className="space-y-1.5">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-[9px] border anim-pop" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                  <Icon name="ruble" size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold truncate">{p.note}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{p.method} · {dFmt(p.date)}</div>
                </div>
                <span className="font-display text-[12.5px] font-bold" style={{ color: "var(--green)" }}>+{money(p.amount)}</span>
                <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" onClick={() => onRemove(p.id)} title="Убрать платёж">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card !shadow-none !rounded-[11px] p-3.5 mt-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="label">Сумма, ₽</div>
            <div className="relative">
              <input className="input !pr-8 font-display !font-bold" placeholder="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: "var(--faint)" }}>₽</span>
            </div>
            {rest > 0 && (
              <button className="mt-1.5 text-[11.5px] font-bold cursor-pointer hover:opacity-75" style={{ color: "var(--amber)" }} onClick={() => setAmount(String(rest))}>
                Подставить остаток: {money(rest)}
              </button>
            )}
          </div>
          <div>
            <div className="label">Дата</div>
            <input type="date" className="input" value={dateL} onChange={(e) => setDateL(e.target.value)} />
          </div>
          <div>
            <div className="label">Способ</div>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Наличные", "Карта", "Перевод на р/с", "СБП"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Комментарий</div>
            <input className="input" placeholder="Аванс по договору…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary w-full mt-3" onClick={add}><Icon name="plus" size={15} sw={2.4} /> Добавить платёж</button>
      </div>
    </div>
  );
}

/* ---------- ITEMS tab ---------- */
function ItemsTab({ d, set, isNew }: { d: Deal; set: (p: Partial<Deal>) => void; isNew: boolean }) {
  const { currentUserId, saveDeal, toast } = useCRM();
  const scope = usePermScope();
  const editScope = scope("deals.edit");
  const canEdit = isNew || editScope === "granted" || (editScope === "own" && d.ownerId === currentUserId);

  /* Товары сохраняются СРАЗУ (автосохранение) — они никогда не теряются.
     · для НОВОЙ сделки — пишем в локальную форму (сделки ещё нет в базе);
     · для существующей — сразу в базу.
     А кнопка «Сохранить заказ» лишь ПОДТВЕРЖДАЕТ заказ и отправляет
     уведомление закупщику (для существующих сделок). */
  const applyItems = (next: DealItem[]) => {
    if (isNew) set({ items: next });                          // новая сделка — локально
    else saveDeal({ ...d, items: next }, false);              // существующая — в базу (без уведомления)
  };

  /* есть ли позиции, которые ещё не подтверждены (qty > confirmedQty) */
  const pendingConfirm = d.items.some((i) => !i.paid && i.productId !== "custom" && i.qty > 0 && i.qty > (i.confirmedQty ?? 0));

  const confirm = () => {
    // помечаем все позиции подтверждёнными (confirmedQty = qty) и шлём уведомление
    saveDeal({ ...d, items: d.items.map((i) => ({ ...i, confirmedQty: i.qty })) }, false, { bookings: true });
    toast("Заказ подтверждён · закупщик получил уведомление", "bell");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>Состав сделки</div>
        <span className="font-display text-[14px] font-bold">{money(itemsSum(d.items))}</span>
      </div>
      <ItemsEditor items={d.items} onItems={applyItems} readOnly={!canEdit} />

      {/* для существующей сделки — кнопка подтверждения заказа */}
      {canEdit && !isNew && pendingConfirm && (
        <div className="mt-3 p-3 rounded-[11px] border flex items-center gap-2.5 anim-pop"
          style={{ borderColor: "color-mix(in srgb, var(--amber) 45%, var(--line))", background: "var(--amber-soft)" }}>
          <Icon name="layers" size={15} className="text-[var(--amber)] flex-none" />
          <span className="text-[12px] font-bold flex-1" style={{ color: "var(--muted)" }}>
            Товары сохранены. Подтвердите заказ — закупщик получит уведомление и товар встанет в бронь
          </span>
          <button className="btn btn-primary btn-sm" onClick={confirm}><Icon name="check" size={13} sw={2.6} /> Сохранить заказ</button>
        </div>
      )}

      {/* для новой сделки — уведомление уйдёт при создании сделки */}
      {isNew && d.items.length > 0 && (
        <p className="mt-3 text-[11.5px] font-semibold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Icon name="note" size={13} className="flex-none" /> Уведомление закупщику о брони будет отправлено, когда вы создадите сделку.
        </p>
      )}

      <p className="text-[11.5px] mt-3 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
        <Icon name="note" size={13} className="mt-px flex-none" /> Товары резервируются на складе, позиции «вручную» — нет. Сумма сделки считается по позициям.
      </p>
    </div>
  );
}

const itemTitle = (i: { productId: string; name?: string }, products: { id: string; name: string }[]) =>
  i.productId === "custom" ? (i.name ?? "Позиция") : (products.find((x) => x.id === i.productId)?.name ?? "Позиция");
const itemUnit = (i: { productId: string; unit?: string }, products: { id: string; unit: string }[]) =>
  i.productId === "custom" ? (i.unit ?? "шт") : (products.find((x) => x.id === i.productId)?.unit ?? "шт");

function ItemsEditor({ items, onItems, compact, readOnly }: { items: DealItem[]; onItems: (next: DealItem[]) => void; compact?: boolean; readOnly?: boolean }) {
  const { products } = useCRM();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState(false);
  const [mf, setMf] = useState({ name: "", unit: "шт", qty: 1, purchase: "", price: "" });
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [ddPos, setDdPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);

  /* Выпадающий список рендерится порталом в body с position:fixed —
     поэтому его не обрезает прокручиваемая область и не перекрывает нижняя панель. */
  const openDd = () => {
    const r = inputWrapRef.current?.getBoundingClientRect();
    if (r) setDdPos({ top: r.bottom + 6, left: r.left, width: r.width });
    setOpen(true);
  };
  /* закрываем список при прокрутке (в т.ч. внутренней) и изменении размера окна */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  /* закрываем при клике вне поля ввода и вне самого списка */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputWrapRef.current?.contains(t)) return;
      if (ddRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* подсветка строки, которой только что увеличили количество */
  const flash = (idx: number) => {
    setFlashIdx(idx);
    window.setTimeout(() => setFlashIdx((cur) => (cur === idx ? null : cur)), 900);
  };

  const s = q.trim().toLowerCase();
  const found = s.length > 0 ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;

  const add = (p: { id: string; price: number; purchasePrice?: number; kind: string }) => {
    const amount = qty > 0 ? qty : 1;
    /* если товар уже есть в заказе — увеличиваем количество, а не плодим дубли строк */
    const ex = items.findIndex((i) => i.productId === p.id && !i.paid);
    if (ex >= 0) {
      onItems(items.map((i, n) => (n === ex ? { ...i, qty: i.qty + amount } : i)));
      flash(ex);
    } else {
      onItems([...items, { productId: p.id, qty: amount, price: p.price, purchasePrice: p.kind === "товар" ? p.purchasePrice : undefined }]);
      flash(items.length);
    }
    setQ(""); setQty(1); setOpen(false);
  };
  const addManual = () => {
    if (!mf.name.trim()) return;
    onItems([...items, {
      productId: "custom", name: mf.name.trim(), unit: mf.unit.trim() || "шт",
      qty: mf.qty > 0 ? mf.qty : 1,
      price: parseFloat(mf.price.replace(",", ".")) || 0,
      purchasePrice: parseFloat(mf.purchase.replace(",", ".")) || 0,
    }]);
    setMf({ name: "", unit: "шт", qty: 1, purchase: "", price: "" });
    setManual(false);
  };

  return (
    <div>
      {items.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {items.map((i, k) => {
            const custom = i.productId === "custom";
            const p = products.find((x) => x.id === i.productId);
            const iconKind = custom ? "note" : (p?.kind === "товар" ? "box" : "hammer");
            return (
              <div key={k} className={`flex items-center gap-2 p-2 rounded-[9px] border ${flashIdx === k ? "row-flash" : ""}`}
                style={{ borderColor: flashIdx === k ? "color-mix(in srgb, var(--brand) 50%, var(--line))" : "var(--line)", background: "var(--panel)" }}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center flex-none"
                  style={{ background: iconKind === "box" ? "var(--blue-soft)" : iconKind === "hammer" ? "var(--brand-soft)" : "var(--panel2)", color: iconKind === "box" ? "var(--blue)" : iconKind === "hammer" ? "var(--brand)" : "var(--muted)" }}>
                  <Icon name={iconKind} size={13} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold truncate">
                    {itemTitle(i, products)}
                    {custom && <span className="chip ml-1.5" style={{ background: "var(--panel2)", color: "var(--muted)" }}>вручную</span>}
                    {i.paid && <span className="chip ml-1.5" style={{ background: "var(--green-soft)", color: "var(--green)" }}>оплачено</span>}
                  </div>
                  {!compact && <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>{itemUnit(i, products)} · цена {money(i.price)}</div>}
                </div>
                {readOnly ? (
                  <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: "var(--muted)" }}>{i.qty} {itemUnit(i, products)}</span>
                ) : (
                  <input type="number" min={0} className="input !w-[64px] !py-1 !px-2 !text-[12px] text-center"
                    value={i.qty} onChange={(e) => onItems(items.map((x, n) => n === k ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))} />
                )}
                {!compact && !readOnly && (
                  <input type="number" min={0} className="input !w-[86px] !py-1 !px-2 !text-[12px] text-right"
                    value={i.price} onChange={(e) => onItems(items.map((x, n) => n === k ? { ...x, price: parseFloat(e.target.value) || 0 } : x))} />
                )}
                <span className="text-[12px] font-extrabold w-[86px] text-right whitespace-nowrap">{money(i.qty * i.price)}</span>
                {!readOnly && (
                  <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" onClick={() => onItems(items.filter((_, n) => n !== k))}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {items.length === 0 && readOnly && (
        <div className="text-[12px] font-semibold mb-3" style={{ color: "var(--faint)" }}>Позиции не добавлены</div>
      )}
      {!readOnly && !manual && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1" ref={inputWrapRef}>
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input className="input !pl-9" placeholder="Начните вводить товар или услугу…" value={q}
              onChange={(e) => { setQ(e.target.value); openDd(); }} onFocus={openDd} />
            {open && ddPos && createPortal(
              <div ref={ddRef} className="card p-1.5 overflow-y-auto anim-fade"
                style={{ position: "fixed", top: ddPos.top, left: ddPos.left, width: ddPos.width, maxHeight: 280, zIndex: 200, boxShadow: "var(--shadow-lg)" }}>
                {found.length === 0 && <div className="px-3 py-3 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>В каталоге нет «{q}» — впишите позицию вручную ↓</div>}
                {found.filter((p) => p.kind === "товар").length > 0 && <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-extrabold tracking-[0.14em] uppercase" style={{ color: "var(--faint)" }}>Товары (со склада)</div>}
                {found.filter((p) => p.kind === "товар").map((p) => (
                  <button key={p.id} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg row-hover text-left" onClick={() => add(p)}>
                    <Icon name="box" size={14} className="text-[var(--blue)] flex-none" />
                    <span className="text-[12.5px] font-bold flex-1 truncate">{p.name}</span>
                    <span className="text-[10.5px] font-bold" style={{ color: p.stock != null && p.stock <= 0 ? "var(--red)" : "var(--muted)" }}>
                      {p.stock != null ? `${Math.round(p.stock)} ${p.unit} на скл.` : ""}
                    </span>
                    <span className="text-[11.5px] font-extrabold whitespace-nowrap">{money(p.price)}</span>
                  </button>
                ))}
                {found.filter((p) => p.kind === "услуга").length > 0 && <div className="px-2.5 pt-2 pb-1 text-[10px] font-extrabold tracking-[0.14em] uppercase" style={{ color: "var(--faint)" }}>Услуги</div>}
                {found.filter((p) => p.kind === "услуга").map((p) => (
                  <button key={p.id} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg row-hover text-left" onClick={() => add(p)}>
                    <Icon name="hammer" size={14} className="text-[var(--brand)] flex-none" />
                    <span className="text-[12.5px] font-bold flex-1 truncate">{p.name}</span>
                    <span className="text-[11.5px] font-extrabold whitespace-nowrap">{money(p.price)}/{p.unit}</span>
                  </button>
                ))}
                <button className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-lg text-left border-t" style={{ borderColor: "var(--line)", color: "var(--brand)" }}
                  onClick={() => { setManual(true); setOpen(false); setMf((x) => ({ ...x, name: q })); }}>
                  <Icon name="pencil" size={13} />
                  <span className="text-[12px] font-extrabold">Вписать вручную (ремонт, услуга, чего нет в каталоге)</span>
                </button>
              </div>,
              document.body
            )}
          </div>
          <input type="number" min={1} className="input !w-[70px] text-center" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 1)} title="Количество" />
        </div>
      )}
      {!readOnly && manual && (
        <div className="p-3 rounded-[10px] border anim-pop" style={{ borderColor: "color-mix(in srgb, var(--brand) 40%, var(--line))", background: "var(--panel2)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--brand)" }}>Позиция вручную</span>
            <button className="icon-btn !w-7 !h-7" onClick={() => setManual(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input col-span-2" placeholder="Название (например: Ремонт санузла под ключ)" value={mf.name} onChange={(e) => setMf({ ...mf, name: e.target.value })} autoFocus />
            <div>
              <div className="label">Цена закупки</div>
              <input className="input" inputMode="decimal" placeholder="0" value={mf.purchase} onChange={(e) => setMf({ ...mf, purchase: e.target.value })} />
            </div>
            <div>
              <div className="label">Цена для клиента</div>
              <input className="input" inputMode="decimal" placeholder="0" value={mf.price} onChange={(e) => setMf({ ...mf, price: e.target.value })} />
            </div>
            <div>
              <div className="label">Кол-во</div>
              <input type="number" min={0} className="input" value={mf.qty} onChange={(e) => setMf({ ...mf, qty: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <div className="label">Ед. изм.</div>
              <input className="input" placeholder="шт / м² / услуга" value={mf.unit} onChange={(e) => setMf({ ...mf, unit: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm mt-2.5" onClick={addManual} disabled={!mf.name.trim()}>
            <Icon name="plus" size={13} sw={2.4} /> Добавить в сделку
          </button>
        </div>
      )}
      {readOnly && items.length > 0 && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
          <Icon name="lock" size={12} /> Состав доступен только для просмотра
        </p>
      )}
    </div>
  );
}

/* ---------- OBJECT tab for a NEW deal ---------- */
function ObjectNewPane({ d, set, pendingMark }: { d: Deal; set: (p: Partial<Deal>) => void; pendingMark: string }) {
  const { objects, clients, openModal } = useCRM();
  const sel = objects.find((o) => o.id === d.objectId);
  const isFresh = !!sel && sel.dealId === pendingMark; // создан прямо сейчас, поверх этой сделки
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>Объект сделки</div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "object", dealId: pendingMark })}>
          <Icon name="plus" size={13} sw={2.4} /> Создать объект
        </button>
      </div>
      <div className="p-3.5 rounded-[10px] mb-4 flex items-start gap-2.5" style={{ background: "var(--blue-soft)", border: "1px solid var(--line)" }}>
        <Icon name="note" size={16} className="text-[var(--blue)] mt-px flex-none" />
        <span className="text-[12.5px] font-semibold leading-relaxed" style={{ color: "var(--muted)" }}>
          Создайте новый объект или выберите существующий — привязка к сделке подтвердится в момент её создания.
        </span>
      </div>
      <div className="label">Или выбрать из базы</div>
      <select className="select" value={d.objectId ?? ""} onChange={(e) => set({ objectId: e.target.value || undefined })}>
        <option value="">— без объекта —</option>
        {objects.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title} · {o.address}{o.dealId === pendingMark ? "  (только что создан)" : ""}
          </option>
        ))}
      </select>
      {sel && (
        <div className="p-3.5 rounded-[10px] border mt-3 anim-pop"
          style={{ borderColor: isFresh ? "color-mix(in srgb, var(--brand) 45%, var(--line))" : "var(--line)", background: "var(--panel2)" }}>
          <div className="flex items-center gap-2">
            <Icon name="building" size={16} className="text-[var(--blue)]" />
            <span className="text-[13px] font-extrabold flex-1 truncate">{sel.title}</span>
            {isFresh && <ToneChip tone="green"><Icon name="check" size={11} /> будет привязан</ToneChip>}
            <ToneChip tone="muted">{sel.status}</ToneChip>
          </div>
          <div className="text-[11.5px] mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--muted)" }}>
            <span>{sel.address}</span>
            <span>{sel.kind} · {sel.area}</span>
            <span>Клиент: {clients.find((c) => c.id === sel.clientId)?.name ?? "—"}</span>
          </div>
          <button className="btn btn-soft btn-sm mt-2.5" onClick={() => openModal({ type: "object", id: sel.id })}>
            <Icon name="pencil" size={13} /> Открыть карточку
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- OBJECT tab ---------- */
function ObjectTab({ d, set, obj }: any) {
  const { objects, jobs, users, openModal, clients } = useCRM();
  const can = useCan();
  const canObjEdit = can("objects.edit");
  const canObjCreate = can("objects.create");
  if (!obj) {
    return (
      <div>
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase mb-3" style={{ color: "var(--muted)" }}>Объект сделки</div>
        <Empty icon="building" text="У сделки пока нет объекта"
          action={canObjCreate && canObjEdit ? <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "object", dealId: d.id })}><Icon name="plus" size={13} sw={2.4} /> Создать объект</button> : undefined} />
        {canObjEdit && (
          <>
            <div className="label mt-5">Привязать существующий</div>
            <select className="select" value={d.objectId ?? ""} onChange={(e) => set({ objectId: e.target.value || undefined })}>
              <option value="">— не привязан —</option>
              {objects.map((o: any) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </>
        )}
      </div>
    );
  }
  const oj = jobs.filter((j: any) => j.objectId === obj.id);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>Объект сделки</div>
        {canObjEdit && <button className="btn btn-soft btn-sm" onClick={() => openModal({ type: "object", id: obj.id })}><Icon name="pencil" size={13} /> Изменить</button>}
      </div>
      <div className="p-4 rounded-[10px] border mb-4" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
        <div className="text-[14px] font-extrabold">{obj.title}</div>
        <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>{obj.address}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
          <span>{obj.kind} · {obj.area}</span>
          <span>Клиент: {clients.find((c: any) => c.id === obj.clientId)?.name ?? "—"}</span>
          <ToneChip tone={obj.status === "В работе" ? "green" : "muted"}>{obj.status}</ToneChip>
        </div>
        {obj.comment && <div className="text-[12px] mt-2.5 pt-2.5 border-t" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>{obj.comment}</div>}
      </div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="label !mb-0">Работы · {oj.length}</div>
        {can("objects.works") && <button className="btn btn-soft btn-sm" onClick={() => openModal({ type: "job", objectId: obj.id })}><Icon name="plus" size={13} sw={2.4} /> Работа</button>}
      </div>
      {oj.length === 0 ? <Empty icon="hammer" text="Работ на объекте нет" /> : (
        <div className="space-y-1.5">
          {oj.map((j: any) => {
            const od = j.stage !== "done" && +new Date(j.deadline) < Date.now();
            return (
              <button key={j.id} className="w-full flex items-center gap-2.5 p-2.5 rounded-[9px] border row-hover text-left cursor-pointer" style={{ borderColor: "var(--line)" }}
                onClick={() => openModal({ type: "job", id: j.id })}>
                <ToneChip tone={j.stage === "done" ? "green" : od ? "red" : j.stage === "work" ? "amber" : "muted"}>
                  {j.stage === "plan" ? "План" : j.stage === "work" ? "В работе" : j.stage === "check" ? "Проверка" : "Готово"}
                </ToneChip>
                <span className="text-[12.5px] font-bold flex-1 truncate">{j.title}</span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{dFmt(j.deadline)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- FINANCE tab ---------- */
function FinanceTab({ d, total, paid, rest }: any) {
  const { payments, openModal, deletePayment, toast } = useCRM();
  const list = payments.filter((p: any) => p.dealId === d.id).sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date));
  const expense = payments.filter((p: any) => p.kind === "expense" && p.dealId === d.id).reduce((a: number, p: any) => a + p.amount, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--muted)" }}>Финансы сделки</div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "payment", kind: "income", dealId: d.id })}><Icon name="plus" size={13} sw={2.4} /> Платёж</button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3.5">
        <FinTile label="Сумма" val={moneyShort(total)} tone="var(--ink)" />
        <FinTile label="Оплачено" val={moneyShort(paid)} tone="var(--green)" />
        <FinTile label="Расход" val={moneyShort(expense)} tone="var(--red)" />
        <FinTile label="Остаток" val={moneyShort(rest)} tone={rest > 0 ? "var(--amber)" : "var(--green)"} />
      </div>
      <PayExpScale total={total} paid={paid} expense={expense} />
      {list.length === 0 ? (
        <div className="mt-4"><Empty icon="ruble" text="Поступлений и расходов по сделке ещё не было" /></div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {list.map((p: any) => {
            const income = p.kind === "income";
            return (
              <div key={p.id} className="group flex items-center gap-3 p-2.5 rounded-[9px] border transition-colors hover:border-[var(--faint)]" style={{ borderColor: "var(--line)" }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none"
                  style={{ background: income ? "var(--green-soft)" : "var(--red-soft)", color: income ? "var(--green)" : "var(--red)" }}>
                  <Icon name={income ? "ruble" : "wallet"} size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold truncate">
                    {income ? (p.note || "Поступление") : (p.category || "Расход")}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                    {!income && p.note ? `${p.note} · ` : ""}{p.method} · {dFmt(p.date)}
                  </div>
                </div>
                <span className="font-display text-[13px] font-bold whitespace-nowrap" style={{ color: income ? "var(--green)" : "var(--red)" }}>
                  {income ? "+" : "−"}{money(p.amount)}
                </span>
                <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-none">
                  <button className="icon-btn !w-7 !h-7" title="Редактировать" onClick={() => openModal({ type: "payment", payId: p.id })}>
                    <Icon name="pencil" size={13} />
                  </button>
                  <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" title="Удалить" onClick={() => { deletePayment(p.id); toast("Платёж удалён"); }}>
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- HISTORY tab ---------- */
function HistoryTab({ d }: { d: Deal }) {
  const { tasks, payments, users, stages } = useCRM();
  const events = useMemo(() => {
    const ev: { t: string; icon: string; text: string; sub?: string; tone?: string }[] = [
      { t: d.createdAt, icon: "plus", text: "Сделка создана", sub: stages.find((s) => s.id === d.stageId)?.title },
      ...tasks.filter((t) => t.dealId === d.id).map((t) => ({
        t: t.createdAt, icon: "checkSq", text: `Задача: ${t.title}`,
        sub: t.done ? "выполнена" : `срок ${dtFmt(t.due)}`, tone: t.done ? "var(--green)" : undefined,
      })),
      ...payments.filter((p) => p.dealId === d.id).map((p) => ({
        t: p.date,
        icon: p.kind === "income" ? "ruble" : "wallet",
        text: p.kind === "income" ? `Поступление ${money(p.amount)}` : `Расход ${money(p.amount)} · ${p.category ?? "прочее"}`,
        sub: p.note || p.method,
        tone: p.kind === "income" ? "var(--green)" : "var(--red)",
      })),
      /* журнал сделки: бронирования товаров, «Оплачено» и т.п. */
      ...(d.log ?? []).map((e) => ({ t: e.t, icon: e.icon, text: e.text, sub: e.sub, tone: e.tone })),
    ];
    return ev.sort((a, b) => +new Date(b.t) - +new Date(a.t));
  }, [d, tasks, payments, stages]);

  return (
    <div>
      <div className="text-[12px] font-extrabold tracking-[0.06em] uppercase mb-4" style={{ color: "var(--muted)" }}>История сделки</div>
      <div className="tl space-y-2.5">
        {events.map((e, i) => (
          <div key={i} className="tl-item card !shadow-none !rounded-[10px] p-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--panel2)", color: e.tone ?? "var(--muted)" }}>
                <Icon name={e.icon} size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold truncate">{e.text}</div>
                {e.sub && <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{e.sub}</div>}
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--faint)" }}>{dtFmt(e.t)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- TASK PANEL (right pane) ---------- */
function TaskPanel({ dealId, isNew, pending, setPending }: { dealId?: string; isNew: boolean; pending: Task[]; setPending: (t: Task[]) => void }) {
  const { tasks, users, currentUserId, saveTask, toast } = useCRM();
  const can = useCan();
  const canCreate = can("tasks.create");
  const defDue = () => { const x = new Date(Date.now() + 86400000); x.setHours(12, 0, 0, 0); return toLocal(x.toISOString()); };
  const [text, setText] = useState("");
  const [dueLocal, setDueLocal] = useState(defDue());
  const [assignee, setAssignee] = useState(currentUserId);
  const [formOpen, setFormOpen] = useState(isNew ? false : true);

  const list = isNew
    ? [...pending].sort((a, b) => +new Date(a.due) - +new Date(b.due))
    : tasks.filter((t) => t.dealId === dealId)
      .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : +new Date(a.due) - +new Date(b.due)));

  const add = () => {
    if (!text.trim()) { toast("Введите текст задачи", "alert"); return; }
    const t: Task = { id: uid(), title: text.trim(), note: "", due: fromLocal(dueLocal), done: false, assigneeId: assignee, dealId, createdAt: iso(Date.now()) };
    if (isNew) {
      setPending([...pending, t]);
      toast("Задача будет сохранена вместе со сделкой");
    } else {
      saveTask(t, true);
      toast("Задача добавлена в сделку");
    }
    const u = users.find((x) => x.id === assignee);
    if (assignee !== currentUserId) toast(`Уведомление отправлено: ${u?.name}`, "bell");
    setText(""); setDueLocal(defDue());
  };

  return (
    <div className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-[13px] font-semibold">Задачи по сделке</div>
        <span className="chip" style={{ background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>{list.filter((t) => !t.done).length} активных</span>
      </div>

      {/* task input */}
      {!canCreate ? (
        <div className="card !shadow-none !rounded-[11px] p-3 mb-4 flex-none flex items-center gap-2.5" style={{ color: "var(--faint)" }}>
          <Icon name="lock" size={15} />
          <span className="text-[12px] font-semibold">Нет права «Создание задач» — добавление задач недоступно</span>
        </div>
      ) : (
      <div className="card !shadow-none !rounded-[11px] p-3 mb-4 flex-none">
        {!formOpen ? (
          <button className="w-full flex items-center gap-2.5 py-1 text-left cursor-pointer group" onClick={() => setFormOpen(true)}>
            <span className="w-[18px] h-[18px] rounded-[5px] border-2 flex-none" style={{ borderColor: "var(--line2)" }} />
            <span className="text-[13px] font-semibold group-hover:text-[var(--brand)] transition-colors" style={{ color: "var(--muted)" }}>Новая задача…</span>
          </button>
        ) : (
          <div>
            <textarea className="textarea !min-h-[54px]" style={{ width: "100%" }} placeholder="Что нужно сделать по сделке?" autoFocus
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }} />
            <div className="flex items-center gap-2 mt-2">
              <div className="relative" style={{ width: "60%" }}>
                <Icon name="calendar" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                <input type="datetime-local" className="input !pl-8 !py-1.5 !text-[12px]" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
              </div>
              <AvatarPicker value={assignee} onChange={setAssignee} users={users} />
              <div className="flex-1" />
              <button className="btn btn-ghost btn-sm" onClick={() => { setFormOpen(false); setText(""); }}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={add}><Icon name="check" size={13} sw={2.6} /> Сохранить</button>
            </div>
            <div className="text-[10.5px] mt-1.5" style={{ color: "var(--faint)" }}>
              Ответственный — {users.find((u) => u.id === assignee)?.name} · получит уведомление
            </div>
          </div>
        )}
      </div>
      )}

      {/* timeline */}
      {list.length === 0 ? (
        <Empty icon="clock" text="Задач пока нет — добавьте первую, она встанет в временную цепочку" />
      ) : (
        <div className="tl space-y-2.5 flex-1">
          {list.map((t) => <TaskItem key={t.id} t={t} isNew={isNew} pending={pending} setPending={setPending} />)}
        </div>
      )}
    </div>
  );
}

function TaskItem({ t, isNew, pending, setPending }: { t: Task; isNew: boolean; pending: Task[]; setPending: (t: Task[]) => void }) {
  const { users, saveTask, deleteTask, openModal, toast, currentUserId } = useCRM();
  const scope = usePermScope();
  const u = users.find((x) => x.id === t.assigneeId);
  const od = !t.done && +new Date(t.due) < Date.now();
  const dl = dueLabel(t.due);
  /* редактирование задачи: «Разрешено» или «Только свои» + я исполнитель */
  const es = scope("tasks.edit");
  const canEditTask = es === "granted" || (es === "own" && t.assigneeId === currentUserId);

  /* инлайн-редактирование (для задач несохранённой сделки) */
  const [edit, setEdit] = useState(false);
  const [eTitle, setETitle] = useState(t.title);
  const [eDue, setEDue] = useState(toLocal(t.due));

  const toggle = () => {
    if (!canEditTask) { toast("Нет права на редактирование этой задачи", "alert"); return; }
    if (isNew) { setPending(pending.map((x) => x.id === t.id ? { ...x, done: !x.done } : x)); return; }
    saveTask({ ...t, done: !t.done }, false);
    toast(t.done ? "Задача возвращена в работу" : `Выполнено: «${t.title}»`);
  };
  const openEdit = () => {
    if (isNew) { setETitle(t.title); setEDue(toLocal(t.due)); setEdit(true); }
    else openModal({ type: "task", id: t.id }); // полное окно задачи — поверх карточки сделки
  };
  const remove = () => {
    if (isNew) { setPending(pending.filter((x) => x.id !== t.id)); toast("Задача убрана из списка"); return; }
    deleteTask(t.id);
    toast("Задача удалена");
  };
  const saveInline = () => {
    if (!eTitle.trim()) { toast("Введите текст задачи", "alert"); return; }
    setPending(pending.map((x) => x.id === t.id ? { ...x, title: eTitle.trim(), due: fromLocal(eDue) } : x));
    setEdit(false);
    toast("Задача обновлена");
  };

  return (
    <div className={`tl-item card !shadow-none !rounded-[10px] p-3 group/task ${t.done ? "done opacity-70" : od ? "overdue" : ""}`}
      style={od ? { borderColor: "color-mix(in srgb, var(--red) 40%, var(--line))" } : undefined}>
      {edit ? (
        /* ---- инлайн-редактор ---- */
        <div className="anim-pop">
          <input className="input !text-[12.5px] font-bold" autoFocus value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Текст задачи" />
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Icon name="calendar" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input type="datetime-local" className="input !pl-8 !py-1.5 !text-[12px]" value={eDue} onChange={(e) => setEDue(e.target.value)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Отмена</button>
            <button className="btn btn-primary btn-sm" onClick={saveInline}><Icon name="check" size={13} sw={2.6} /> Сохранить</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <button onClick={toggle}
            className="w-[18px] h-[18px] mt-px rounded-[5px] border-2 flex-none cursor-pointer flex items-center justify-center transition-all hover:scale-110"
            style={{ borderColor: t.done ? "var(--green)" : od ? "var(--red)" : "var(--line2)", background: t.done ? "var(--green)" : "transparent" }}>
            {t.done && <Icon name="check" size={11} sw={3.2} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-bold leading-snug ${t.done ? "line-through" : ""}`}>{t.title}</div>
            {/* note + deadline */}
            <div className="flex items-start gap-2 mt-2">
              <span className="chip flex-none !py-1" style={{ background: od ? "var(--red-soft)" : "var(--panel2)", color: od ? "var(--red)" : "var(--muted)", border: "1px solid var(--line)" }}>
                <Icon name="calendar" size={11} /> {dl.text}
              </span>
              <input className="input !py-1 !px-2.5 !text-[11.5px] flex-1" placeholder={canEditTask ? "Заметка к задаче…" : "Заметки нет"} defaultValue={t.note}
                disabled={isNew || !canEditTask}
                onBlur={(e) => {
                  if (isNew || !canEditTask || e.target.value === t.note) return;
                  saveTask({ ...t, note: e.target.value }, false);
                  toast("Заметка сохранена");
                }} />
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-none">
            <Avatar user={u} size={24} />
            {canEditTask && (
              <span className="flex items-center opacity-0 group-hover/task:opacity-100 focus-within:opacity-100 transition-opacity ml-1">
                <button className="icon-btn !w-7 !h-7" title="Редактировать задачу" onClick={openEdit}>
                  <Icon name="pencil" size={13} />
                </button>
                <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" title="Удалить задачу" onClick={remove}>
                  <Icon name="trash" size={13} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
