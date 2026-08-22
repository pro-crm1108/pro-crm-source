import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Seg, Empty, ToneChip } from "../components/ui";
import { useCRM, money, moneyShort, dealTotal, dFmt } from "../store";

export default function Clients() {
  const { clients, deals, openModal, payments } = useCRM();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (kind === "fiz" && c.kind !== "fiz") return false;
      if (kind === "yur" && c.kind !== "yur") return false;
      if (s && !(c.name.toLowerCase().includes(s) || c.phone.toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s) || c.email.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [clients, q, kind]);

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Клиенты</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {clients.length} в базе · {clients.filter((c) => c.kind === "yur").length} юр. лиц
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal({ type: "client" })}><Icon name="plus" size={15} sw={2.4} /> Клиент</button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-[380px]">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input className="input !pl-10" placeholder="Поиск по имени, телефону, фирме…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Seg options={[{ v: "all", t: "Все" }, { v: "fiz", t: "Физ. лица" }, { v: "yur", t: "Юр. лица" }]} value={kind} onChange={setKind} />
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8">
            <Empty icon="users" text={q ? `Не найдено: «${q}»` : "Клиентов в этой категории нет"}
              action={!q ? <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "client" })}>+ Добавить клиента</button> : undefined} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--panel2)" }}>
                {["Клиент", "Тип", "Контакты", "Сделки", "Сумма", "В базе с"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const cd = deals.filter((d) => d.clientId === c.id);
                const sum = cd.reduce((a, d) => a + dealTotal(d), 0);
                return (
                  <tr key={c.id} className="row-hover border-t" style={{ borderColor: "var(--line)" }} onClick={() => openModal({ type: "client", id: c.id })}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-extrabold flex-none"
                          style={{ background: c.kind === "yur" ? "var(--blue-soft)" : "var(--brand-soft)", color: c.kind === "yur" ? "var(--blue)" : "var(--brand)" }}>
                          {c.kind === "yur" ? <Icon name="firm" size={16} /> : c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold truncate">{c.name}</div>
                          {c.company && <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{c.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ToneChip tone={c.kind === "yur" ? "blue" : "green"}>{c.kind === "yur" ? "Юр. лицо" : "Физ. лицо"}</ToneChip>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12.5px] font-semibold whitespace-nowrap">{c.phone || "—"}</div>
                      <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{c.email || "почта не указана"}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-extrabold whitespace-nowrap">{cd.length}</td>
                    <td className="px-4 py-3 text-[13px] font-extrabold whitespace-nowrap">{sum > 0 ? money(sum) : "—"}</td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{dFmt(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
