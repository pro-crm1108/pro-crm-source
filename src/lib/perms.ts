import type { RoleDef, PermScope } from "../types";

/* =====================================================================
   МОДЕЛЬ ПРАВ
   Каждое право имеет область действия (scope):
     "denied"  — запрещено
     "granted" — разрешено (всё)
     "own"     — только свои (объекты, где пользователь — владелец/исполнитель)
   ===================================================================== */
export type { PermScope };

export interface PermDef {
  group: string;
  id: string;
  label: string;
  /* true, если для права имеет смысл вариант «Только свои» */
  scope?: boolean;
}

/* Подписи состояний для интерфейса */
export const SCOPE_LABEL: Record<PermScope, string> = {
  denied: "Запрещено",
  granted: "Разрешено",
  own: "Только свои",
};
export const SCOPE_SHORT: Record<PermScope, string> = {
  denied: "Нет",
  granted: "Да",
  own: "Свои",
};

/* =====================================================================
   СПРАВОЧНИК СИСТЕМНЫХ РАЗРЕШЕНИЙ
   ===================================================================== */
export const PERMS: PermDef[] = [
  /* 1. Сотрудники */
  { group: "Сотрудники", id: "staff.view", label: "Просмотр сотрудников" },
  { group: "Сотрудники", id: "staff.viewCard", label: "Просмотр карточки сотрудника", scope: true },
  { group: "Сотрудники", id: "staff.create", label: "Создание сотрудника" },
  { group: "Сотрудники", id: "staff.invite", label: "Приглашение сотрудника" },
  { group: "Сотрудники", id: "staff.edit", label: "Редактирование сотрудника", scope: true },
  { group: "Сотрудники", id: "staff.changeRole", label: "Изменение должности" },
  { group: "Сотрудники", id: "staff.block", label: "Блокировка сотрудника" },
  { group: "Сотрудники", id: "staff.fire", label: "Увольнение сотрудника" },

  /* 2. Должности и роли */
  { group: "Должности и роли", id: "roles.create", label: "Создание должности" },
  { group: "Должности и роли", id: "roles.edit", label: "Редактирование должности" },
  { group: "Должности и роли", id: "roles.assign", label: "Назначение роли пользователю" },

  /* 3. Клиенты */
  { group: "Клиенты", id: "clients.view", label: "Просмотр раздела «Клиенты»", scope: true },
  { group: "Клиенты", id: "clients.viewCard", label: "Просмотр карточки клиента", scope: true },
  { group: "Клиенты", id: "clients.create", label: "Создание клиента" },
  { group: "Клиенты", id: "clients.edit", label: "Редактирование клиента", scope: true },

  /* 4. Сделки */
  { group: "Сделки", id: "deals.viewCard", label: "Просмотр карточки сделки", scope: true },
  { group: "Сделки", id: "deals.create", label: "Создание сделки" },
  { group: "Сделки", id: "deals.edit", label: "Редактирование сделки", scope: true },
  { group: "Сделки", id: "deals.stages", label: "Редактирование и добавление этапов сделки (воронки)" },
  { group: "Сделки", id: "deals.assignee", label: "Изменение ответственного" },
  { group: "Сделки", id: "deals.participants", label: "Назначение участников сделки" },

  /* 5. Задачи */
  { group: "Задачи", id: "tasks.view", label: "Просмотр задач", scope: true },
  { group: "Задачи", id: "tasks.create", label: "Создание задач" },
  { group: "Задачи", id: "tasks.edit", label: "Редактирование задач", scope: true },
  { group: "Задачи", id: "tasks.viewOthers", label: "Просмотр чужих задач" },
  { group: "Задачи", id: "tasks.comment", label: "Добавление комментариев" },

  /* 6. Объекты */
  { group: "Объекты", id: "objects.view", label: "Просмотр проектов", scope: true },
  { group: "Объекты", id: "objects.create", label: "Создание проекта" },
  { group: "Объекты", id: "objects.edit", label: "Редактирование проекта", scope: true },
  { group: "Объекты", id: "objects.works", label: "Создание этапов (работы)" },
  { group: "Объекты", id: "objects.budget", label: "Изменение бюджета проекта" },

  /* 7. Финансы */
  { group: "Финансы", id: "finance.view", label: "Просмотр финансов", scope: true },
  { group: "Финансы", id: "finance.create", label: "Создание дохода / расхода" },
  { group: "Финансы", id: "finance.edit", label: "Редактирование дохода / расхода" },

  /* 8. Склад и товары */
  { group: "Склад", id: "products.view", label: "Просмотр склада и товаров" },
  { group: "Склад", id: "products.supply", label: "Создание поставки" },
  { group: "Склад", id: "products.edit", label: "Создание / редактирование товара" },

  /* 9. Настройки CRM */
  { group: "Настройки CRM", id: "settings.view", label: "Просмотр настроек CRM" },
  { group: "Настройки CRM", id: "settings.notifications", label: "Настройка уведомлений" },
  { group: "Настройки CRM", id: "settings.edit", label: "Редактирование настроек CRM" },
  { group: "Настройки CRM", id: "settings.staffCard", label: "Управление карточкой сотрудника" },
  { group: "Настройки CRM", id: "settings.invite", label: "Приглашение нового сотрудника" },
  { group: "Настройки CRM", id: "settings.permissions", label: "Редактирование разрешений / прав должностей" },
  { group: "Настройки CRM", id: "settings.full", label: "Полный доступ к CRM" },

  /* 10. ИИ-ассистент */
  { group: "ИИ-ассистент", id: "ai.use", label: "Использование ИИ-ассистента" },
  { group: "ИИ-ассистент", id: "ai.configure", label: "Настройка ИИ (провайдер, модель, ключ)" },
];

