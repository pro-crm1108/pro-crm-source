import React from "react";
import { Icon } from "../components/icons";
import { Empty, Scale, ToneChip } from "../components/ui";
import { useCRM, money, moneyShort, dealTotal, dealPaid } from "../store";

const STATUS_TONE: Record<string, "green" | "amber" | "blue" | "muted" | "red"> = {
  "В работе": "green", "Смета": "amber", "Замер": "blue", "Проект": "muted", "Завершён": "muted", "Пауза": "red",
};

export default function Objects() {
  const { objects, clients, deals, payments, jobs, openModal } = useCRM();

  return (
    <div className="p-6 max-w-[1250px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Объекты</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{objects.length} объектов · шкала оплаты по каждой карточке</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal({ type: "object" })}><Icon name="plus" size={15} sw={2.4} /> Объект</button>
      </div>

      {objects.length === 0 ? (
        <Empty icon="building" text="Объектов пока нет" action={<button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "object" })}>+ Добавить объект</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {objects.map((o) => {
            const cl = clients.find((c) => c.id === o.clientId);
            const deal = deals.find((d) => d.id === o.dealId);
            const total = deal ? dealTotal(deal) : 0;
            const paid = deal ? dealPaid(deal, payments) : 0;
            const oj = jobs.filter((j) => j.objectId === o.id);
            const active = oj.filter((j) => j.stage !== "done").length;
            return (
              <button key={o.id} onClick={() => openModal({ type: "object", id: o.id })}
                className="card p-4 text-left cursor-pointer transition-all hover:-translate-y-1 group"
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-lg)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow)")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-none transition-transform group-hover:scale-110" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                    <Icon name="building" size={19} />
                  </span>
                  <ToneChip tone={STATUS_TONE[o.status] ?? "muted"}>{o.status}</ToneChip>
                </div>
                <div className="text-[14.5px] font-extrabold mt-3 leading-snug">{o.title}</div>
                <div className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                  <Icon name="dot" size={9} /> {o.address}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                  <span className="flex items-center gap-1.5"><Icon name="grid" size={13} /> {o.kind} · {o.area}</span>
                  <span className="flex items-center gap-1.5"><Icon name="user" size={13} /> {cl?.name ?? "—"}</span>
                  <span className="flex items-center gap-1.5"><Icon name="hammer" size={13} /> {active} из {oj.length} работ</span>
                </div>

                {/* payment scale */}
                <div className="mt-4 pt-3.5 border-t" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-center justify-between mb-1.5 text-[11.5px] font-bold">
                    <span style={{ color: "var(--muted)" }}>Оплата по сделке</span>
                    {total > 0 ? (
                      <span><span style={{ color: "var(--green)" }}>{moneyShort(paid)}</span> <span style={{ color: "var(--faint)" }}>/ {moneyShort(total)}</span></span>
                    ) : (
                      <span style={{ color: "var(--faint)" }}>сделка не привязана</span>
                    )}
                  </div>
                  <Scale total={total} paid={paid} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
