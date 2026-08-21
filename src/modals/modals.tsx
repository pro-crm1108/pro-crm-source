import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Modal, AvatarPicker, ToneChip, PayExpScale, Empty, RoBadge, useClickOutside } from "../components/ui";
import { useCRM, useCan, usePermScope, uid, iso, money, moneyShort, dealTotal, dealPaid, dFmt, toLocal, fromLocal } from "../store";
import type { Client, WorkObject, Job, Task, Payment, JobStage } from "../types";

/* ================= CLIENT ================= */
export function ClientModal({ id }: { id?: string }) {
  const crm = useCRM();
  const { clients, deals, payments, closeModal, openModal, saveClient, deleteClient, toast } = crm;
  const can = useCan();
  const existing = clients.find((c) => c.id === id);
  const [f, setF] = useState<Client>(
    existing ?? { id: uid(), name: "", kind: "fiz", phone: "", email: "", company: "", comment: "", createdAt: iso(Date.now()) }
  );
  const set = (p: Partial<Client>) => setF((x) => ({ ...x, ...p }));
  const cd = deals.filter((d) => d.clientId === f.id);
  const total = cd.reduce((a, d) => a + dealTotal(d), 0);
  const paid = cd.reduce((a, d) => a + dealPaid(d, payments), 0);
  /* права: для существующей карточки — редактирование, для новой — создание */
  const readOnly = existing ? !can("clients.edit") : !can("clients.create");

  const save = () => {
    if (readOnly) { toast("Нет права редактировать клиентов", "alert"); return; }
    if (!f.name.trim()) { toast("Укажите имя клиента", "alert"); return; }
    saveClient({ ...f, name: f.name.trim() }, !existing);
    toast(existing ? "Карточка клиента обновлена" : `Клиент «${f.name.trim()}» добавлен в базу`);
    closeModal();
  };

  return (
    <Modal onClose={closeModal} width={640} icon="users" title={existing ? "Карточка клиента" : "Новый клиент"}
      footer={readOnly ? <>
        <RoBadge />
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
      </> : <>
        {existing && (
          <button className="btn btn-danger" onClick={() => { deleteClient(f.id); toast("Клиент удалён из базы"); closeModal(); }}>
            <Icon name="trash" size={15} />
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> {existing ? "Сохранить" : "Добавить клиента"}</button>
      </>}>
      <div className="p-5">
      <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0">
        {existing && (
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <MiniStat label="Сделок" val={String(cd.length)} />
            <MiniStat label="Оборот" val={moneyShort(total)} />
            <MiniStat label="Остаток долга" val={moneyShort(Math.max(0, total - paid))} tone={total - paid > 0 ? "var(--amber)" : "var(--green)"} />
          </div>
        )}

        <div className="label">Тип клиента</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {([["fiz", "Физ. лицо", "user"], ["yur", "Юр. лицо", "firm"]] as const).map(([k, t, ic]) => (
            <button key={k} onClick={() => set({ kind: k })}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-2 cursor-pointer transition-all text-left"
              style={{ borderColor: f.kind === k ? "var(--brand)" : "var(--line)", background: f.kind === k ? "var(--brand-soft)" : "var(--panel)" }}>
              <Icon name={ic} size={17} className={f.kind === k ? "text-[var(--brand)]" : "text-[var(--muted)]"} />
              <span className="text-[13px] font-bold">{t}</span>
              {f.kind === k && <Icon name="check" size={15} sw={2.6} className="ml-auto text-[var(--brand)]" />}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={f.kind === "yur" ? "col-span-2" : ""}>
            <label className="label">{f.kind === "yur" ? "Название компании" : "ФИО"}</label>
            <input className="input" placeholder={f.kind === "yur" ? "ООО «Пример»" : "Иванов Иван Иванович"} value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input className="input" placeholder="+7 ___ ___-__-__" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Почта</label>
            <input className="input" placeholder="mail@example.ru" value={f.email} onChange={(e) => set({ email: e.target.value })} />
          </div>
          {f.kind === "yur" && (
            <div className="col-span-2">
              <label className="label">Контактное лицо</label>
              <input className="input" placeholder="Имя и должность" value={f.company ?? ""} onChange={(e) => set({ company: e.target.value })} />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Комментарий</label>
            <textarea className="textarea" placeholder="Особенности, предпочтения, договорённости…" value={f.comment} onChange={(e) => set({ comment: e.target.value })} />
          </div>
        </div>
        </fieldset>

        {existing && cd.length > 0 && (
          <div className="mt-5">
            <div className="label">Сделки клиента</div>
            <div className="space-y-1.5">
              {cd.map((d) => (
                <button key={d.id} className="w-full flex items-center gap-3 p-2.5 rounded-[10px] border row-hover text-left cursor-pointer" style={{ borderColor: "var(--line)" }}
                  onClick={() => openModal({ type: "deal", id: d.id })}>
                  <Icon name="kanban" size={15} className="text-[var(--muted)]" />
                  <span className="text-[13px] font-bold flex-1 truncate">{d.title}</span>
                  <span className="text-[12.5px] font-extrabold">{moneyShort(dealTotal(d))}</span>
                  <Icon name="chevR" size={14} className="text-[var(--faint)]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MiniStat({ label, val, tone }: { label: string; val: string; tone?: string }) {
  return (
    <div className="p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
      <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-display text-[15px] font-bold mt-1" style={{ color: tone }}>{val}</div>
    </div>
  );
}

/* ================= OBJECT ================= */
const OBJ_STATUS_TONE: Record<string, "green" | "amber" | "blue" | "muted" | "red"> = {
  "В работе": "green", "Смета": "amber", "Замер": "blue", "Проект": "muted", "Пауза": "red", "Завершён": "muted",
};
const TONE_VARS: Record<string, [string, string]> = {
  red: ["var(--red-soft)", "var(--red)"], amber: ["var(--amber-soft)", "var(--amber)"],
  blue: ["var(--blue-soft)", "var(--blue)"], green: ["var(--green-soft)", "var(--green)"],
  muted: ["var(--panel)", "var(--muted)"],
};

function StatusSelect({ value, statuses, onChange }: { value: string; statuses: string[]; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const tone = OBJ_STATUS_TONE[value] ?? "muted";
  const tv = TONE_VARS[tone];
  return (
    <div className="relative" ref={ref}>
      <button className="chip !py-1.5 !px-3 !text-[12px] cursor-pointer transition-transform hover:scale-[1.04]"
        style={{ background: tv[0], color: tv[1], border: `1px solid color-mix(in srgb, ${tv[1]} 32%, transparent)` }}
        onClick={() => setOpen(!open)} title="Сменить статус">
        <i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: tv[1] }} />
        {value}
        <Icon name="chevD" size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 card p-1.5 w-52 anim-pop overflow-y-auto" style={{ boxShadow: "var(--shadow-lg)", maxHeight: 300 }}>
          <div className="label px-2 !mb-1">Статус объекта · из настроек</div>
          {statuses.map((s) => {
            const t = TONE_VARS[OBJ_STATUS_TONE[s] ?? "muted"];
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg row-hover text-left text-[12.5px] font-bold cursor-pointer">
                <i className="w-2 h-2 rounded-full flex-none" style={{ background: t[1] }} />
                <span className="flex-1">{s}</span>
                {s === value && <Icon name="check" size={13} className="text-[var(--brand)]" sw={2.6} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ObjectModal({ id, dealId }: { id?: string; dealId?: string }) {
  const { objects, clients, deals, jobs, users, payments, objectStatuses, closeModal, openModal, saveObject, deleteObject, saveDeal, toast } = useCRM();
  const existing = objects.find((o) => o.id === id);
  const linkedDeal = deals.find((d) => d.id === dealId);
  const [f, setF] = useState<WorkObject>(
    existing ?? { id: uid(), title: "", address: "", kind: "Квартира", area: "", clientId: linkedDeal?.clientId, dealId: dealId, status: objectStatuses[0] ?? "Проект", comment: "", startDate: new Date().toISOString() }
  );
  const [editMode, setEditMode] = useState(!existing);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const set = (p: Partial<WorkObject>) => setF((x) => ({ ...x, ...p }));
  const oj = jobs.filter((j) => j.objectId === f.id);
  const isPendingDeal = (f.dealId ?? "").startsWith("pending:");
  const deal = deals.find((d) => d.id === f.dealId);
  const client = clients.find((c) => c.id === f.clientId);
  const total = deal ? dealTotal(deal) : 0;
  const paid = deal ? dealPaid(deal, payments) : 0;
  const expense = deal ? payments.filter((p) => p.kind === "expense" && p.dealId === deal.id).reduce((a, p) => a + p.amount, 0) : 0;
  const savedComment = objects.find((o) => o.id === f.id)?.comment ?? "";

  /* -------- ПРАВА -------- */
  const can = useCan();
  const canEditObj = can("objects.edit");       /* редактирование объекта, смена статуса, комментария */
  const canCreateObj = can("objects.create");   /* создание объекта */
  const canWorks = can("objects.works");        /* создание работ */
  const canPay = can("finance.create");         /* проведение платежей */
  const readOnly = existing ? !canEditObj : !canCreateObj;

  const save = () => {
    if (readOnly) { toast("Нет права на это действие", "alert"); return; }
    if (!f.title.trim()) { toast("Укажите название объекта", "alert"); return; }
    saveObject({ ...f, title: f.title.trim(), comment }, !existing);
    // обратная привязка: сделка получает objectId, и объект появляется в её карточке
    if (f.dealId && !f.dealId.startsWith("pending:")) {
      const dl = deals.find((x) => x.id === f.dealId);
      if (dl && !dl.objectId) saveDeal({ ...dl, objectId: f.id }, false);
    }
    toast(existing ? "Объект обновлён" : `Объект «${f.title.trim()}» зарегистрирован`);
    if (existing) setEditMode(false); else closeModal();
  };

  const changeStatus = (st: string) => {
    if (!canEditObj) { toast("Нет права менять статус объекта", "alert"); return; }
    saveObject({ ...f, comment, status: st }, false);
    setF((x) => ({ ...x, status: st }));
    toast(`Статус объекта: «${st}»`, "bell");
  };

  const footer = (!existing || editMode) ? (
    <>
      <div className="flex-1" />
      <button className="btn btn-ghost" onClick={() => (existing ? setEditMode(false) : closeModal())}>Отмена</button>
      <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> {existing ? "Сохранить" : "Зарегистрировать объект"}</button>
    </>
  ) : (
    <>
      {canEditObj && (
        <>
          <button className="btn btn-danger" onClick={() => { deleteObject(f.id); toast(`Объект «${f.title}» удалён вместе с работами`); closeModal(); }}>
            <Icon name="trash" size={14} /> Удалить
          </button>
          <button className="btn btn-soft" onClick={() => setEditMode(true)}><Icon name="pencil" size={14} /> Редактировать</button>
        </>
      )}
      {!canEditObj && <RoBadge />}
      <div className="flex-1" />
      <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
    </>
  );

  return (
    <Modal onClose={closeModal} width={680} icon="building"
      title={existing ? (editMode ? "Редактирование объекта" : "Карточка объекта") : "Новый объект"}
      footer={footer}>
      {/* ---------- РЕЖИМ ПРОСМОТРА ---------- */}
      {existing && !editMode && (
        <div className="p-5 space-y-4">
          {/* шапка-плитка */}
          <div className="rounded-xl border p-4 anim-pop relative"
            style={{ borderColor: "var(--line)", background: "linear-gradient(135deg, var(--panel2) 30%, color-mix(in srgb, var(--brand) 6%, var(--panel2)))" }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              {canEditObj ? (
                <StatusSelect value={f.status}
                  statuses={objectStatuses.length ? objectStatuses : ["Проект", "Замер", "Смета", "В работе", "Пауза", "Завершён"]}
                  onChange={changeStatus} />
              ) : (
                <ToneChip tone="muted">{f.status}</ToneChip>
              )}
              <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
                <Icon name="calendar" size={12} />
                {f.startDate ? dFmt(f.startDate) : "—"} → {f.endDate ? dFmt(f.endDate) : "—"}
              </span>
              {canEditObj && (
                <button className="icon-btn ml-auto" title="Редактировать объект" onClick={() => setEditMode(true)}>
                  <Icon name="pencil" size={16} />
                </button>
              )}
            </div>
            <div className="font-display text-[19px] font-bold mt-2.5 leading-tight pr-10">{f.title}</div>
            <div className="mt-1.5">
              {deal ? (
                <button className="text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: "var(--brand)" }} onClick={() => openModal({ type: "deal", id: deal.id })}
                  title="Открыть карточку сделки">
                  <Icon name="kanban" size={13} /> {deal.title} <Icon name="arrowR" size={12} />
                </button>
              ) : isPendingDeal ? (
                <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                  <Icon name="kanban" size={11} /> привяжется к новой сделке
                </span>
              ) : (
                <span className="text-[12px] font-semibold" style={{ color: "var(--faint)" }}>сделка не привязана</span>
              )}
            </div>
            <div className="flex items-center gap-x-4 gap-y-1 mt-2.5 text-[11.5px] font-semibold flex-wrap" style={{ color: "var(--muted)" }}>
              <span className="flex items-center gap-1.5">
                <Icon name="dot" size={9} /> {f.address || "адрес не указан"} · {f.kind}{f.area ? `, ${f.area}` : ""}
              </span>
              {client ? (
                <button className="flex items-center gap-1.5 cursor-pointer font-bold hover:opacity-70 transition-opacity"
                  style={{ color: "var(--blue)" }} onClick={() => openModal({ type: "client", id: client.id })}
                  title="Открыть карточку заказчика">
                  <Icon name="user" size={12} /> {client.name}
                </button>
              ) : (
                <span className="flex items-center gap-1.5"><Icon name="user" size={12} /> заказчик не указан</span>
              )}
            </div>
          </div>

          {/* комментарий */}
          <div>
            <label className="label">Комментарий</label>
            <textarea className="textarea disabled:!opacity-70" placeholder="Доступ, ключи, особенности объекта…" value={comment}
              disabled={!canEditObj}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => { if (canEditObj && comment !== savedComment) { saveObject({ ...f, comment }, false); toast("Комментарий сохранён"); } }} />
          </div>

          {/* оплаты + расходы */}
          <PayExpScale total={total} paid={paid} expense={expense} />

          {/* действия и работы */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="label !mb-0">Работы на объекте · {oj.length}</div>
              <div className="flex items-center gap-2">
                {canPay && (
                  <button className="btn btn-soft btn-sm" title="Платёж по сделке объекта"
                    onClick={() => openModal({
                      type: "payment", kind: "income",
                      dealId: isPendingDeal ? undefined : f.dealId,
                      clientId: f.clientId,
                    })}>
                    <Icon name="plus" size={13} sw={2.4} /> Платёж
                  </button>
                )}
                {canWorks && (
                  <button className="btn btn-soft btn-sm" onClick={() => openModal({ type: "job", objectId: f.id })}>
                    <Icon name="plus" size={13} sw={2.4} /> Работа
                  </button>
                )}
              </div>
            </div>
            {oj.length === 0 ? (
              <Empty icon="hammer" text="Работ пока нет — добавьте первую" />
            ) : (
              <div className="space-y-1.5">
                {oj.map((j) => {
                  const u = users.find((x) => x.id === j.assigneeId);
                  const od = j.stage !== "done" && +new Date(j.deadline) < Date.now();
                  return (
                    <button key={j.id} className="w-full flex items-center gap-3 p-2.5 rounded-[10px] border row-hover text-left cursor-pointer" style={{ borderColor: "var(--line)" }}
                      onClick={() => openModal({ type: "job", id: j.id })}>
                      <ToneChip tone={j.stage === "done" ? "green" : od ? "red" : j.stage === "work" ? "amber" : "muted"}>
                        {j.stage === "plan" ? "Запланировано" : j.stage === "work" ? "В работе" : j.stage === "check" ? "На проверке" : "Завершено"}
                      </ToneChip>
                      <span className="text-[13px] font-bold flex-1 truncate">{j.title}</span>
                      <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{dFmt(j.deadline)}</span>
                      {u && <AvatarChip name={u.name} color={u.color} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- ФОРМА (создание / редактирование) ---------- */}
      {(!existing || editMode) && (
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Название</label>
            <input className="input" placeholder="ЖК «Название», кв. / офис…" value={f.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Адрес</label>
            <input className="input" placeholder="Город, улица, дом" value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </div>
          <div>
            <label className="label">Тип</label>
            <select className="select" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              {["Квартира", "Офис", "Коттедж", "Коммерция", "Другое"].map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Площадь</label>
            <input className="input" placeholder="64 м²" value={f.area} onChange={(e) => set({ area: e.target.value })} />
          </div>
          <div>
            <label className="label">Клиент</label>
            <select className="select" value={f.clientId ?? ""} onChange={(e) => {
              const cid = e.target.value || undefined;
              const isPending = (f.dealId ?? "").startsWith("pending:");
              const keepDeal = isPending || !f.dealId || !cid || deals.find((x) => x.id === f.dealId)?.clientId === cid;
              set({ clientId: cid, dealId: keepDeal ? f.dealId : undefined });
            }}>
              <option value="">— не выбран —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Сделка</label>
            {(f.dealId ?? "").startsWith("pending:") ? (
              <div className="input !text-[12.5px] font-bold inline-flex items-center gap-2 cursor-default"
                style={{ color: "var(--brand)", background: "var(--brand-soft)", borderColor: "color-mix(in srgb, var(--brand) 35%, var(--line))" }}
                title="Привязка подтвердится в момент создания сделки">
                <Icon name="kanban" size={14} /> Привяжется к новой сделке
              </div>
            ) : (
              <>
                <select className="select" value={f.dealId ?? ""} onChange={(e) => {
                  const deal = deals.find((x) => x.id === e.target.value);
                  set({ dealId: e.target.value || undefined, clientId: deal?.clientId ?? f.clientId });
                }}>
                  <option value="">— не привязана —</option>
                  {deals.filter((x) => !f.clientId || x.clientId === f.clientId).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                {f.clientId && (
                  <div className="text-[10.5px] font-semibold mt-1" style={{ color: "var(--faint)" }}>
                    показаны сделки клиента · {deals.filter((x) => x.clientId === f.clientId).length}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="label">Статус</label>
            <select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>
              {objectStatuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Дата начала</label>
            <input type="date" className="input" value={f.startDate?.slice(0, 10) ?? ""}
              onChange={(e) => set({ startDate: e.target.value ? new Date(e.target.value + "T12:00").toISOString() : undefined })} />
          </div>
          <div>
            <label className="label">Дата окончания</label>
            <input type="date" className="input" value={f.endDate?.slice(0, 10) ?? ""}
              onChange={(e) => set({ endDate: e.target.value ? new Date(e.target.value + "T12:00").toISOString() : undefined })} />
          </div>
          <div className="col-span-2">
            <label className="label">Комментарий</label>
            <textarea className="textarea" placeholder="Доступ, ключи, особенности…" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
      </div>
      )}
    </Modal>
  );
}

function AvatarChip({ name, color }: { name: string; color: string }) {
  const ini = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-extrabold text-white flex-none" style={{ background: color }}>{ini}</span>;
}

/* ================= TASK ================= */
export function TaskModal({ id }: { id?: string }) {
  const { tasks, users, deals, clients, currentUserId, closeModal, saveTask, deleteTask, toast } = useCRM();
  const existing = tasks.find((t) => t.id === id);
  const defDue = () => { const d = new Date(Date.now() + 86400000); d.setHours(12, 0, 0, 0); return toLocal(d.toISOString()); };
  const [f, setF] = useState<Task>(existing ?? { id: uid(), title: "", note: "", due: fromLocal(defDue()), done: false, assigneeId: currentUserId, createdAt: iso(Date.now()) });
  const [dueLocal, setDueLocal] = useState(existing ? toLocal(existing.due) : defDue());
  const set = (p: Partial<Task>) => setF((x) => ({ ...x, ...p }));

  /* -------- ПРАВА -------- */
  const can = useCan();
  const scope = usePermScope();
  const es = scope("tasks.edit");
  /* «Разрешено» — любые задачи; «Только свои» — лишь где я исполнитель */
  const canEditTask = es === "granted" || (es === "own" && existing?.assigneeId === currentUserId);
  const readOnly = existing ? !canEditTask : !can("tasks.create");

  const save = () => {
    if (readOnly) { toast("Нет права редактировать задачи", "alert"); return; }
    if (!f.title.trim()) { toast("Введите текст задачи", "alert"); return; }
    const t = { ...f, title: f.title.trim(), due: fromLocal(dueLocal) };
    saveTask(t, !existing);
    if (!existing && t.assigneeId !== currentUserId) {
      const u = users.find((x) => x.id === t.assigneeId);
      toast(`Уведомление отправлено: ${u?.name}`, "bell");
    } else {
      toast(existing ? "Задача обновлена" : "Задача создана");
    }
    closeModal();
  };

  return (
    <Modal onClose={closeModal} width={560} icon="checkSq" title={existing ? "Редактирование задачи" : "Новая задача"}
      footer={readOnly ? <>
        <RoBadge />
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
      </> : <>
        {existing && <button className="btn btn-danger" onClick={() => { deleteTask(f.id); toast("Задача удалена"); closeModal(); }}><Icon name="trash" size={15} /></button>}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> Сохранить</button>
      </>}>
      <div className="p-5">
      <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0 space-y-3.5">
        <div>
          <label className="label">Задача</label>
          <input className="input" placeholder="Что нужно сделать?" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">Заметки</label>
          <textarea className="textarea" placeholder="Детали, ссылки, договорённости…" value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Срок (дата и время)</label>
            <input type="datetime-local" className="input" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
          </div>
          <div>
            <label className="label">Ответственный</label>
            <div className="flex items-center gap-2">
              <AvatarPicker value={f.assigneeId} onChange={(v) => set({ assigneeId: v })} users={users} />
              <span className="text-[12.5px] font-bold truncate">{users.find((u) => u.id === f.assigneeId)?.name}</span>
            </div>
          </div>
          <div>
            <label className="label">Клиент (необязательно)</label>
            <select className="select" value={f.clientId ?? ""} onChange={(e) => {
              const cid = e.target.value || undefined;
              const keepDeal = !f.dealId || !cid || deals.find((x) => x.id === f.dealId)?.clientId === cid;
              set({ clientId: cid, dealId: keepDeal ? f.dealId : undefined });
            }}>
              <option value="">— без клиента —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Сделка (необязательно)</label>
            <select className="select" value={f.dealId ?? ""} onChange={(e) => {
              const deal = deals.find((x) => x.id === e.target.value);
              set({ dealId: e.target.value || undefined, clientId: deal?.clientId ?? f.clientId });
            }}>
              <option value="">— без сделки —</option>
              {deals.filter((x) => !f.clientId || x.clientId === f.clientId).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            {f.clientId && (
              <div className="text-[10.5px] font-semibold mt-1" style={{ color: "var(--faint)" }}>
                показаны сделки клиента · {deals.filter((x) => x.clientId === f.clientId).length}
              </div>
            )}
          </div>
        </div>
      </fieldset>
      </div>
    </Modal>
  );
}

/* ================= JOB ================= */
export function JobModal({ id, objectId }: { id?: string; objectId?: string }) {
  const { jobs, objects, users, currentUserId, closeModal, saveJob, deleteJob, toast } = useCRM();
  const existing = jobs.find((j) => j.id === id);
  const defDl = () => { const d = new Date(Date.now() + 3 * 86400000); d.setHours(18, 0, 0, 0); return toLocal(d.toISOString()); };
  const [f, setF] = useState<Job>(existing ?? { id: uid(), title: "", objectId: objectId ?? objects[0]?.id ?? "", stage: "plan", deadline: fromLocal(defDl()), assigneeId: currentUserId, comment: "" });
  const [dlLocal, setDlLocal] = useState(existing ? toLocal(existing.deadline) : defDl());
  const set = (p: Partial<Job>) => setF((x) => ({ ...x, ...p }));
  const obj = objects.find((o) => o.id === f.objectId);

  /* -------- ПРАВА: управление работами (этапами) объекта -------- */
  const can = useCan();
  const readOnly = !can("objects.works");

  const save = () => {
    if (readOnly) { toast("Нет права управлять работами", "alert"); return; }
    if (!f.title.trim()) { toast("Введите название работы", "alert"); return; }
    if (!f.objectId) { toast("Выберите объект", "alert"); return; }
    saveJob({ ...f, title: f.title.trim(), deadline: fromLocal(dlLocal) }, !existing);
    toast(existing ? "Работа обновлена" : `Работа добавлена на «${obj?.title}»`);
    closeModal();
  };

  return (
    <Modal onClose={closeModal} width={560} icon="hammer" title={existing ? "Редактирование работы" : "Новая работа"}
      footer={readOnly ? <>
        <RoBadge />
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
      </> : <>
        {existing && (
          <button className="btn btn-danger" onClick={() => { deleteJob(f.id); toast("Работа удалена"); closeModal(); }}>
            <Icon name="trash" size={14} /> Удалить
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> Сохранить</button>
      </>}>
      <div className="p-5">
      <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0 space-y-3.5">
        <div>
          <label className="label">Название работы</label>
          <input className="input" placeholder="Например: Укладка плитки в санузле" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Объект</label>
            <select className="select" value={f.objectId} onChange={(e) => set({ objectId: e.target.value })}>
              {objects.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Этап</label>
            <select className="select" value={f.stage} onChange={(e) => set({ stage: e.target.value as JobStage })}>
              <option value="plan">Запланировано</option><option value="work">В работе</option>
              <option value="check">На проверке</option><option value="done">Завершено</option>
            </select>
          </div>
          <div>
            <label className="label">Срок</label>
            <input type="datetime-local" className="input" value={dlLocal} onChange={(e) => setDlLocal(e.target.value)} />
          </div>
          <div>
            <label className="label">Ответственный</label>
            <div className="flex items-center gap-2">
              <AvatarPicker value={f.assigneeId} onChange={(v) => set({ assigneeId: v })} users={users} />
              <span className="text-[12.5px] font-bold truncate">{users.find((u) => u.id === f.assigneeId)?.name}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Комментарий</label>
            <textarea className="textarea" placeholder="Материалы, доступ, нюансы…" value={f.comment} onChange={(e) => set({ comment: e.target.value })} />
          </div>
        </div>
      </fieldset>
      </div>
    </Modal>
  );
}

/* ================= PAYMENT ================= */
export function PaymentModal({ kind: initKind = "income", dealId, clientId: initClient, payId }: { kind?: "income" | "expense"; dealId?: string; clientId?: string; payId?: string }) {
  const { payments, deals, clients, closeModal, addPayment, updatePayment, deletePayment, toast } = useCRM();
  const editing = payments.find((p) => p.id === payId);
  const [kind, setKind] = useState<"income" | "expense">(editing?.kind ?? initKind);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [date, setDate] = useState(editing ? editing.date.slice(0, 10) : toLocal(new Date().toISOString()).slice(0, 10));
  const [method, setMethod] = useState(editing?.method ?? "Перевод на р/с");
  const [pDealId, setPDealId] = useState(editing?.dealId ?? dealId ?? "");
  const [clientId, setClientId] = useState(editing?.clientId ?? deals.find((d) => d.id === dealId)?.clientId ?? initClient ?? "");
  const [category, setCategory] = useState(editing?.category ?? "Закупка материалов");
  const [note, setNote] = useState(editing?.note ?? "");
  const cats = ["Закупка материалов", "Зарплата бригады", "Логистика", "Аренда", "Инструмент", "Вывоз мусора", "Реклама", "ГСМ", "Прочее"];

  const deal = deals.find((d) => d.id === pDealId);
  const rest = deal ? Math.max(0, dealTotal(deal) - dealPaid(deal, payments)) : 0;

  /* -------- ПРАВА: создание — finance.create, правка — finance.edit -------- */
  const can = useCan();
  const readOnly = editing ? !can("finance.edit") : !can("finance.create");

  const save = () => {
    if (readOnly) { toast("Нет права проводить платежи", "alert"); return; }
    const sum = parseFloat(amount.replace(",", "."));
    if (!sum || sum <= 0) { toast("Укажите сумму", "alert"); return; }
    const p: Payment = {
      id: editing ? editing.id : uid(), kind, amount: sum, date: new Date(date + "T12:00").toISOString(), method,
      dealId: pDealId || undefined,
      clientId: clientId || deal?.clientId || undefined,
      category: kind === "expense" ? category : undefined,
      note: note.trim(),
    };
    if (editing) updatePayment(p); else addPayment(p);
    toast(
      editing ? "Платёж обновлён"
        : kind === "income"
          ? `Поступление ${money(sum)} проведено${deal ? ` по сделке «${deal.title}»` : ""}`
          : `Расход ${money(sum)} учтён · ${category}${deal ? ` · «${deal.title}»` : ""}`,
      "ruble"
    );
    closeModal();
  };

  return (
    <Modal onClose={closeModal} width={560} icon="ruble" title={editing ? "Редактирование платежа" : "Оформление платежа"}
      footer={readOnly ? <>
        <RoBadge />
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
      </> : <>
        {editing && (
          <button className="btn btn-danger" onClick={() => { deletePayment(editing.id); toast("Платёж удалён"); closeModal(); }}>
            <Icon name="trash" size={14} /> Удалить
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" style={kind === "expense" ? { background: "var(--red)" } : { background: "var(--green)" }} onClick={save}>
          <Icon name="check" size={15} sw={2.4} /> {editing ? "Сохранить изменения" : `Провести ${kind === "income" ? "платёж" : "расход"}`}
        </button>
      </>}>
      <div className="p-5">
      <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0 space-y-4">
        <div className="seg w-full !p-1">
          {([["income", "Поступление (доход)"], ["expense", "Расход"]] as const).map(([k, t]) => (
            <button key={k} className={`flex-1 !py-2 ${kind === k ? "on" : ""}`}
              style={kind === k ? { color: k === "income" ? "var(--green)" : "var(--red)" } : undefined}
              onClick={() => setKind(k)}>{t}</button>
          ))}
        </div>

        <div>
          <label className="label">Сумма, ₽</label>
          <div className="relative">
            <input className="input !pr-10 font-display !text-[16px] !font-bold" placeholder="0" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold" style={{ color: "var(--faint)" }}>₽</span>
          </div>
          {kind === "income" && deal && rest > 0 && (
            <button className="mt-1.5 text-[11.5px] font-bold cursor-pointer hover:opacity-75" style={{ color: "var(--amber)" }} onClick={() => setAmount(String(rest))}>
              Остаток по сделке «{deal.title}»: {money(rest)} — подставить
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Дата</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Способ</label>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Наличные", "Карта", "Перевод на р/с", "Перевод поставщику", "СБП"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Сделка</label>
            <select className="select" value={pDealId}
              onChange={(e) => { setPDealId(e.target.value); const d = deals.find((x) => x.id === e.target.value); if (d?.clientId) setClientId(d.clientId); }}>
              <option value="">— без сделки —</option>
              {deals.filter((x) => !clientId || x.clientId === clientId).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Клиент</label>
            <select className="select" value={clientId} onChange={(e) => {
              const cid = e.target.value;
              const keepDeal = !pDealId || !cid || deals.find((x) => x.id === pDealId)?.clientId === cid;
              setClientId(cid);
              if (!keepDeal) setPDealId("");
            }}>
              <option value="">— не указан —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {kind === "expense" && (
            <div className="col-span-2">
              <label className="label">Категория расхода</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Комментарий</label>
            <input className="input" placeholder={kind === "income" ? "Аванс по договору…" : "Что закуплено / оплачено…"} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </fieldset>
      </div>
    </Modal>
  );
}
