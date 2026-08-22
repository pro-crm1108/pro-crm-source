import React, { useMemo, useState, useEffect } from "react";
import { Icon } from "../components/icons";
import { Avatar, Progress, ToneChip, Empty, PeriodFilter, periodBounds, periodName } from "../components/ui";
import type { Period } from "../components/ui";
import { useCRM, money, moneyShort, dealTotal, dealPaid, dueLabel, dFmt, startOfDay } from "../store";

export default function Home() {
  const { deals, payments, objects, tasks, users, stages, clients, openModal, setPage, saveTask, toast, currentUserId } = useCRM();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<Period>({ kind: "all" });
  const [pFrom, pTo] = periodBounds(period);
  const inPeriod = (isoDate: string) => { const t = +new Date(isoDate); return t >= pFrom && t <= pTo; };
  const pName = periodName(period);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  const fin = useMemo(() => {
    /* сделки и платежи фильтруются по выбранному периоду */
    const pDeals = deals.filter((d) => !d.archived && inPeriod(d.createdAt));
    const totalDeals = pDeals.reduce((a, d) => a + dealTotal(d), 0);
    const income = payments.filter((p) => p.kind === "income" && inPeriod(p.date)).reduce((a, p) => a + p.amount, 0);
    const expense = payments.filter((p) => p.kind === "expense" && inPeriod(p.date)).reduce((a, p) => a + p.amount, 0);
    const remainder = pDeals.reduce((a, d) => a + Math.max(0, dealTotal(d) - dealPaid(d, payments)), 0);
    return { totalDeals, dealCount: pDeals.length, income, expense, remainder, profit: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, payments, pFrom, pTo]);

  const funnel = useMemo(() => stages.map((st) => {
    const ds = deals.filter((d) => d.stageId === st.id && !d.archived);
    return { st, count: ds.length, sum: ds.reduce((a, d) => a + dealTotal(d), 0) };
  }), [stages, deals]);
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));

  const todayTasks = tasks
    .filter((t) => !t.done && new Date(t.due).getTime() < startOfDay(1))
    .sort((a, b) => +new Date(a.due) - +new Date(b.due));

  const upcoming = deals
    .filter((d) => !d.archived)
    .map((d) => ({ d, rest: dealTotal(d) - dealPaid(d, payments) }))
    .filter((x) => x.rest > 0)
    .sort((a, b) => stages.findIndex((s) => s.id === b.d.stageId) - stages.findIndex((s) => s.id === a.d.stageId))
    .slice(0, 4);

  const tiles = [
    { label: "Сумма сделок", val: money(fin.totalDeals), sub: `${fin.dealCount} сделок · ${pName}`, icon: "kanban", tone: "var(--brand)" },
    { label: "Получено", val: money(fin.income), sub: pName, icon: "ruble", tone: "var(--green)" },
    { label: "Остаток", val: money(fin.remainder), sub: "долг клиентов по сделкам", icon: "clock", tone: "var(--amber)" },
    { label: "Расходы", val: money(fin.expense), sub: pName, icon: "wallet", tone: "var(--red)" },
    { label: "Прибыль", val: money(fin.profit), sub: `доходы − расходы · ${pName}`, icon: "funnel", tone: fin.profit >= 0 ? "var(--green)" : "var(--red)" },
    { label: "Активные объекты", val: String(objects.filter((o) => o.status !== "Завершён").length), sub: `${objects.length} всего на учёте`, icon: "building", tone: "#b5566e" },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Сводка</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · всё по вашим объектам и сделкам
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button className="btn btn-ghost btn-sm" onClick={() => setPage("finance")}>
            <Icon name="wallet" size={15} /> Финансы детально
          </button>
        </div>
      </div>

      {/* finance tiles — 6 крупных плиток */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
        {tiles.map((t) => (
          <div key={t.label} className="card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all">
            <span className="absolute right-3.5 top-3.5 w-9 h-9 rounded-[10px] flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "var(--panel2)", color: t.tone }}>
              <Icon name={t.icon} size={18} />
            </span>
            <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase pr-11" style={{ color: "var(--muted)" }}>{t.label}</div>
            <div className="font-display text-[23px] font-bold mt-2.5 leading-none" style={{ color: t.label === "Прибыль" ? t.tone : "var(--ink)" }}>{t.val}</div>
            <div className="text-[11.5px] mt-2 truncate" style={{ color: "var(--faint)" }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* split 60/40 */}
      <div className="grid gap-4 mt-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] grid-cols-1">
        {/* funnel */}
        <div className="card p-5 anim-page">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                <Icon name="funnel" size={17} />
              </span>
              <div>
                <div className="font-display text-[13.5px] font-semibold">Воронка продаж</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Клик по этапу — открыть канбан</div>
              </div>
            </div>
            <button className="btn btn-soft btn-sm" onClick={() => setPage("sales")}><Icon name="kanban" size={14} /> Канбан</button>
          </div>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <button key={f.st.id} className="w-full text-left group cursor-pointer" onClick={() => setPage("sales")}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-[12.5px] font-bold">
                    <span className="w-2 h-2 rounded-full flex-none" style={{ background: f.st.color }} />
                    {f.st.title}
                    <span className="chip" style={{ background: "var(--panel2)", color: "var(--muted)" }}>{f.count}</span>
                  </span>
                  <span className="text-[12px] font-extrabold" style={{ color: "var(--muted)" }}>{moneyShort(f.sum)}</span>
                </div>
                <div className="h-[26px] rounded-[7px] overflow-hidden flex items-center" style={{ background: "var(--panel2)" }}>
                  <div
                    className="h-full rounded-[7px] flex items-center pl-2.5 transition-all duration-700 group-hover:brightness-110"
                    style={{
                      width: mounted ? `${Math.max(f.count > 0 ? 9 : 2, (f.count / maxCount) * 100)}%` : "0%",
                      background: `linear-gradient(90deg, ${f.st.color}, ${f.st.color}cc)`,
                      transitionDelay: `${i * 70}ms`,
                    }}>
                    {f.count > 0 && <span className="text-[11px] font-extrabold text-white drop-shadow">{f.count}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {deals.length > 0 && (
            <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                Конверсия в договор и оплату
              </span>
              <span className="font-display text-[14px] font-bold" style={{ color: "var(--green)" }}>
                {Math.round(((funnel[4]?.count ?? 0) + (funnel[5]?.count ?? 0)) / Math.max(1, deals.length) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* today tasks */}
          <div className="card p-5 anim-page flex-1" style={{ animationDelay: "0.05s" }}>
            <div className="flex items-center justify-between mb-3.5">
              <div className="font-display text-[13.5px] font-semibold">Задачи на сегодня</div>
              <button className="text-[12px] font-bold cursor-pointer hover:opacity-75" style={{ color: "var(--brand)" }} onClick={() => setPage("tasks")}>Все →</button>
            </div>
            {todayTasks.length === 0 ? (
              <Empty icon="checkSq" text="На сегодня задач нет — можно выдохнуть" />
            ) : (
              <div className="space-y-1.5">
                {todayTasks.slice(0, 5).map((t) => {
                  const dl = dueLabel(t.due);
                  const u = users.find((x) => x.id === t.assigneeId);
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-[9px] row-hover group">
                      <button
                        onClick={() => { saveTask({ ...t, done: true }, false); toast(`Задача выполнена: «${t.title}»`); }}
                        className="w-[18px] h-[18px] rounded-[5px] border-2 flex-none cursor-pointer flex items-center justify-center transition-all hover:border-[var(--green)] hover:bg-[var(--green-soft)]"
                        style={{ borderColor: dl.overdue ? "var(--red)" : "var(--line2)" }} title="Выполнить">
                        <Icon name="check" size={11} sw={3} className="opacity-0 group-hover:opacity-70 text-[var(--green)]" />
                      </button>
                      <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => t.dealId ? openModal({ type: "deal", id: t.dealId }) : openModal({ type: "task", id: t.id })}>
                        <span className="block text-[13px] font-bold leading-snug truncate">{t.title}</span>
                        <span className="text-[11px]" style={{ color: dl.overdue ? "var(--red)" : "var(--muted)" }}>{dl.text}</span>
                      </button>
                      <Avatar user={u} size={24} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* upcoming payments */}
          <div className="card p-5 anim-page" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between mb-3.5">
              <div className="font-display text-[13.5px] font-semibold">Ближайшие платежи</div>
              <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>ожидаются</span>
            </div>
            {upcoming.length === 0 ? (
              <Empty icon="ruble" text="Все сделки оплачены" />
            ) : (
              <div className="space-y-2.5">
                {upcoming.map(({ d, rest }) => {
                  const cl = clients.find((c) => c.id === d.clientId);
                  const pct = dealTotal(d) > 0 ? (dealPaid(d, payments) / dealTotal(d)) * 100 : 0;
                  return (
                    <button key={d.id} className="w-full text-left p-2.5 rounded-[10px] row-hover border cursor-pointer" style={{ borderColor: "var(--line)" }}
                      onClick={() => openModal({ type: "deal", id: d.id })}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[12.5px] font-bold truncate">{cl?.name ?? "—"}</span>
                        <span className="text-[12.5px] font-extrabold whitespace-nowrap" style={{ color: "var(--amber)" }}>+{money(rest)}</span>
                      </div>
                      <div className="text-[11px] mb-1.5 truncate" style={{ color: "var(--muted)" }}>{d.title}</div>
                      <Progress value={pct} color="var(--green)" h={5} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
