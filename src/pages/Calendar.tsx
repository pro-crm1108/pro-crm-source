import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { useCRM, dealTotal, money } from "../store";
import type { Deal, Job, Task } from "../types";

const MONTHS_FULL = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

/* цвета этапов работы */
const JOB_STAGE: Record<string, { label: string; color: string }> = {
  plan: { label: "Запланировано", color: "#4c7fb5" },
  work: { label: "В работе", color: "#c9a227" },
  check: { label: "На проверке", color: "#d9782b" },
  done: { label: "Завершено", color: "#3e8757" },
};

const startOfMonth = (y: number, m: number) => new Date(y, m, 1).getTime();
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

type Row =
  | { kind: "job"; job: Job; from: number; to: number; deal: Deal; objectTitle: string }
  | { kind: "task"; task: Task; day: number; deal: Deal | null };

export default function Calendar() {
  const { deals, jobs, tasks, objects, stages, openModal } = useCRM();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<"all" | "jobs" | "tasks">("all");

  const mStart = startOfMonth(year, month);
  const nDays = daysInMonth(year, month);
  const mEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

  const shift = (d: number) => {
    const nm = month + d;
    const ny = year + Math.floor(nm / 12);
    setMonth(((nm % 12) + 12) % 12);
    setYear(ny);
  };

  /* активные (не архивные) сделки */
  const activeDeals = useMemo(() => deals.filter((d) => !d.archived), [deals]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (filter !== "tasks") {
      for (const j of jobs) {
        const from = j.start ? +new Date(j.start) : +new Date(j.deadline);
        const to = +new Date(j.deadline);
        if (to < mStart || from > mEnd) continue; // вне месяца
        const deal = activeDeals.find((d) => d.id === j.objectId) || null;
        const obj = objects.find((o) => o.id === j.objectId);
        const dealOfObj = obj ? activeDeals.find((d) => d.id === obj.dealId) ?? null : null;
        out.push({ kind: "job", job: j, from, to, deal: dealOfObj ?? (deal as any), objectTitle: obj?.title ?? "Без объекта" });
      }
    }
    if (filter !== "jobs") {
      for (const t of tasks) {
        const day = +new Date(t.due);
        if (day < mStart || day > mEnd) continue;
        const deal = t.dealId ? activeDeals.find((d) => d.id === t.dealId) ?? null : null;
        out.push({ kind: "task", task: t, day, deal });
      }
    }
    return out;
  }, [jobs, tasks, activeDeals, objects, mStart, mEnd, filter]);

  /* группировка: сделка → (объект → строки) */
  const groups = useMemo(() => {
    const byDeal = new Map<string, { deal: Deal | null; rows: Row[] }>();
    for (const r of rows) {
      const key = r.deal ? r.deal.id : "__nodeal__";
      if (!byDeal.has(key)) byDeal.set(key, { deal: r.deal, rows: [] });
      byDeal.get(key)!.rows.push(r);
    }
    return [...byDeal.values()].sort((a, b) => (a.deal ? 0 : 1) - (b.deal ? 0 : 1));
  }, [rows]);

  const dayNum = (t: number) => new Date(t).getDate();
  const isToday = (d: number) => {
    const t = new Date();
    return d === t.getDate() && month === t.getMonth() && year === t.getFullYear();
  };

  const stageColor = stages.find((s) => s.id === (rows[0] as any)?.deal?.stageId)?.color;

  return (
    <div className="p-6 max-w-[1250px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Календарь</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            Таймлайн работ и задач по сделкам · {MONTHS_FULL[month]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="seg">
            {([["all","Всё"],["jobs","Работы"],["tasks","Задачи"]] as const).map(([v, t]) => (
              <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 card !p-1">
            <button className="icon-btn !w-8 !h-8" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><Icon name="chevL" size={15} /></button>
            <button className="text-[13px] font-extrabold px-2 min-w-[130px] text-center" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} title="К текущему месяцу">
              {MONTHS_FULL[month]} {year}
            </button>
            <button className="icon-btn !w-8 !h-8" onClick={() => shift(1)} aria-label="Следующий месяц"><Icon name="chevR" size={15} /></button>
          </div>
        </div>
      </div>

      {/* легенда */}
      <div className="flex items-center gap-4 mb-4 flex-wrap text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
        {Object.values(JOB_STAGE).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} /> {s.label}</span>
        ))}
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--brand)" }} /> Задача</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--red)" }} /> Просрочено</span>
      </div>

      {groups.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--panel2)", color: "var(--faint)" }}>
            <Icon name="calendar" size={24} />
          </span>
          <div className="text-[14px] font-bold">В этом месяце ничего нет</div>
          <div className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Работы и задачи с датами в {MONTHS_FULL[month].toLowerCase()} {year} появятся здесь</div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ deal, rows: grs }) => {
            const stColor = deal ? stages.find((s) => s.id === deal.stageId)?.color ?? "var(--brand)" : "var(--muted)";
            return (
              <div key={deal?.id ?? "__nodeal__"} className="card overflow-hidden">
                {/* шапка сделки */}
                <button className="w-full flex items-center gap-3 px-4 py-3 border-b row-hover text-left" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  onClick={() => deal && openModal({ type: "deal", id: deal.id })}>
                  <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: stColor }} />
                  <span className="text-[13.5px] font-extrabold flex-1 truncate">{deal ? deal.title : "Без сделки"}</span>
                  {deal && <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>{money(dealTotal(deal))}</span>}
                  {deal && <Icon name="chevR" size={15} className="text-[var(--faint)]" />}
                </button>

                {/* сетка дней (шапка) */}
                <div className="overflow-x-auto">
                  <div style={{ minWidth: nDays * 34 }}>
                    <div className="flex border-b" style={{ borderColor: "var(--line)" }}>
                      <div className="w-[220px] flex-none px-4 py-1.5 text-[10.5px] font-extrabold tracking-wide uppercase" style={{ color: "var(--faint)" }}>Работа / задача</div>
                      <div className="flex flex-1">
                        {Array.from({ length: nDays }, (_, i) => (
                          <div key={i} className="flex-1 text-center py-1.5 text-[10px] font-bold border-l first:border-l-0"
                            style={{ borderColor: "var(--line)", color: isToday(i + 1) ? "var(--brand)" : "var(--faint)", background: isToday(i + 1) ? "color-mix(in srgb, var(--brand) 8%, transparent)" : undefined }}>
                            <div>{i + 1}</div>
                            <div className="opacity-60">{WEEKDAYS[new Date(year, month, i + 1).getDay() === 0 ? 6 : new Date(year, month, i + 1).getDay() - 1]}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* строки */}
                    {grs.map((r, ri) => {
                      if (r.kind === "job") {
                        const fromDay = Math.max(1, dayNum(r.from));
                        const toDay = Math.min(nDays, dayNum(r.to));
                        const overdue = r.job.stage !== "done" && +new Date(r.job.deadline) < Date.now();
                        const jc = overdue ? "var(--red)" : JOB_STAGE[r.job.stage].color;
                        return (
                          <div key={"j" + r.job.id} className="flex border-b last:border-b-0 group" style={{ borderColor: "var(--line)" }}>
                            <button className="w-[220px] flex-none px-4 py-2 text-left row-hover" onClick={() => openModal({ type: "job", id: r.job.id })}>
                              <div className="text-[12px] font-bold truncate">{r.job.title}</div>
                              <div className="text-[10.5px] truncate" style={{ color: "var(--muted)" }}>{r.objectTitle}</div>
                            </button>
                            <div className="flex flex-1 relative py-1.5">
                              {Array.from({ length: nDays }, (_, i) => (
                                <div key={i} className="flex-1 border-l first:border-l-0" style={{ borderColor: "var(--line)", background: isToday(i + 1) ? "color-mix(in srgb, var(--brand) 5%, transparent)" : undefined }} />
                              ))}
                              <div className="absolute top-1/2 -translate-y-1/2 h-[18px] rounded-[5px] flex items-center px-1.5 cursor-pointer transition-all hover:brightness-110"
                                style={{
                                  left: `calc(${((fromDay - 1) / nDays) * 100}% + 2px)`,
                                  width: `calc(${((toDay - fromDay + 1) / nDays) * 100}% - 4px)`,
                                  background: jc, minWidth: 14,
                                }}
                                title={`${r.job.title} · ${dayNum(r.from)}–${dayNum(r.to)}`}
                                onClick={() => openModal({ type: "job", id: r.job.id })}>
                                <span className="text-[9.5px] font-extrabold text-white truncate">{JOB_STAGE[r.job.stage].label}</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        const t = r.task;
                        const d = new Date(t.due).getDate();
                        const overdue = !t.done && +new Date(t.due) < Date.now();
                        return (
                          <div key={"t" + t.id} className="flex border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                            <button className="w-[220px] flex-none px-4 py-2 text-left row-hover" onClick={() => openModal({ type: "task", id: t.id })}>
                              <div className={`text-[12px] font-bold truncate ${t.done ? "line-through opacity-50" : ""}`}>{t.title}</div>
                              <div className="text-[10.5px]" style={{ color: overdue ? "var(--red)" : "var(--muted)" }}>{overdue ? "Просрочено" : "Задача"}</div>
                            </button>
                            <div className="flex flex-1 relative py-1.5">
                              {Array.from({ length: nDays }, (_, i) => (
                                <div key={i} className="flex-1 border-l first:border-l-0" style={{ borderColor: "var(--line)", background: isToday(i + 1) ? "color-mix(in srgb, var(--brand) 5%, transparent)" : undefined }} />
                              ))}
                              <div className="absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                                style={{ left: `calc(${((d - 1) / nDays) * 100}% + ${100 / nDays / 2}% - 11px)`, background: t.done ? "var(--green)" : overdue ? "var(--red)" : "var(--brand)" }}
                                title={t.title}
                                onClick={() => openModal({ type: "task", id: t.id })}>
                                <Icon name={t.done ? "check" : "dot"} size={11} className="text-white" sw={3} />
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
