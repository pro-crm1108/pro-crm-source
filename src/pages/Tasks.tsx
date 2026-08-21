import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Avatar, Seg, Empty, ToneChip } from "../components/ui";
import { useCRM, useCan, usePermScope, dueLabel, startOfDay } from "../store";

export default function Tasks() {
  const { tasks, users, deals, clients, openModal, saveTask, toast, currentUserId } = useCRM();
  const can = useCan();
  const scope = usePermScope();
  const [filter, setFilter] = useState("all");

  /* «Только свои» или нет права «Просмотр чужих задач» → видны только свои */
  const onlyMine = scope("tasks.view") === "own" || !can("tasks.viewOthers");

  const list = useMemo(() => {
    const nowT = Date.now();
    let arr = tasks.filter((t) => !onlyMine || t.assigneeId === currentUserId);
    if (filter === "open") arr = arr.filter((t) => !t.done);
    if (filter === "today") arr = arr.filter((t) => !t.done && +new Date(t.due) < startOfDay(1));
    if (filter === "overdue") arr = arr.filter((t) => !t.done && +new Date(t.due) < nowT);
    if (filter === "done") arr = arr.filter((t) => t.done);
    // просроченные всегда вверху, далее по сроку
    return arr.sort((a, b) => {
      const ao = !a.done && +new Date(a.due) < nowT ? 0 : 1;
      const bo = !b.done && +new Date(b.due) < nowT ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if (a.done !== b.done) return a.done ? 1 : -1;
      return +new Date(a.due) - +new Date(b.due);
    });
  }, [tasks, filter, onlyMine, currentUserId]);

  const overdueCount = list.filter((t) => !t.done && +new Date(t.due) < Date.now()).length;

  return (
    <div className="p-6 max-w-[980px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Задачи</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {tasks.filter((t) => !t.done).length} открытых
            {overdueCount > 0 && <span style={{ color: "var(--red)" }}> · {overdueCount} просрочено — они сверху</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal({ type: "task" })}><Icon name="plus" size={15} sw={2.4} /> Задача</button>
      </div>

      <div className="mb-4">
        <Seg value={filter} onChange={setFilter} options={[
          { v: "all", t: "Все" }, { v: "open", t: "Открытые" }, { v: "today", t: "Сегодня" },
          { v: "overdue", t: `Просрочено${overdueCount ? ` · ${overdueCount}` : ""}` }, { v: "done", t: "Завершённые" },
        ]} />
      </div>

      {list.length === 0 ? (
        <Empty icon="checkSq" text="Задач в этом фильтре нет"
          action={<button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "task" })}>+ Новая задача</button>} />
      ) : (
        <div className="space-y-2 stagger">
          {list.map((t) => {
            const dl = dueLabel(t.due);
            const od = !t.done && dl.overdue;
            const u = users.find((x) => x.id === t.assigneeId);
            const deal = deals.find((d) => d.id === t.dealId);
            const client = clients.find((c) => c.id === t.clientId);
            return (
              <div key={t.id}
                className="card p-3.5 flex items-start gap-3 transition-all hover:-translate-y-px group"
                style={od ? { borderColor: "color-mix(in srgb, var(--red) 45%, var(--line))", background: "color-mix(in srgb, var(--red) 5%, var(--panel))" } : undefined}>
                <button
                  onClick={() => { saveTask({ ...t, done: !t.done }, false); toast(t.done ? "Задача возвращена в работу" : `Выполнено: «${t.title}»`); }}
                  className="w-[20px] h-[20px] mt-0.5 rounded-[6px] border-2 flex-none cursor-pointer flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    borderColor: t.done ? "var(--green)" : od ? "var(--red)" : "var(--line2)",
                    background: t.done ? "var(--green)" : "transparent",
                  }}
                  title={t.done ? "Вернуть в работу" : "Отметить выполненной"}>
                  {t.done && <Icon name="check" size={12} sw={3.2} className="text-white" />}
                </button>
                <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => openModal({ type: "task", id: t.id })}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13.5px] font-bold leading-snug ${t.done ? "line-through opacity-50" : ""}`}>{t.title}</span>
                    {od && <ToneChip tone="red"><Icon name="alert" size={11} /> просрочена</ToneChip>}
                    {t.done && <ToneChip tone="green">выполнена</ToneChip>}
                  </div>
                  {t.note && <div className="text-[12px] mt-0.5 truncate" style={{ color: "var(--muted)" }}>{t.note}</div>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <ToneChip tone={t.done ? "muted" : od ? "red" : dl.tone === "amber" ? "amber" : "muted"}>
                      <Icon name="clock" size={11} /> {dl.text}
                    </ToneChip>
                    {deal && (
                      <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                        <Icon name="kanban" size={11} /> {deal.title}
                      </span>
                    )}
                    {client && !deal && (
                      <span className="chip" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                        <Icon name="user" size={11} /> {client.name}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-none">
                  <Avatar user={u} size={28} />
                  <button className="icon-btn opacity-0 group-hover:opacity-100" onClick={() => openModal({ type: "task", id: t.id })} title="Редактировать">
                    <Icon name="pencil" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