export const ALL_PERMS = PERMS.map((p) => p.id);

export const PERM_GROUPS: string[] = [...new Set(PERMS.map((p) => p.group))];

/* право «Полный доступ к CRM» — включает всё */
export const FULL_ACCESS = "settings.full";

/* =====================================================================
   КАКИЕ ПРАВА ОТКРЫВАЮТ РАЗДЕЛЫ МЕНЮ
   ===================================================================== */
export const PAGE_PERM: Record<string, string | null> = {
  home: null,
  sales: "deals.viewCard",
  clients: "clients.view",
  objects: "objects.view",
  jobs: "objects.view",
  tasks: "tasks.view",
  calendar: null,
  products: "products.view",
  finance: "finance.view",
  /* Настройки доступны каждой должности: Профиль, Источники лидов и Статусы объектов
     видны всем по умолчанию, а директорские блоки (роли, приглашения, опасная зона, ИИ)
     защищены отдельными правами внутри раздела. */
  settings: null,
  archive: "deals.viewCard",
};

/* какие права нужны для плиток меню «+ Создать» */
export const CREATE_PERM: Record<string, string> = {
  client: "clients.create",
  deal: "deals.create",
  task: "tasks.create",
  object: "objects.create",
  job: "objects.works",
  payment: "finance.create",
};

/* =====================================================================
   СИСТЕМНЫЕ ДОЛЖНОСТИ ПО УМОЛЧАНИЮ
   permissions: Record<permId, PermScope>
   ===================================================================== */
const granted = (ids: string[]): Record<string, PermScope> =>
  Object.fromEntries(ids.map((i) => [i, "granted" as PermScope]));

export const DEFAULT_ROLES: RoleDef[] = [
  {
    id: "role-director", name: "Директор", color: "#2ba184", isSystem: true,
    permissions: { ...granted(ALL_PERMS) },
  },
  {
    id: "role-manager", name: "Менеджер", color: "#c9862d", isSystem: true,
    permissions: granted([
      "clients.view", "clients.viewCard", "clients.create", "clients.edit",
      "deals.viewCard", "deals.create", "deals.edit", "deals.assignee", "deals.participants",
      "tasks.view", "tasks.create", "tasks.edit", "tasks.viewOthers", "tasks.comment",
      "objects.view",
      "products.view", "products.supply",
      "settings.view", "settings.notifications",
    ]),
  },
  {
    id: "role-foreman", name: "Прораб", color: "#4c7fb5", isSystem: true,
    permissions: {
      ...granted(["objects.view", "objects.edit", "objects.works", "tasks.view", "tasks.create", "tasks.comment", "staff.viewCard", "settings.notifications"]),
      "tasks.edit": "own",
      "deals.viewCard": "own",
      "tasks.viewOthers": "denied",
    },
  },
  {
    id: "role-buyer", name: "Закупщик", color: "#b5566e", isSystem: true,
    permissions: granted(["finance.view", "objects.view", "tasks.view", "clients.view", "products.view", "products.supply", "products.edit", "settings.notifications"]),
  },
];

