import React, { useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons";
import { Avatar, Seg, Progress, Empty, ToneChip } from "../components/ui";
import { useCRM, usePermScope, useCan, money, moneyShort, dealTotal, dealPaid, dFmt } from "../store";
import type { Deal } from "../types";

export default function Sales() {
  const crm = useCRM();
  const { deals, stages, clients, users, openModal, renameStage, moveDeal, payments, currentUserId } = crm;
  const scope = usePermScope();
  const can = useCan();
  const [mode, setMode] = useState<"kanban" | "list">("kanban");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  /* «Только свои» → видны сделки, где пользователь — ответственный */
  const onlyMine = scope("deals.viewCard") === "own";
  const visibleDeals = useMemo(
    () => (onlyMine ? deals.filter((d) => d.ownerId === currentUserId) : deals),
    [deals, onlyMine, currentUserId]
  );

  /* можно ли редактировать конкретную сделку (перетаскивать, менять стадию) */
  const editScope = scope("deals.edit");
  const canEditDeal = (d: { ownerId: string }) =>
    editScope === "granted" || (editScope === "own" && d.ownerId === currentUserId);
  /* управление колонками воронки */
  const canStructure = can("deals.stages");

  return (
    <div className="p-6 max-w-[1440px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-none">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Продажи</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            Воронка: {visibleDeals.length} сделок на {moneyShort(visibleDeals.reduce((a, d) => a + dealTotal(d), 0))}
            {canStructure ? " · названия колонок редактируются" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Seg options={[{ v: "kanban", t: "Канбан" }, { v: "list", t: "Список" }]} value={mode} onChange={(v) => setMode(v as any)} />
          {can("deals.create") && <button className="btn btn-primary" onClick={() => openModal({ type: "deal" })}><Icon name="plus" size={15} sw={2.4} /> Сделка</button>}
        </div>
      </div>

      {mode === "kanban" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1">
          <div className="flex gap-3 h-full min-w-max">
            {stages.map((st) => {
              const list = visibleDeals.filter((d) => d.stageId === st.id);
              const sum = list.reduce((a, d) => a + dealTotal(d), 0);
              return (
                <div key={st.id}
                  className={`w-[280px] flex-none flex flex-col rounded-xl border transition-colors ${overCol === st.id ? "kanban-col-drop" : ""}`}
                  style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(st.id); }}
                  onDragLeave={() => setOverCol((c) => (c === st.id ? null : c))}
                  onDrop={() => { if (dragId) { const dl = deals.find((d) => d.id === dragId); if (dl && canEditDeal(dl)) { moveDeal(dragId, st.id); crm.toast(`«${dl.title}» → «${st.title}»`, "bell"); } else crm.toast("Нет права менять стадию этой сделки", "alert"); } setDragId(null); setOverCol(null); }}>
                  <StageHeader st={st} count={list.length} sum={sum} canStructure={canStructure} onRename={(t) => renameStage(st.id, t)} />
                  <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-2">
                    {list.length === 0 && (
                      /* пустая колонка — клик создаёт сделку сразу в этой стадии */
                      <button
                        onClick={() => can("deals.create") && openModal({ type: "deal", stageId: st.id })}
                        className="w-full text-[12px] font-semibold text-center py-8 rounded-lg transition-colors"
                        style={{ color: "var(--faint)", border: "1.5px dashed var(--line2)", cursor: can("deals.create") ? "pointer" : "default" }}
                        onMouseEnter={(e) => can("deals.create") && (e.currentTarget.style.borderColor = "var(--brand)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line2)")}
                        title={can("deals.create") ? `Создать сделку в стадии «${st.title}»` : undefined}>
                        Перетащите сделку сюда<br />
                        {can("deals.create") && <span style={{ color: "var(--brand)" }}>или нажмите, чтобы создать</span>}
                      </button>
                    )}
                    {list.map((d) => (
                      <DealCard key={d.id} d={d} dragging={dragId === d.id} draggable={canEditDeal(d)}
                        onDrag={() => setDragId(d.id)} onEnd={() => { setDragId(null); setOverCol(null); }} />
                    ))}
                    {/* «+ Сделка» — в потоке под карточками: автоматически встаёт ниже последней */}
                    {can("deals.create") && (
                      <button
                        onClick={() => openModal({ type: "deal", stageId: st.id })}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-extrabold transition-all hover:brightness-110"
                        style={{ border: "1.5px dashed var(--line2)", color: "var(--muted)", background: "transparent" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = st.color; e.currentTarget.style.color = st.color; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; e.currentTarget.style.color = "var(--muted)"; }}
                        title={`Новая сделка в стадии «${st.title}»`}>
                        <Icon name="plus" size={14} sw={2.4} /> Сделка
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {canStructure && <AddStageCol />}
          </div>
        </div>
      ) : (
        <div className="card flex-1 overflow-auto anim-fade">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: "var(--panel2)" }}>
                {["Сделка", "Клиент", "Стадия", "Сумма", "Оплата", "Ответственный", "Источник", "Дата"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10.5px] font-extrabold tracking-[0.1em] uppercase whitespace-nowrap" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const cl = clients.find((c) => c.id === d.clientId);
                const st = stages.find((s) => s.id === d.stageId);
                const u = users.find((x) => x.id === d.ownerId);
                const total = dealTotal(d), paid = dealPaid(d, payments);
                return (
                  <tr key={d.id} className="row-hover border-t" style={{ borderColor: "var(--line)" }} onClick={() => openModal({ type: "deal", id: d.id })}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: st?.color }} />
                        <span className="text-[13px] font-bold">{d.title}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{cl?.name}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select className="select !w-auto !py-1 !px-2.5 !text-[12px] font-bold disabled:!opacity-60 disabled:!cursor-not-allowed" style={{ color: st?.color }}
                        value={d.stageId} disabled={!canEditDeal(d)} onChange={(e) => moveDeal(d.id, e.target.value)}
                        title={canEditDeal(d) ? undefined : "Нет права менять стадию этой сделки"}>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-extrabold whitespace-nowrap">{money(total)}</td>
                    <td className="px-4 py-3 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <Progress value={total > 0 ? (paid / total) * 100 : 0} color={paid >= total && total > 0 ? "var(--green)" : "var(--amber)"} h={5} />
                        <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--muted)" }}>{total > 0 ? Math.round((paid / total) * 100) : 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Avatar user={u} size={26} /></td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{d.source}</td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{dFmt(d.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deals.length === 0 && <div className="p-8"><Empty icon="kanban" text="Сделок пока нет" action={<button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "deal" })}>+ Создать сделку</button>} /></div>}
        </div>
      )}
    </div>
  );
}

const STAGE_COLORS = ["#4c7fb5", "#2ba184", "#c9a227", "#d9782b", "#b5566e", "#3e8757", "#7c5cbf", "#c94f42"];

function AddStageCol() {
  const { addStage, toast } = useCRM();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(STAGE_COLORS[6]);
  const add = () => {
    if (!name.trim()) return;
    addStage(name.trim(), color);
    toast(`Столбец «${name.trim()}» добавлен в воронку`);
    setName(""); setOpen(false);
  };
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-[280px] h-[64px] flex-none rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[13px] font-bold cursor-pointer transition-all hover:-translate-y-0.5"
        style={{ borderColor: "var(--line2)", color: "var(--muted)", background: "transparent" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.color = "var(--brand)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; e.currentTarget.style.color = "var(--muted)"; }}>
        <Icon name="plus" size={16} sw={2.4} /> Добавить столбец
      </button>
    );
  }
  return (
    <div className="w-[280px] flex-none rounded-xl border p-3.5 anim-pop self-start" style={{ background: "var(--panel2)", borderColor: "var(--brand)", boxShadow: "var(--shadow-lg)" }}>
      <div className="label">Новый столбец воронки</div>
      <input autoFocus className="input !text-[13px]" placeholder="Например: Согласование" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setOpen(false); }} />
      <div className="label mt-3">Цвет</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {STAGE_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-115 flex items-center justify-center"
            style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--panel2), 0 0 0 4px ${c}` : undefined, transform: color === c ? "scale(1.1)" : undefined }}>
            {color === c && <Icon name="check" size={12} sw={3} className="text-white" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button className="btn btn-ghost btn-sm flex-1" onClick={() => setOpen(false)}>Отмена</button>
        <button className="btn btn-primary btn-sm flex-1" onClick={add} disabled={!name.trim()}><Icon name="plus" size={14} sw={2.4} /> Добавить</button>
      </div>
    </div>
  );
}

function StageHeader({ st, count, sum, canStructure, onRename }: { st: any; count: number; sum: number; canStructure: boolean; onRename: (t: string) => void }) {
  const { deleteStage, toast } = useCRM();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(st.title);
  const ref = useRef<HTMLInputElement>(null);
  const commit = () => { if (val.trim()) onRename(val.trim()); setEdit(false); };
  return (
    <div className="px-3.5 pt-3 pb-2.5 flex items-center gap-2 flex-none group/head">
      <span className="w-2.5 h-2.5 rounded-[4px] flex-none" style={{ background: st.color }} />
      {edit ? (
        <input ref={ref} autoFocus className="input !py-1 !px-2 !text-[12.5px] !font-bold flex-1" value={val}
          onChange={(e) => setVal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(st.title); setEdit(false); } }} />
      ) : (
        canStructure ? (
          <button className="text-[12.5px] font-extrabold tracking-wide truncate cursor-pointer group flex items-center gap-1.5" onClick={() => { setVal(st.title); setEdit(true); }} title="Переименовать колонку">
            {st.title}
            <Icon name="pencil" size={12} className="opacity-0 group-hover:opacity-60 transition-opacity flex-none" />
          </button>
        ) : (
          <span className="text-[12.5px] font-extrabold tracking-wide truncate">{st.title}</span>
        )
      )}
      <span className="ml-auto chip flex-none" style={{ background: "var(--panel)", color: "var(--muted)" }}>{count}</span>
      <span className="text-[11px] font-bold flex-none" style={{ color: "var(--faint)" }}>{moneyShort(sum)}</span>
      <button
        className="opacity-0 group-hover/head:opacity-100 transition-opacity flex-none w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:!bg-[var(--red-soft)]"
        style={{ color: "var(--faint)" }}
        title="Удалить столбец (сделки перенесутся в первый столбец)"
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--faint)")}
        onClick={() => { deleteStage(st.id); toast(`Столбец «${st.title}» удалён`, "bell"); }}>
        <Icon name="trash" size={12} />
      </button>
    </div>
  );
}

function DealCard({ d, dragging, draggable, onDrag, onEnd }: { d: Deal; dragging: boolean; draggable: boolean; onDrag: () => void; onEnd: () => void }) {
  const { clients, users, tasks, payments, openModal } = useCRM();
  const cl = clients.find((c) => c.id === d.clientId);
  const u = users.find((x) => x.id === d.ownerId);
  const openTasks = tasks.filter((t) => t.dealId === d.id && !t.done).length;
  const overdueT = tasks.filter((t) => t.dealId === d.id && !t.done && +new Date(t.due) < Date.now()).length;
  const total = dealTotal(d), paid = dealPaid(d, payments);
  const pct = total > 0 ? (paid / total) * 100 : 0;
  return (
    <div draggable={draggable}
      onDragStart={(e) => { if (!draggable) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "move"; onDrag(); }}
      onDragEnd={onEnd}
      onClick={() => openModal({ type: "deal", id: d.id })}
      className={`card !rounded-[10px] p-3 kanban-card ${dragging ? "dragging" : ""} ${draggable ? "" : "!cursor-default"}`}
      title={draggable ? undefined : "Нет права менять стадию этой сделки"}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-bold leading-snug">{d.title}</span>
        <span className="chip flex-none" style={{ background: "var(--panel2)", color: "var(--muted)" }}>{d.type}</span>
      </div>
      <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--muted)" }}>{cl?.name ?? "Клиент не указан"}</div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="font-display text-[13.5px] font-bold">{moneyShort(total)}</span>
        {paid > 0 && <span className="text-[11px] font-bold" style={{ color: "var(--green)" }}>· {Math.round(pct)}% оплачено</span>}
      </div>
      <Progress value={pct} color={pct >= 100 ? "var(--green)" : "var(--amber)"} h={4} />
      <div className="flex items-center gap-1.5 mt-2.5">
        <Avatar user={u} size={22} />
        {openTasks > 0 && (
          <ToneChip tone={overdueT > 0 ? "red" : "muted"}>
            <Icon name="checkSq" size={11} /> {openTasks}
          </ToneChip>
        )}
        <span className="ml-auto text-[10.5px] font-bold" style={{ color: "var(--faint)" }}>{dFmt(d.date)}</span>
      </div>
    </div>
  );
}
