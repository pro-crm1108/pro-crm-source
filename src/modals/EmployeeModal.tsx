import React, { useMemo, useState } from "react";
import { Modal, Avatar } from "../components/ui";
import { Icon } from "../components/icons";
import { useCRM, useCan, usePermScope } from "../store";
import { PERMS, SCOPE_LABEL, SCOPE_SHORT, FULL_ACCESS, effectiveScope } from "../lib/perms";
import type { PermScope } from "../types";

/* Карточка сотрудника: ФИО, должность, телефон, права. Права можно точечно переопределить. */
export function EmployeeModal({ id }: { id: string }) {
  const { users, roles, updateUser, toast, closeModal, currentUserId } = useCRM();
  const can = useCan();
  const scope = usePermScope();
  const user = users.find((u) => u.id === id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roleName, setRoleName] = useState(user?.role ?? "");
  const [draftOverrides, setDraftOverrides] = useState<Record<string, PermScope>>({ ...(user?.overrides ?? {}) });

  const groups = useMemo(() => {
    const g: Record<string, typeof PERMS> = {};
    PERMS.forEach((p) => { (g[p.group] = g[p.group] ?? []).push(p); });
    return g;
  }, []);

  if (!user) return null;

  /* защита: чужую карточку открыть можно только при соответствующей области действия права */
  const isSelf = user.id === currentUserId;
  const viewCardScope = scope("staff.viewCard");
  const canOpenThis = viewCardScope === "granted" || (viewCardScope === "own" && isSelf);
  if (!canOpenThis) return null;

  const role = roles.find((r) => r.name === user.role);
  const isFull = role?.permissions[FULL_ACCESS] === "granted" || user.overrides?.[FULL_ACCESS] === "granted";
  const canEditPerms = can("settings.staffCard") || can("roles.assign");
  /* редактирование профиля — с учётом «только свои» */
  const editScope = scope("staff.edit");
  const canEditProfile = editScope === "granted" || (editScope === "own" && isSelf) || can("settings.staffCard");
  /* смена должности — и нельзя повысить/понизить самого себя без права назначения ролей */
  const canChangeRole = (can("staff.changeRole") || can("roles.assign")) && (!isSelf || can("roles.assign"));

  /* эффективная область действия права (должность + личные переопределения) */
  const eff = (pid: string): PermScope =>
    effectiveScope(pid, role?.permissions, editing ? draftOverrides : user.overrides, isFull);

  const cycle = (pid: string, hasOwn: boolean) => {
    const cur = eff(pid);
    const next: PermScope = cur === "denied" ? "granted" : cur === "granted" ? (hasOwn ? "own" : "denied") : "denied";
    setDraftOverrides((o) => ({ ...o, [pid]: next }));
  };

  const save = async () => {
    if (!name.trim()) { toast("Укажите ФИО сотрудника", "alert"); return; }
    /* оставляем в overrides только те права, что отличаются от должностных */
    const clean: Record<string, PermScope> = {};
    for (const [k, v] of Object.entries(draftOverrides)) {
      const roleVal: PermScope = role?.permissions[k] ?? "denied";
      if (v !== roleVal) clean[k] = v;
    }
    try {
      /* updateUser сам подтверждает запись в базе до обновления экрана */
      await updateUser({ ...user, name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, role: roleName, overrides: clean });
      toast(`Карточка сотрудника «${name.trim()}» сохранена`, "bell");
      setEditing(false);
    } catch (e: any) {
      /* база не приняла — экран не менялся, объясняем почему */
      toast(`Не удалось сохранить в базе: ${e?.message ?? e}`, "alert");
    }
  };

  const overriddenCount = Object.entries(draftOverrides).filter(([k, v]) => (role?.permissions[k] ?? "denied") !== v).length;

  return (
    <Modal onClose={closeModal} width={620} icon="user"
      title={editing ? "Редактирование сотрудника" : "Карточка сотрудника"}
      footer={<>
        {can("staff.block") && user.id !== currentUserId && (
          <button className="btn btn-danger" onClick={async () => {
            try {
              await updateUser({ ...user, blocked: !user.blocked });
              toast(user.blocked ? `«${user.name}» разблокирован` : `«${user.name}» заблокирован — вход в CRM запрещён`, "bell");
            } catch (e: any) {
              toast(`Не удалось сохранить в базе: ${e?.message ?? e}`, "alert");
            }
          }}>
            <Icon name="alert" size={14} /> {user.blocked ? "Разблокировать" : "Заблокировать"}
          </button>
        )}
        <div className="flex-1" />
        {editing ? (
          <>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setDraftOverrides({ ...(user.overrides ?? {}) }); setName(user.name); setPhone(user.phone ?? ""); setEmail(user.email ?? ""); setRoleName(user.role); }}>Отмена</button>
            <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> Сохранить</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => setEditing(true)} disabled={!canEditProfile && !canEditPerms}>
            <Icon name="pencil" size={14} /> Редактировать
          </button>
        )}
      </>}>

      <div className="p-5 space-y-4">
        {/* шапка */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl" style={{ background: "var(--panel2)" }}>
          <Avatar user={user} size={52} ring />
          <div className="flex-1 min-w-0">
            {editing ? (
              <input className="input font-bold !text-[15px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО" />
            ) : (
              <div className="text-[16px] font-extrabold truncate">{user.name}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {editing && canChangeRole ? (
                <select className="select !w-auto !py-1 !text-[12px] font-bold" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : (
                <span className="chip" style={{ background: `${role?.color ?? "#888"}22`, color: role?.color ?? "var(--muted)" }}>{user.role}</span>
              )}
              {isFull && <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Icon name="shield" size={11} /> полный доступ</span>}
              {user.blocked && <span className="chip" style={{ background: "var(--red-soft)", color: "var(--red)" }}>заблокирован</span>}
            </div>
          </div>
        </div>

        {/* контакты */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="label flex items-center gap-1.5"><Icon name="phone" size={12} /> Телефон</label>
            {editing ? (
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
            ) : (
              <div className="text-[13.5px] font-bold py-2">{user.phone || <span style={{ color: "var(--faint)" }}>не указан</span>}</div>
            )}
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Icon name="mail" size={12} /> Email</label>
            {editing ? (
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@brigada.ru" />
            ) : (
              <div className="text-[13.5px] font-bold py-2 truncate">{user.email || <span style={{ color: "var(--faint)" }}>не указан</span>}</div>
            )}
          </div>
        </div>

        {/* права */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="label !mb-0 flex items-center gap-1.5"><Icon name="shield" size={13} /> Назначение прав</span>
            {overriddenCount > 0 && (
              <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                личных исключений: {overriddenCount}
              </span>
            )}
          </div>
          <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: "var(--faint)" }}>
            Базовые права даёт должность «{role?.name ?? "—"}». Здесь можно точечно разрешить или запретить конкретное право именно этому сотруднику.
          </p>

          <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3">
            {Object.entries(groups).map(([group, perms]) => (
              <div key={group}>
                <div className="text-[10px] font-extrabold tracking-[0.12em] uppercase mb-1" style={{ color: "var(--faint)" }}>{group}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {perms.map((p) => {
                    const scope = eff(p.id);
                    const isOverride = (user.overrides?.[p.id] ?? (editing ? draftOverrides[p.id] : undefined)) !== undefined
                      && (editing ? draftOverrides[p.id] : user.overrides?.[p.id]) !== (role?.permissions[p.id] ?? "denied");
                    const color = scope === "granted" ? "var(--green)" : scope === "own" ? "var(--amber)" : undefined;
                    const interactive = editing && canEditPerms && !isFull;
                    return (
                      <button key={p.id} disabled={!interactive} onClick={() => cycle(p.id, !!p.scope)}
                        className={`w-full flex items-center gap-2 py-1.5 text-left ${interactive ? "cursor-pointer" : "cursor-default"}`}
                        title={SCOPE_LABEL[scope]}>
                        <span className="w-[16px] h-[16px] rounded-[4px] border-2 flex-none flex items-center justify-center transition-all relative"
                          style={{ borderColor: color ?? "var(--line2)", background: color ?? "transparent" }}>
                          {scope === "granted" && <Icon name="check" size={10} sw={3.4} className="text-white" />}
                          {scope === "own" && <Icon name="user" size={10} sw={2.8} className="text-white" />}
                          {isOverride && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--amber)" }} />}
                        </span>
                        <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: scope === "denied" ? "var(--muted)" : "var(--ink)" }}>{p.label}</span>
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wide flex-none" style={{ color: scope === "denied" ? "var(--faint)" : color }}>
                          {SCOPE_SHORT[scope]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
