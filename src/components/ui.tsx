import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useCRM, initials, money } from "../store";
import type { User } from "../types";

/* ---------- Modal stack context (для 3D-наложения окон) ---------- */
export const ModalStackCtx = createContext<{ index: number; size: number }>({ index: 0, size: 1 });
export const useModalStack = () => useContext(ModalStackCtx);

/* ---------- бейдж «только просмотр» (для футеров модальных окон) ---------- */
export function RoBadge({ text = "только просмотр" }: { text?: string }) {
  return (
    <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)" }}>
      <Icon name="eye" size={12} /> {text}
    </span>
  );
}

/* ---------- Modal shell ---------- */
export function Modal({ children, onClose, width = 860, title, icon, footer, fill }: {
  children: React.ReactNode; onClose: () => void; width?: number; title?: React.ReactNode; icon?: string;
  footer?: React.ReactNode; fill?: boolean;
}) {
  const { index, size } = useModalStack();
  const depth = size - 1 - index; // сколько окон лежит поверх этого
  const isTop = depth === 0;

  useEffect(() => {
    if (!isTop) return; // Escape закрывает только верхнее окно
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, isTop]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 anim-fade"
      style={{
        zIndex: 60 + index,
        background: "rgba(14,20,17,0.5)",
        backdropFilter: "blur(3px)",
        pointerEvents: isTop ? "auto" : "none",
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%", maxWidth: width,
          transform: depth > 0 ? `scale(${1 - depth * 0.055}) translateY(${depth * 22}px)` : undefined,
          opacity: depth > 0 ? Math.max(0.45, 1 - depth * 0.28) : 1,
          transition: "transform .35s cubic-bezier(.22,1,.36,1), opacity .3s ease",
        }}
      >
        <div className="card anim-pop flex flex-col max-h-[92vh] w-full" style={{ maxWidth: width, boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b flex-none" style={{ borderColor: "var(--line)" }}>
            {icon && (
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                <Icon name={icon} size={17} />
              </span>
            )}
            <div className="font-display text-[13px] font-semibold tracking-wide flex-1 min-w-0 truncate">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={17} /></button>
          </div>
          <div className={fill ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "overflow-y-auto flex-1 min-h-0"}>{children}</div>
          {footer && (
            <div className="flex items-center gap-2 px-5 py-3.5 border-t flex-none" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ user, size = 28, ring }: { user?: User; size?: number; ring?: boolean }) {
  if (!user) return <span className="rounded-full inline-block" style={{ width: size, height: size, background: "var(--line2)" }} />;
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white flex-none select-none"
      style={{
        width: size, height: size, background: user.color, fontSize: size * 0.36,
        boxShadow: ring ? `0 0 0 2px var(--panel), 0 0 0 3.5px ${user.color}55` : undefined,
      }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarPicker({ value, onChange, users }: { value: string; onChange: (id: string) => void; users: User[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = users.find((u) => u.id === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border transition-colors cursor-pointer"
        style={{ borderColor: open ? "var(--brand)" : "var(--line2)", background: open ? "var(--panel2)" : "var(--panel)" }}
        title="Ответственный"
      >
        <Avatar user={cur} size={22} />
        <Icon name="chevD" size={13} className="text-[var(--muted)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 card p-1.5 w-52 anim-pop" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="label px-2 !mb-1.5">Ответственный</div>
          {users.map((u) => (
            <button key={u.id} onClick={() => { onChange(u.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg row-hover text-left">
              <Avatar user={u} size={24} />
              <span className="text-[13px] font-semibold flex-1 truncate">{u.name}</span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>{u.role}</span>
              {u.id === value && <Icon name="check" size={14} className="text-[var(--brand)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- misc ---------- */
export function Seg({ options, value, onChange }: { options: { v: string; t: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

export function Progress({ value, color = "var(--brand)", h = 6, track }: { value: number; color?: string; h?: number; track?: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: h, background: track ?? "var(--line)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Scale({ total, paid }: { total: number; paid: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden flex" style={{ height: 8, background: "var(--line)" }}>
      <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "var(--green)" }} />
      <div className="h-full transition-all duration-500" style={{ width: `${100 - pct}%`, background: pct >= 100 ? "transparent" : "repeating-linear-gradient(45deg, var(--amber-soft), var(--amber-soft) 4px, transparent 4px, transparent 8px)" }} />
    </div>
  );
}

/* ---------- двойная шкала: оплаты + расходы ---------- */
export function PayExpScale({ total, paid, expense }: { total: number; paid: number; expense: number }) {
  const overrun = expense > paid && expense > 0;
  const pw = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const ew = total > 0 ? Math.min(100, (expense / total) * 100) : 0;
  return (
    <div className="rounded-xl border p-3.5 transition-colors duration-300"
      style={{
        borderColor: overrun ? "color-mix(in srgb, var(--red) 50%, var(--line))" : "var(--line)",
        background: overrun ? "color-mix(in srgb, var(--red) 8%, var(--panel2))" : "var(--panel2)",
      }}>
      <div className="flex items-center justify-between mb-2 text-[12px] font-bold">
        <span className="flex items-center gap-1.5" style={{ color: overrun ? "var(--red)" : "var(--muted)" }}>
          Оплата по сделке {overrun && <Icon name="alert" size={13} />}
        </span>
        {total > 0 ? (
          <span><span style={{ color: "var(--green)" }}>{money(paid)}</span> <span style={{ color: "var(--faint)" }}>/ {money(total)}</span></span>
        ) : (
          <span style={{ color: "var(--faint)" }}>сделка не привязана</span>
        )}
      </div>
      <div className="relative h-[11px] rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
        {/* более короткая шкала всегда сверху — чтобы были видны обе */}
        {expense < paid ? (
          <>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${pw}%`, background: "var(--green)" }} />
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 z-10"
              style={{ width: `${ew}%`, background: "color-mix(in srgb, var(--red) 70%, transparent)" }} />
          </>
        ) : (
          <>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${ew}%`, background: "color-mix(in srgb, var(--red) 70%, transparent)" }} />
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 z-10"
              style={{ width: `${pw}%`, background: "var(--green)" }} />
          </>
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10.5px] font-bold flex-wrap">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--green)" }} /> Оплачено {money(paid)}</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--red)" }} /> Расходы {money(expense)}</span>
        {overrun && (
          <span className="ml-auto chip" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            <Icon name="alert" size={11} /> расходы выше оплат на {money(expense - paid)}
          </span>
        )}
      </div>
    </div>
  );
}

export function ToneChip({ tone, children }: { tone: "red" | "amber" | "blue" | "green" | "muted"; children: React.ReactNode }) {
  const map = {
    red: ["var(--red-soft)", "var(--red)"],
    amber: ["var(--amber-soft)", "var(--amber)"],
    blue: ["var(--blue-soft)", "var(--blue)"],
    green: ["var(--green-soft)", "var(--green)"],
    muted: ["var(--panel2)", "var(--muted)"],
  } as const;
  return <span className="chip" style={{ background: map[tone][0], color: map[tone][1] }}>{children}</span>;
}

export function Empty({ icon, text, action }: { icon: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center" style={{ border: "1.5px dashed var(--line2)", borderRadius: 12 }}>
      <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--panel2)", color: "var(--faint)" }}>
        <Icon name={icon} size={22} />
      </span>
      <div className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>{text}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ---------- toasts ---------- */
export function ToastHost() {
  const toasts = useCRM((s) => s.toasts);
  const drop = useCRM((s) => s.dropToast);
  const iconMap = { check: "check", bell: "bell", alert: "alert", ruble: "ruble" } as const;
  return (
    /* тосты сдвинуты выше, чтобы не перекрывать кнопку ИИ-ассистента в правом нижнем углу */
    <div className="fixed bottom-[92px] right-5 z-[90] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id} className="anim-toast flex items-center gap-3 pl-3.5 pr-2 py-2.5 rounded-xl max-w-[360px]"
          style={{ background: "var(--sidebar)", color: "#e9efe9", boxShadow: "var(--shadow-lg)" }}>
          <span className="w-6 h-6 rounded-md flex items-center justify-center flex-none" style={{ background: "rgba(43,161,132,0.25)", color: "#5fd0b2" }}>
            <Icon name={iconMap[t.icon ?? "check"]} size={14} />
          </span>
          <span className="text-[13px] font-semibold leading-snug flex-1">{t.text}</span>
          <button className="icon-btn !w-7 !h-7" style={{ color: "#8fa095" }} onClick={() => drop(t.id)}><Icon name="x" size={13} /></button>
        </div>
      ))}
    </div>
  );
}

/* ---------- click outside hook ---------- */
export function useClickOutside(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [cb]);
  return ref;
}