export const ROLE_COLORS = ["#2ba184", "#c9862d", "#4c7fb5", "#b5566e", "#7d5bb5", "#3e8757", "#c94f42", "#39708f", "#a5631f", "#5d7d3e"];

/* =====================================================================
   ПОМОЩНИКИ РАЗРЕШЕНИЙ
   ===================================================================== */

/** Эффективное право пользователя с учётом «Полного доступа» */
export function effectiveScope(
  permId: string,
  rolePerms: Record<string, PermScope> | undefined,
  overrides: Record<string, PermScope> | undefined,
  isFullRole: boolean,
): PermScope {
  if (isFullRole) return "granted";
  if (overrides && permId in overrides) return overrides[permId];
  if (rolePerms && permId in rolePerms) return rolePerms[permId];
  return "denied";
}

export const isAllowed = (s: PermScope) => s !== "denied";

/* =====================================================================
   МИГРАЦИЯ со старой модели прав (массив id) на новую (Record<id, scope>)
   ===================================================================== */
const OLD_TO_NEW: Record<string, string[]> = {
  "sales.view": ["deals.viewCard"],
  "sales.edit": ["deals.create", "deals.edit"],
  "clients.view": ["clients.view"],
  "clients.edit": ["clients.create", "clients.edit"],
  "objects.view": ["objects.view"],
  "objects.edit": ["objects.create", "objects.edit", "objects.works"],
  "tasks.view": ["tasks.view"],
  "tasks.edit": ["tasks.create", "tasks.edit"],
  "finance.view": ["finance.view"],
  "finance.edit": ["finance.create", "finance.edit"],
  "products.view": ["products.view"],
  "settings.view": ["settings.view"],
  "roles.manage": ["roles.create", "roles.edit", "roles.assign", "settings.permissions", "staff.invite"],
};
const VALID_IDS = new Set(ALL_PERMS);

/** Приводит permissions к новой модели, отбрасывая неизвестные id */
export function normalizePerms(input: any): Record<string, PermScope> {
  if (!input) return {};
  if (Array.isArray(input)) {
    const out: Record<string, PermScope> = {};
    for (const id of input as string[]) {
      for (const nid of OLD_TO_NEW[id] ?? [id]) if (VALID_IDS.has(nid)) out[nid] = "granted";
    }
    return out;
  }
  const out: Record<string, PermScope> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (VALID_IDS.has(k) && (v === "denied" || v === "granted" || v === "own")) out[k] = v as PermScope;
  }
  return out;
}

/** Права, которые «досыпаются» системным ролям, если их там ещё нет (не затирая явных запретов) */
const STOCK_GRANTS: Record<string, string[]> = {
  "role-manager": ["products.view", "products.supply", "settings.notifications"],
  "role-foreman": ["settings.notifications"],
  "role-buyer": ["products.view", "products.supply", "products.edit", "settings.notifications"],
};

/** Нормализует весь список должностей (миграция + полный доступ Директору) */
export function normalizeRoles(roles: RoleDef[]): RoleDef[] {
  return (roles ?? []).map((r) => {
    const norm = { ...r, permissions: normalizePerms(r.permissions) };
    if (r.id === "role-director") norm.permissions = granted(ALL_PERMS);
    /* даём складские права системным ролям, если их ещё нет (не затирая явные запреты) */
    for (const pid of STOCK_GRANTS[r.id] ?? []) {
      if (!(pid in norm.permissions)) norm.permissions[pid] = "granted";
    }
    return norm;
  });
}
