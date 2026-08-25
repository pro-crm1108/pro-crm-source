import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Avatar, Seg, Empty, ToneChip } from "../components/ui";
import { useCRM, dFmt } from "../store";
import type { Job, JobStage } from "../types";

const COLS: { id: JobStage | "overdue"; title: string; color: string }[] = [
  { id: "plan", title: "Запланировано", color: "#4c7fb5" },
  { id: "work", title: "В работе", color: "#c9a227" },
  { id: "check", title: "На проверке", color: "#d9782b" },
  { id: "overdue", title: "Просрочено", color: "#c94f42" },
  { id: "done", title: "Завершено", color: "#3e8757" },
];

const isOverdue = (j: Job) => j.stage !== "done" && +new Date(j.deadline) < Date.now();

export default function Jobs() {
  const { jobs, objects, users, openModal, moveJob, saveJob, toast } = useCRM();
  const [objFilter, setObjFilter] = useState("all");
  const [mode, setMode] = useState<"tiles" | "list">("tiles");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const filtered = useMemo(() => jobs.filter((j) => objFilter === "all" || j.objectId === objFilter), [jobs, objFilter]);
  const byCol = (col: string) =>
    col === "overdue" ? filtered.filter(isOverdue) : filtered.filter((j) => j.stage === col && !isOverdue(j));

  return (
    <div className="p-6 max-w-[1440px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-none flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Работы</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {jobs.filter((j) => j.stage !== "done").length} активных · {jobs.filter(isOverdue).length} просрочено
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select className="select !w-auto" value={objFilter} onChange={(e) => setObjFilter(e.target.value)}>
            <option value="all">Все объекты</option>
            {objects.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          <Seg options={[{ v: "tiles", t: "Плитки" }, { v: "list", t: "Список" }]} value={mode} onChange={(v) => setMode(v as any)} />
          <button className="btn btn-primary" onClick={() => openModal({ type: "job", objectId: objFilter === "all" ? undefined : objFilter })}>
            <Icon name="plus" size={15} sw={2.4} /> Работа
          </button>
        </div>
      </div>

      {mode === "tiles" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1">
          <div className="flex gap-3 h-full min-w-max">
            {COLS.map((col) => {
              const list = byCol(col.id);
              return (
                <div key={col.id}
                  className={`w-[262px] flex-none flex flex-col rounded-xl border transition-colors ${overCol === col.id ? "kanban-col-drop" : ""}`}
                  style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
                  onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                  onDrop={() => {
                    if (dragId && col.id !== "overdue") {
                      moveJob(dragId, col.id as JobStage);
                      toast(`Работа перенесена: «${col.title}»`, "check");
                    }
                    setDragId(null); setOverCol(null);
                  }}>
                  <div className="px-3.5 pt-3 pb-2.5 flex items-center gap-2 flex-none">
                    <span className="w-2.5 h-2.5 rounded-[4px]" style={{ background: col.color }} />
                    <span className="text-[12.5px] font-extrabold tracking-wide">{col.title}</span>
                    <span className="ml-auto chip" style={{ background: "var(--panel)", color: col.id === "overdue" && list.length > 0 ? "var(--red)" : "var(--muted)" }}>{list.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2.5 space-y-2">
                    {list.length === 0 && (
                      <div className="text-[12px] font-semibold text-center py-8 rounded-lg" style={{ color: "var(--faint)", border: "1.5px dashed var(--line2)" }}>
                        {col.id === "overdue" ? "Просрочек нет" : "Пусто"}
                      </div>
                    )}
                    {list.map((j) => <JobCard key={j.id} j={j} dragging={dragId === j.id} onDrag={() => setDragId(j.id)} onEnd={() => { setDragId(null); setOverCol(null); }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card flex-1 overflow-auto anim-fade">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: "var(--panel2)" }}>
                {["Работа", "Объект", "Этап", "Срок", "Ответственный", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[10.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => {
                const o = objects.find((x) => x.id === j.objectId);
                const u = users.find((x) => x.id === j.assigneeId);
                const od = isOverdue(j);
                return (
                  <tr key={j.id} className="row-hover border-t" style={{ borderColor: "var(--line)" }} onClick={() => openModal({ type: "job", id: j.id })}>
                    <td className="px-4 py-3 text-[13px] font-bold">{j.title}</td>
                    <td className="px-4 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>{o?.title ?? "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select className="select !w-auto !py-1 !px-2.5 !text-[12px] font-bold" value={j.stage}
                        onChange={(e) => { saveJob({ ...j, stage: e.target.value as JobStage }, false); }}>
                        <option value="plan">Запланировано</option><option value="work">В работе</option>
                        <option value="check">На проверке</option><option value="done">Завершено</option>
                      </select>
                    </td>
                    <td className="px-4 py-3"><ToneChip tone={od ? "red" : j.stage === "done" ? "green" : "muted"}>{od ? `Просрочено · ${dFmt(j.deadline)}` : dFmt(j.deadline)}</ToneChip></td>
                    <td className="px-4 py-3"><Avatar user={u} size={26} /></td>
                    <td className="px-4 py-3 text-right"><Icon name="chevR" size={15} className="text-[var(--faint)] inline" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8"><Empty icon="hammer" text="Работ по выбранному объекту нет" /></div>}
        </div>
      )}
    </div>
  );
}

function JobCard({ j, dragging, onDrag, onEnd }: { j: Job; dragging: boolean; onDrag: () => void; onEnd: () => void }) {
  const { objects, users, openModal } = useCRM();
  const o = objects.find((x) => x.id === j.objectId);
  const u = users.find((x) => x.id === j.assigneeId);
  const od = isOverdue(j);
  return (
    <div draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDrag(); }}
      onDragEnd={onEnd}
      onClick={() => openModal({ type: "job", id: j.id })}
      className={`card !rounded-[10px] p-3 kanban-card ${dragging ? "dragging" : ""}`}
      style={od ? { borderColor: "color-mix(in srgb, var(--red) 45%, var(--line))" } : undefined}>
      <div className="text-[13px] font-bold leading-snug">{j.title}</div>
      <div className="text-[11.5px] mt-1 flex items-center gap-1.5 truncate" style={{ color: "var(--muted)" }}>
        <Icon name="building" size={12} /> {o?.title ?? "Объект не указан"}
      </div>
      <div className="text-[10.5px] mt-1" style={{ color: "var(--faint)" }}>
        {j.start ? `${dFmt(j.start)} → ${dFmt(j.deadline)}` : `до ${dFmt(j.deadline)}`}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Avatar user={u} size={22} />
        <ToneChip tone={od ? "red" : j.stage === "done" ? "green" : "muted"}>
          <Icon name="calendar" size={11} /> {dFmt(j.deadline)}
        </ToneChip>
        {j.stage === "done" && <Icon name="check" size={14} className="ml-auto text-[var(--green)]" sw={2.5} />}
      </div>
    </div>
  );
}
