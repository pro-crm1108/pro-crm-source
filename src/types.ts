export type Role = "Директор" | "Менеджер" | "Прораб" | "Закупщик";

/* Область действия права */
export type PermScope = "denied" | "granted" | "own";

export interface User {
  id: string;
  name: string;
  role: string; // название должности (из справочника roles)
  color: string;
  phone?: string;
  email?: string;
  blocked?: boolean;
  overrides?: Record<string, PermScope>; // личные права поверх должности
}

/* Должность: набор прав с областью действия, настраивается Директором */
export interface RoleDef {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  permissions: Record<string, PermScope>; // permId → denied | granted | own
}

/* Приглашение сотрудника: ссылка с токеном */
export interface Invite {
  id: string;
  name?: string; // имя будущего сотрудника
  email: string;
  role: string; // название должности
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface Client {
  id: string;
  name: string; // ФИО или название
  kind: "fiz" | "yur";
  phone: string;
  email: string;
  company?: string; // для юр. лиц — контактное лицо / для физ — фирма
  comment: string;
  createdAt: string;
}

export interface Stage {
  id: string;
  title: string;
  color: string;
}

export interface DealItem {
  productId: string;      // "custom" — позиция вписана вручную (услуга, ремонт и т.п.)
  qty: number;
  price: number;
  purchasePrice?: number; // закупочная цена на момент бронирования
  paid?: boolean;         // оплачено и списано со склада
  name?: string;          // для ручных позиций
  unit?: string;          // для ручных позиций
  confirmedQty?: number;  // количество, подтверждённое кнопкой «Сохранить заказ» (по нему идут уведомления закупщику)
}

/* Запись в истории сделки */
export interface DealLogEntry {
  id: string;
  t: string;
  icon: string;
  text: string;
  sub?: string;
  tone?: string;
}

export interface Deal {
  id: string;
  title: string;
  clientId: string;
  stageId: string;
  type: "Товар" | "Услуга" | "Комплекс";
  comment: string;
  estimate: number;
  source: string;
  date: string; // дата сделки
  ownerId: string;
  items: DealItem[];
  objectId?: string;
  log?: DealLogEntry[];
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;            // цена продажи
  kind: "товар" | "услуга";
  photo?: string;           // фото (dataURL), по желанию
  purchasePrice?: number;   // цена закупки
  stock?: number;           // кол-во на складе (для товаров)
  lastSupplyPrice?: number; // закупочная цена последней поставки
}

/* Позиция поставки */
export interface SupplyItem {
  productId: string;
  qty: number;
  price: number; // цена закупки в этой поставке
}

/* Поставка товаров на склад */
export interface Supply {
  id: string;
  items: SupplyItem[];
  date: string;
  note?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  due: string;
  done: boolean;
  assigneeId: string;
  dealId?: string;
  clientId?: string;
  createdAt: string;
  overdueNotified?: boolean; // по этой задаче уже рассылали уведомление о просрочке
}

/* Уведомление, доставляемое в аккаунт сотрудника */
export interface Notification {
  id: string;
  userId: string; // получатель
  type: "task" | "overdue" | "payment" | "system" | "booking";
  title: string;
  text?: string;
  dealId?: string;
  taskId?: string;
  read: boolean;
  createdAt: string;
}

/* Конфигурация ИИ-ассистента (маска — без самого ключа, он живёт только в базе) */
export interface AiConfig {
  provider: string;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  keyHint: string; // «••••abcd»
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  at: string;
}

export interface WorkObject {
  id: string;
  title: string;
  address: string;
  kind: string;
  area: string;
  clientId?: string;
  dealId?: string;
  status: string;
  comment: string;
  startDate?: string;
  endDate?: string;
}

export type JobStage = "plan" | "work" | "check" | "done";

export interface Job {
  id: string;
  title: string;
  objectId: string;
  stage: JobStage;
  deadline: string;
  assigneeId: string;
  comment: string;
}

export interface Payment {
  id: string;
  kind: "income" | "expense";
  amount: number;
  date: string;
  method: string;
  dealId?: string;
  clientId?: string;
  category?: string;
  note: string;
}

export interface Toast {
  id: number;
  text: string;
  icon?: "check" | "bell" | "alert" | "ruble";
}

export type ModalState =
  | { type: "create-menu" }
  | { type: "employee"; id: string }
  | { type: "product"; id?: string }
  | { type: "supply" }
  | { type: "booking"; dealId: string; productId: string }
  | { type: "client"; id?: string }
  | { type: "deal"; id?: string; stageId?: string }
  | { type: "task"; id?: string }
  | { type: "object"; id?: string; dealId?: string }
  | { type: "job"; id?: string; objectId?: string }
  | { type: "payment"; kind?: "income" | "expense"; dealId?: string; clientId?: string; payId?: string }
  | null;

export type Page =
  | "home" | "sales" | "clients" | "objects" | "jobs"
  | "tasks" | "products" | "finance" | "settings";
