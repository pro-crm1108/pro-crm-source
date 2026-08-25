import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Empty, PeriodFilter, periodBounds, periodName } from "../components/ui";
import type { Period } from "../components/ui";
import { useCRM, money, moneyShort, dealTotal, dealPaid, dFmt } from "../store";

export default function Finance() {
  const { payments, deals, clients, openModal } = useCRM();
  const [period, setPeriod] = useState<Period>({ kind: "all" });
  const [pFrom, pTo] = periodBounds(period);
  const pName = periodName(period);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const t = +new Date(p.date);
      return t >= pFrom && t <= pTo;
    });
  }, [payments, pFrom, pTo]);

  const income = filtered.filter((p) => p.kind === "income").reduce((a, p) => a + p.amount, 0);
  const expense = filtered.filter((p) => p.kind === "expense").reduce((a, p) => a + p.amount, 0);
  /* долг считаем только по активным сделкам (прерванные не ожидаются к оплате) */
  const debt = deals.filter((d) => d.archived !== "lost").reduce((a, d) => a + Math.max(0, dealTotal(d) - dealPaid(d, payments)), 0);

  const tiles = [
    { label: "Доход", val: moneyShort(income), icon: "ruble", tone: "var(--green)", note: `${filtered.filter((p) => p.kind === "income").length} поступлений · ${pName}` },
    { label: "Расход", val: moneyShort(expense), icon: "wallet", tone: "var(--red)", note: `${filtered.filter((p) => p.kind === "expense").length} операций · ${pName}` },
    { label: "Прибыль", val: moneyShort(income - expense), icon: "funnel", tone: income - expense >= 0 ? "var(--green)" : "var(--red)", note: income > 0 ? `маржа ${Math.round(((income - expense) / income) * 100)}% · ${pName}` : `— · ${pName}` },
    { label: "Долг клиентов", val: moneyShort(debt), icon: "clock", tone: "var(--amber)", note: "по всем сделкам" },
  ];

  const incomes = filtered.filter((p) => p.kind === "income").sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const expenses = filtered.filter((p) => p.kind === "expense").sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="p-6 max-w-[1250px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Финансы</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>Поступления и расходы по проектам</p>
        </div>
        <div className="flex items-center gap-2.5">
          <PeriodFilter value={period} onChange={setPeriod} />
          <button className="btn btn-primary" onClick={() => openModal({ type: "payment", kind: "income" })}><Icon name="plus" size={15} sw={2.4} /> Платёж</button>
          <button className="btn btn-ghost" onClick={() => openModal({ type: "payment", kind: "expense" })}><Icon name="plus" size={15} sw={2.4} /> Расход</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger mb-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4 relative overflow-hidden hover:-translate-y-0.5 transition-transform">
            <span className="absolute right-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--panel2)", color: t.tone }}>
              <Icon name={t.icon} size={16} />
            </span>
            <div className="text-[10.5px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>{t.label}</div>
            <div className="font-display text-[20px] font-bold mt-2 leading-none" style={{ color: t.tone }}>{t.val}</div>
            <div className="text-[11px] mt-1.5" style={{ color: "var(--faint)" }}>{t.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PayList title="Поступления" tone="var(--green)" icon="ruble" items={incomes} onAdd={() => openModal({ type: "payment", kind: "income" })}
          clients={clients} deals={deals} sign="+" empty="Поступлений за период нет" />
        <PayList title="Расходы" tone="var(--red)" icon="wallet" items={expenses} onAdd={() => openModal({ type: "payment", kind: "expense" })}
          clients={clients} deals={deals} sign="−" empty="Расходов за период нет" />
      </div>
    </div>
  );
}

function PayList({ title, tone, icon, items, onAdd, sign, empty, clients, deals }: any) {
  const { openModal, deletePayment, toast } = useCRM();
  const total = items.reduce((a: number, p: any) => a + p.amount, 0);
  return (
    <div className="card anim-page overflow-hidden flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: "var(--line)" }}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--panel2)", color: tone }}>
          <Icon name={icon} size={16} />
        </span>
        <div className="flex-1">
          <div className="font-display text-[13px] font-semibold">{title}</div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>{items.length} операций · <b style={{ color: tone }}>{money(total)}</b></div>
        </div>
        <button className="btn btn-soft btn-sm" onClick={onAdd}><Icon name="plus" size={13} sw={2.4} /> Добавить</button>
      </div>
      <div className="overflow-y-auto max-h-[440px]">
        {items.length === 0 ? (
          <div className="p-5"><Empty icon={icon} text={empty} /></div>
        ) : (
          items.map((p: any) => {
            const deal = deals.find((d: any) => d.id === p.dealId);
            const client = clients.find((c: any) => c.id === p.clientId);
            return (
              <div key={p.id} className="group flex items-center gap-3 px-4 py-3 border-t row-hover" style={{ borderColor: "var(--line)" }}>
                <span className="w-9 h-9 rounded-[10px] flex flex-col items-center justify-center flex-none leading-none"
                  style={{ background: "var(--panel2)", color: "var(--muted)" }}>
                  <span className="text-[12px] font-extrabold">{new Date(p.date).getDate()}</span>
                  <span className="text-[8.5px] font-bold uppercase mt-0.5">{dFmt(p.date).split(" ")[1]}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{p.note || (p.kind === "income" ? "Поступление" : p.category)}</div>
                  <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>
                    {p.kind === "income" ? (deal?.title ?? client?.name ?? "—") : `${p.category}${deal ? ` · ${deal.title}` : ""}`} · {p.method} · {dFmt(p.date)}
                  </div>
                </div>
                <span className="font-display text-[13.5px] font-bold whitespace-nowrap" style={{ color: tone }}>
                  {sign}{money(p.amount)}
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
          })
        )}
      </div>
    </div>
  );
}
