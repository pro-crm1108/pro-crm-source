import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Avatar, Empty, Seg, Modal } from "../components/ui";
import { useCRM, money, dealTotal, dealPaid, dFmt } from "../store";
import { checkPin } from "../lib/sync";

type Kind = "done" | "lost";

export default function Archive() {
  const { deals, clients, users, stages, openModal, restoreDeal, deleteDeal, toast, mode } = useCRM();
  const [kind, setKind] = useState<Kind>("done");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [busy, setBusy] = useState(false);

  const archived = useMemo(() => deals.filter((d) => d.archived === kind), [deals, kind]);
  const countDone = deals.filter((d) => d.archived === "done").length;
  const countLost = deals.filter((d) => d.archived === "lost").length;

  const doRestore = (id: string) => {
    restoreDeal(id);
    toast("Сделка восстановлена и возвращена в воронку", "bell");
  };

  const openDelete = (id: string) => {
    setDeleteId(id);
    setPin("");
    setPinErr("");
  };
  const closeDelete = () => {
    setDeleteId(null);
    setPin("");
    setPinErr("");
  };

  const doDelete = async () => {
    if (!deleteId) return;
    if (pin.length < 4) {
      setPinErr("Введите ПИН-код (4 цифры)");
      return;
    }
    setBusy(true);
    setPinErr("");
    const server = mode === "cloud" ? await checkPin(pin) : null;
    const ok = server === null ? pin === "0880" : server;
    setBusy(false);
    if (!ok) {
      setPinErr("Неверный ПИН-код");
      return;
    }
    const title = deals.find((d) => d.id === deleteId)?.title ?? "Сделка";
    deleteDeal(deleteId);
    closeDelete();
    toast(`Сделка «${title}» удалена навсегда`, "alert");
  };

  const deletingDeal = deals.find((d) => d.id === deleteId);

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide flex items-center gap-2.5">
            <Icon name="archive" size={24} className="text-[var(--muted)]" /> Архив
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            Завершённые и прерванные сделки. Их можно восстановить в воронку или удалить навсегда.
          </p>
        </div>
        <Seg
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            { v: "done", t: `Сделка завершена · ${countDone}` },
            { v: "lost", t: `Сделка прервана · ${countLost}` },
          ]}
        />
      </div>

      {archived.length === 0 ? (
        <Empty
          icon="archive"
          text={kind === "done" ? "Завершённых сделок пока нет" : "Прерванных сделок пока нет"}
        />
      ) : (
        <div className="space-y-2.5 stagger">
          {archived.map((d) => {
            const client = clients.find((c) => c.id === d.clientId);
            const owner = users.find((u) => u.id === d.ownerId);
            const stage = stages.find((s) => s.id === d.stageId);
            const total = dealTotal(d);
            const paid = dealPaid(d, useCRM.getState().payments);
            const isDone = d.archived === "done";
            return (
              <div
                key={d.id}
                className="card p-4 flex items-center gap-4 flex-wrap transition-all hover:-translate-y-px"
                style={{
                  borderColor: isDone
                    ? "color-mix(in srgb, var(--green) 30%, var(--line))"
                    : "color-mix(in srgb, var(--red) 30%, var(--line))",
                }}
              >
                <span
                  className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-none"
                  style={{
                    background: isDone ? "var(--green-soft)" : "var(--red-soft)",
                    color: isDone ? "var(--green)" : "var(--red)",
                  }}
                >
                  <Icon name={isDone ? "check" : "x"} size={18} sw={2.2} />
                </span>

                <div className="flex-1 min-w-[200px]">
                  <button
                    className="text-[14px] font-extrabold text-left hover:opacity-75 transition-opacity"
                    onClick={() => openModal({ type: "deal", id: d.id })}
                    title="Открыть карточку сделки"
                  >
                    {d.title}
                  </button>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11.5px]" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1"><Icon name="user" size={11} /> {client?.name ?? "—"}</span>
                    {stage && (
                      <span className="flex items-center gap-1">
                        <i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: stage.color }} /> {stage.title}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Icon name="calendar" size={11} /> {dFmt(d.createdAt)}</span>
                  </div>
                </div>

                <div className="text-right flex-none">
                  <div className="font-display text-[15px] font-bold">{money(total)}</div>
                  <div className="text-[11px]" style={{ color: paid >= total ? "var(--green)" : "var(--amber)" }}>
                    оплачено {money(paid)}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  <Avatar user={owner} size={28} />
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => doRestore(d.id)}
                    title="Вернуть сделку в воронку"
                  >
                    <Icon name="undo" size={14} /> Восстановить
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => openDelete(d.id)}
                    title="Удалить сделку навсегда (по ПИН-коду)"
                  >
                    <Icon name="trash" size={13} /> Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] mt-5 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
        <Icon name="note" size={13} className="mt-px flex-none" />
        Архивные сделки не отображаются в воронке продаж и на главной странице, но сохраняют всю историю:
        платежи, задачи и журнал действий. «Удалить» — необратимо и защищено ПИН-кодом директора.
      </p>

      {/* окно удаления с ПИН-кодом */}
      {deletingDeal && (
        <Modal onClose={closeDelete} width={420} icon="trash" title="Удаление сделки из архива">
          <div className="p-5">
            <div className="flex items-start gap-2.5 p-3 rounded-[10px] mb-4"
              style={{ background: "var(--red-soft)", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)" }}>
              <Icon name="alert" size={16} className="mt-px flex-none text-[var(--red)]" />
              <div className="text-[12px] font-semibold leading-relaxed" style={{ color: "var(--red)" }}>
                Сделка <b>«{deletingDeal.title}»</b> будет удалена <b>навсегда</b> вместе со всей историей:
                задачами, платежами и журналом. Восстановить её после этого будет невозможно.
              </div>
            </div>
            <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
              Чтобы подтвердить удаление, введите ПИН-код директора:
            </div>
            <input
              className="input text-center !text-[20px] !font-extrabold tracking-[0.4em]"
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={pin} autoFocus
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && doDelete()}
            />
            {pinErr && (
              <div className="flex items-center gap-2 mt-3 text-[12.5px] font-bold anim-pop" style={{ color: "var(--red)" }}>
                <Icon name="alert" size={14} /> {pinErr}
              </div>
            )}
            <div className="flex items-center gap-2 mt-5">
              <div className="flex-1" />
              <button className="btn btn-ghost" onClick={closeDelete}>Отмена</button>
              <button className="btn btn-danger" onClick={doDelete} disabled={busy || pin.length < 4}>
                {busy ? "Проверяем…" : <><Icon name="trash" size={14} /> Удалить навсегда</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
