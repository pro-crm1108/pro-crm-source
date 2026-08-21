import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User, Client, Stage, Deal, Product, Task, WorkObject, Job, Payment,
  Toast, ModalState, Page, Role, RoleDef, Invite, PermScope, Notification,
  Supply, DealItem, DealLogEntry,
} from "./types";
import { pushUpsert, pushDelete, pushSettings, pushProfile, pushProfileAwait, pushNotification, markNotificationReadRemote } from "./lib/sync";
import { DEFAULT_ROLES, FULL_ACCESS, effectiveScope, isAllowed, normalizeRoles } from "./lib/perms";

/* ---------------- helpers ---------------- */
let seq = 100;
export const uid = () => `id${Date.now().toString(36)}${(seq++).toString(36)}`;

const now = Date.now();
const D = 86400000;
export const iso = (ms: number) => new Date(ms).toISOString();
const day = (offset: number, h = 12, m = 0) => {
  const d = new Date(now + offset * D);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const money = (n: number) =>
  Math.round(n).toLocaleString("ru-RU") + " ₽";
export const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " млн ₽";
  if (a >= 10_000) return Math.round(n / 1000).toLocaleString("ru-RU") + " тыс ₽";
  return money(n);
};
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const dFmt = (s: string) => {
  const d = new Date(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const dtFmt = (s: string) => {
  const d = new Date(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const toLocal = (s: string) => {
  const d = new Date(s);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocal = (s: string) => (s ? new Date(s).toISOString() : new Date().toISOString());
export const startOfDay = (offset = 0) => {
  const d = new Date(now + offset * D);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const dueLabel = (s: string) => {
  const t = new Date(s).getTime();
  if (t < startOfDay()) {
    const days = Math.max(1, Math.ceil((startOfDay() - t) / D));
    return { text: `Просрочено ${days} дн. назад`, tone: "red" as const, overdue: true };
  }
  if (t < startOfDay(1)) return { text: `Сегодня · ${new Date(s).getHours()}:${String(new Date(s).getMinutes()).padStart(2, "0")}`, tone: "amber" as const, overdue: false };
  if (t < startOfDay(2)) return { text: `Завтра · ${new Date(s).getHours()}:${String(new Date(s).getMinutes()).padStart(2, "0")}`, tone: "blue" as const, overdue: false };
  return { text: dtFmt(s), tone: "muted" as const, overdue: false };
};
export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* ---------------- seed ---------------- */
const users: User[] = [
  { id: "u1", name: "Виталий Громов", role: "Директор", color: "#2ba184" },
  { id: "u2", name: "Марина Ковалёва", role: "Менеджер", color: "#c9862d" },
  { id: "u3", name: "Сергей Балабанов", role: "Прораб", color: "#4c7fb5" },
  { id: "u4", name: "Олег Данилов", role: "Закупщик", color: "#b5566e" },
];

const stages: Stage[] = [
  { id: "st1", title: "Новая заявка", color: "#4c7fb5" },
  { id: "st2", title: "Квалификация", color: "#2ba184" },
  { id: "st3", title: "Замер и смета", color: "#c9a227" },
  { id: "st4", title: "Предложение", color: "#d9782b" },
  { id: "st5", title: "Договор", color: "#b5566e" },
  { id: "st6", title: "Оплачено", color: "#3e8757" },
];

const products: Product[] = [
  { id: "p1", name: "Ламинат Quick-Step Impressive", unit: "м²", price: 1890, kind: "товар", purchasePrice: 1240, lastSupplyPrice: 1240, stock: 220 },
  { id: "p2", name: "Керамогранит Kerama Marazzi 60×60", unit: "м²", price: 1450, kind: "товар", purchasePrice: 980, lastSupplyPrice: 980, stock: 130 },
  { id: "p3", name: "Краска Tikkurila Euro Power 7 (9 л)", unit: "шт", price: 6400, kind: "товар", purchasePrice: 4700, lastSupplyPrice: 4700, stock: 14 },
  { id: "p4", name: "Смеситель Grohe Eurosmart", unit: "шт", price: 8900, kind: "товар", purchasePrice: 6100, lastSupplyPrice: 6100, stock: 6 },
  { id: "p5", name: "Унитаз-компакт Roca Victoria", unit: "шт", price: 12400, kind: "товар", purchasePrice: 8900, lastSupplyPrice: 8900, stock: 4 },
  { id: "p6", name: "Межкомнатная дверь Profil Doors", unit: "шт", price: 14800, kind: "товар", purchasePrice: 10300, lastSupplyPrice: 10300, stock: 11 },
  { id: "p7", name: "Электрика Schneider (комплект на квартиру)", unit: "компл", price: 21500, kind: "товар", purchasePrice: 15400, lastSupplyPrice: 15400, stock: 3 },
  { id: "p8", name: "Тротуарная плитка «Классико» 60 мм", unit: "шт", price: 95, kind: "товар", purchasePrice: 62, lastSupplyPrice: 62, stock: 1200 },
  { id: "p9", name: "Плиточный клей Ceresit CM 14 (25 кг)", unit: "меш", price: 620, kind: "товар", purchasePrice: 430, lastSupplyPrice: 430, stock: 40 },
  { id: "p10", name: "Гипсокартон Knauf 12,5 мм", unit: "лист", price: 540, kind: "товар", purchasePrice: 385, lastSupplyPrice: 385, stock: 90 },
  { id: "s1", name: "Демонтаж старой отделки", unit: "м²", price: 350, kind: "услуга" },
  { id: "s2", name: "Штукатурка механизированная", unit: "м²", price: 520, kind: "услуга" },
  { id: "s3", name: "Стяжка полусухая", unit: "м²", price: 640, kind: "услуга" },
  { id: "s4", name: "Укладка плитки", unit: "м²", price: 1350, kind: "услуга" },
  { id: "s5", name: "Монтаж электрики «под ключ»", unit: "точка", price: 950, kind: "услуга" },
  { id: "s6", name: "Сантехнические работы", unit: "точка", price: 1600, kind: "услуга" },
  { id: "s7", name: "Малярные работы (3 слоя)", unit: "м²", price: 480, kind: "услуга" },
  { id: "s8", name: "Монтаж потолков ГКЛ", unit: "м²", price: 900, kind: "услуга" },
  { id: "s9", name: "Поклейка обоев", unit: "м²", price: 420, kind: "услуга" },
  { id: "s10", name: "Укладка ламината", unit: "м²", price: 550, kind: "услуга" },
];

const clients: Client[] = [
  { id: "c1", name: "Анна Сергеева", kind: "fiz", phone: "+7 916 204-18-32", email: "anna.sergeeva@mail.ru", comment: "Ремонт двушки в ЖК «Скандинавия», важна скорость.", createdAt: iso(now - 26 * D) },
  { id: "c2", name: "ООО «Вектор Девелопмент»", kind: "yur", phone: "+7 495 120-44-10", email: "office@vector-dev.ru", company: "Ирина Лобова, руководитель проектов", comment: "Офис под ключ, договор с отсрочкой 14 дней.", createdAt: iso(now - 40 * D) },
  { id: "c3", name: "Дмитрий Коваль", kind: "fiz", phone: "+7 903 771-25-96", email: "d.koval@gmail.com", comment: "", createdAt: iso(now - 60 * D) },
  { id: "c4", name: "ООО «Ритейл Парк»", kind: "yur", phone: "+7 495 988-31-02", email: "tender@retailpark.ru", company: "Павел Смирнов, техдиректор", comment: "Сеть кофеен, возможен объём на 3 точки.", createdAt: iso(now - 15 * D) },
  { id: "c5", name: "Елена Марченко", kind: "fiz", phone: "+7 926 512-77-41", email: "elena.marchenko@yandex.ru", comment: "Замена 4 межкомнатных дверей.", createdAt: iso(now - 3 * D) },
  { id: "c6", name: "ТСЖ «Радуга»", kind: "yur", phone: "+7 499 340-18-77", email: "tsg-raduga@mail.ru", company: "Виктор Осипов, председатель", comment: "Электрика в местах общего пользования.", createdAt: iso(now - 20 * D) },
  { id: "c7", name: "Игорь Столяров", kind: "fiz", phone: "+7 915 388-90-14", email: "", comment: "Заявка с Авито: ремонт санузла.", createdAt: iso(now - 2 * D) },
];

const deals: Deal[] = [
  {
    id: "d2", title: "Ремонт квартиры под ключ", clientId: "c1", stageId: "st5", type: "Комплекс",
    comment: "Двушка 64 м², черновая → чистовая. Клиент живёт в другом городе, приёмка по видеосвязи.",
    estimate: 1_240_000, source: "Рекомендация", date: day(-12), ownerId: "u2", objectId: "o1", createdAt: iso(now - 26 * D),
    items: [
      { productId: "s2", qty: 64, price: 520 }, { productId: "s3", qty: 64, price: 640 },
      { productId: "s4", qty: 18, price: 1350 }, { productId: "s7", qty: 140, price: 480 },
      { productId: "s10", qty: 42, price: 550 }, { productId: "p1", qty: 42, price: 1890 },
      { productId: "p3", qty: 4, price: 6400 }, { productId: "p6", qty: 3, price: 14800 },
    ],
  },
  {
    id: "d3", title: "Отделка офиса 210 м²", clientId: "c2", stageId: "st4", type: "Комплекс",
    comment: "Open-space + 4 кабинета. КП отправлено, ждём согласование у их финдиректора.",
    estimate: 2_860_000, source: "Сайт", date: day(-8), ownerId: "u1", objectId: "o2", createdAt: iso(now - 18 * D),
    items: [
      { productId: "s2", qty: 210, price: 520 }, { productId: "s8", qty: 210, price: 900 },
      { productId: "s5", qty: 160, price: 950 }, { productId: "s7", qty: 420, price: 480 },
    ],
  },
  {
    id: "d4", title: "Ремонт зала кофейни «Зерно»", clientId: "c4", stageId: "st3", type: "Услуга",
    comment: "Косметика зала 48 м² + барная зона. Замер назначен.",
    estimate: 480_000, source: "Повторное обращение", date: day(-4), ownerId: "u2", objectId: "o3", createdAt: iso(now - 9 * D),
    items: [{ productId: "s1", qty: 48, price: 350 }, { productId: "s7", qty: 96, price: 480 }],
  },
  {
    id: "d5", title: "Инженерные сети коттеджа", clientId: "c3", stageId: "st3", type: "Комплекс",
    comment: "Электрика, сантехника, отопление. Пушкино, Луговая 8.",
    estimate: 940_000, source: "Рекомендация", date: day(-6), ownerId: "u3", objectId: "o4", createdAt: iso(now - 11 * D),
    items: [{ productId: "s5", qty: 140, price: 950 }, { productId: "s6", qty: 60, price: 1600 }],
  },
  {
    id: "d6", title: "Замена межкомнатных дверей", clientId: "c5", stageId: "st1", type: "Товар",
    comment: "4 двери Profil Doors с установкой.",
    estimate: 71_200, source: "Авито", date: day(-1), ownerId: "u2", createdAt: iso(now - 3 * D),
    items: [{ productId: "p6", qty: 4, price: 14800 }, { productId: "s9", qty: 0, price: 420 }],
  },
  {
    id: "d7", title: "Электрика МОП, 120 точек", clientId: "c6", stageId: "st5", type: "Услуга",
    comment: "Замена щитовой и освещения в подъездах 1–3.",
    estimate: 133_000, source: "Соцсети", date: day(-16), ownerId: "u3", createdAt: iso(now - 20 * D),
    items: [{ productId: "s5", qty: 120, price: 950 }, { productId: "p7", qty: 1, price: 21500 }],
  },
  {
    id: "d8", title: "Санузел под ключ", clientId: "c3", stageId: "st6", type: "Комплекс",
    comment: "Завершено, клиент доволен — просил передать контакты бригадира соседям.",
    estimate: 66_000, source: "Повторное обращение", date: day(-24), ownerId: "u2", createdAt: iso(now - 30 * D),
    items: [
      { productId: "s4", qty: 22, price: 1350 }, { productId: "s6", qty: 4, price: 1600 },
      { productId: "p4", qty: 1, price: 8900 }, { productId: "p5", qty: 1, price: 12400 },
    ],
  },
  {
    id: "d1", title: "Ремонт санузла — Столяров", clientId: "c7", stageId: "st2", type: "Услуга",
    comment: "Первичный звонок сделан, нужно выявить объём и бюджет.",
    estimate: 96_000, source: "Авито", date: day(0, 10), ownerId: "u2", createdAt: iso(now - 2 * D), items: [],
  },
];

const objects: WorkObject[] = [
  { id: "o1", title: "ЖК «Скандинавия», кв. 142", address: "Москва, Скандинавский б-р, 4к2", kind: "Квартира", area: "64 м²", clientId: "c1", dealId: "d2", status: "В работе", comment: "Доступ по будням 9:00–19:00, ключи у консьержа.", startDate: day(-24), endDate: day(36) },
  { id: "o2", title: "Офис «Вектор», Лесная 20", address: "Москва, ул. Лесная, 20с1", kind: "Офис", area: "210 м²", clientId: "c2", dealId: "d3", status: "Смета", comment: "Работы только в ночные смены по согласованию с УК.", startDate: day(-12), endDate: day(60) },
  { id: "o3", title: "Кофейня «Зерно»", address: "Москва, Пятницкая, 18", kind: "Коммерция", area: "48 м²", clientId: "c4", dealId: "d4", status: "Замер", comment: "Демонтаж начинать после согласования с арендодателем.", startDate: day(2), endDate: day(25) },
  { id: "o4", title: "Коттедж в Пушкино", address: "Пушкино, ул. Луговая, 8", kind: "Коттедж", area: "186 м²", clientId: "c3", dealId: "d5", status: "Проект", comment: "Газ заведён, котёл выбирает заказчик.", startDate: day(10), endDate: day(95) },
];

const tasks: Task[] = [
  { id: "t1", title: "Позвонить Анне — согласовать смету", note: "Акцент на разбивку платежей: 40/40/20.", due: day(0, 12, 30), done: false, assigneeId: "u2", dealId: "d2", createdAt: iso(now - 2 * D) },
  { id: "t2", title: "Отправить КП «Вектору» с вариантами", note: "Два варианта: эконом и стандарт.", due: day(0, 16, 0), done: false, assigneeId: "u1", dealId: "d3", createdAt: iso(now - 1 * D) },
  { id: "t3", title: "Замер кофейни «Зерно»", note: "Взять лазерный дальномер и фотофиксацию.", due: day(1, 11, 0), done: false, assigneeId: "u3", dealId: "d4", createdAt: iso(now - 1 * D) },
  { id: "t4", title: "Закупить плитку на Скандинавию", note: "Kerama Marazzi 60×60, 18 м² + 10% запас.", due: day(-1, 15, 0), done: false, assigneeId: "u4", dealId: "d2", createdAt: iso(now - 3 * D) },
  { id: "t5", title: "Подписать договор с ТСЖ «Радуга»", note: "Оригинал у председателя, забрать после 18:00.", due: day(-2, 13, 0), done: false, assigneeId: "u2", dealId: "d7", createdAt: iso(now - 4 * D) },
  { id: "t6", title: "Согласовать цвета краски с Еленой", note: "", due: day(2, 14, 0), done: false, assigneeId: "u2", clientId: "c5", createdAt: iso(now - 1 * D) },
  { id: "t7", title: "Выставить счёт на аванс — коттедж", note: "30% аванс на материалы.", due: day(0, 18, 0), done: false, assigneeId: "u1", dealId: "d5", createdAt: iso(now - 1 * D) },
  { id: "t8", title: "Приёмка электрики, ТСЖ «Радуга»", note: "С актом скрытых работ.", due: day(3, 12, 0), done: false, assigneeId: "u3", dealId: "d7", createdAt: iso(now - 2 * D) },
  { id: "t9", title: "Первичный звонок Столярову", note: "Выявить потребность: объём, сроки, бюджет.", due: day(0, 10, 30), done: true, assigneeId: "u2", dealId: "d1", createdAt: iso(now - 2 * D) },
  { id: "t10", title: "Заказать стяжку на объект «Вектор»", note: "", due: day(-1, 10, 0), done: false, assigneeId: "u4", dealId: "d3", createdAt: iso(now - 2 * D) },
];

const jobs: Job[] = [
  { id: "w1", title: "Штукатурка стен", objectId: "o1", stage: "work", deadline: day(2, 18), assigneeId: "u3", comment: "Слой до 30 мм, сетка в санузлах." },
  { id: "w2", title: "Укладка плитки в санузлах", objectId: "o1", stage: "plan", deadline: day(5, 18), assigneeId: "u3", comment: "" },
  { id: "w3", title: "Стяжка пола, 2-й этаж", objectId: "o2", stage: "work", deadline: day(-1, 18), assigneeId: "u3", comment: "Ждём доступ от УК." },
  { id: "w4", title: "Монтаж перегородок ГКЛ", objectId: "o2", stage: "check", deadline: day(1, 18), assigneeId: "u3", comment: "Проверить шумоизоляцию." },
  { id: "w5", title: "Электромонтаж, точки 1–40", objectId: "o2", stage: "work", deadline: day(4, 18), assigneeId: "u3", comment: "" },
  { id: "w6", title: "Демонтаж старой отделки", objectId: "o3", stage: "plan", deadline: day(3, 18), assigneeId: "u3", comment: "" },
  { id: "w7", title: "Вывоз строительного мусора", objectId: "o1", stage: "done", deadline: day(-3, 18), assigneeId: "u4", comment: "" },
  { id: "w8", title: "Гидроизоляция санузлов", objectId: "o1", stage: "check", deadline: day(0, 18), assigneeId: "u3", comment: "2 слоя, проклейка углов." },
  { id: "w9", title: "Монтаж котельной", objectId: "o4", stage: "plan", deadline: day(7, 18), assigneeId: "u3", comment: "После выбора котла заказчиком." },
];

const payments: Payment[] = [
  { id: "pm1", kind: "income", amount: 250_000, date: day(-20), method: "Перевод на р/с", dealId: "d2", clientId: "c1", note: "Аванс 1/3 по договору" },
  { id: "pm2", kind: "income", amount: 300_000, date: day(-6), method: "Перевод на р/с", dealId: "d2", clientId: "c1", note: "Второй платёж — черновые работы" },
  { id: "pm3", kind: "income", amount: 150_000, date: day(-9), method: "Перевод на р/с", dealId: "d3", clientId: "c2", note: "Предоплата по счёту №34" },
  { id: "pm4", kind: "income", amount: 60_000, date: day(-4), method: "Карта", dealId: "d7", clientId: "c6", note: "Частичная оплата, 45%" },
  { id: "pm5", kind: "income", amount: 65_850, date: day(-3), method: "Наличные", dealId: "d8", clientId: "c3", note: "Финальный расчёт" },
  { id: "pm6", kind: "expense", amount: 184_300, date: day(-18), method: "Перевод поставщику", category: "Закупка материалов", dealId: "d2", clientId: "c1", note: "Ламинат, двери, краска — Скандинавия" },
  { id: "pm7", kind: "expense", amount: 210_000, date: day(-10), method: "Перевод на р/с", category: "Зарплата бригады", note: "Октябрь, 2-я часть" },
  { id: "pm8", kind: "expense", amount: 45_000, date: day(-8), method: "Перевод", category: "Аренда", note: "Склад + бытовка" },
  { id: "pm9", kind: "expense", amount: 36_900, date: day(-25), method: "Карта", category: "Инструмент", note: "Плиткорез, миксер" },
  { id: "pm10", kind: "expense", amount: 12_500, date: day(-5), method: "Наличные", category: "Логистика", note: "Доставка ГКЛ на Лесную" },
  { id: "pm11", kind: "expense", amount: 15_000, date: day(-6), method: "Перевод", category: "Вывоз мусора", dealId: "d2", clientId: "c1", note: "Скандинавия, 2 контейнера" },
  { id: "pm12", kind: "expense", amount: 20_000, date: day(-15), method: "Карта", category: "Реклама", note: "Авито + профильные площадки" },
  { id: "pm13", kind: "expense", amount: 8_400, date: day(-2), method: "Карта", category: "ГСМ", note: "" },
  { id: "pm14", kind: "expense", amount: 62_000, date: day(-2), method: "Перевод поставщику", category: "Закупка материалов", dealId: "d4", clientId: "c4", note: "Черновые материалы для «Зерно»" },
];

const supplies: Supply[] = [
  {
    id: "sup1",
    items: [
      { productId: "p1", qty: 100, price: 1240 },
      { productId: "p8", qty: 1200, price: 62 },
      { productId: "p9", qty: 40, price: 430 },
    ],
    date: day(-12), note: "Поставка от «СтройОпт» для объекта «Скандинавия»", createdAt: iso(now - 12 * D),
  },
  {
    id: "sup2",
    items: [
      { productId: "p6", qty: 10, price: 10300 },
      { productId: "p4", qty: 6, price: 6100 },
    ],
    date: day(-6), note: "Двери и сантехника, счёт №118", createdAt: iso(now - 6 * D),
  },
];

const EXPENSE_CATS = ["Закупка материалов", "Зарплата бригады", "Логистика", "Аренда", "Инструмент", "Вывоз мусора", "Реклама", "ГСМ", "Прочее"];

/* ---------------- store ---------------- */
interface CRMState {
  users: User[];
  currentUserId: string;
  loggedIn: boolean;
  theme: "light" | "dark";
  collapsed: boolean;
  page: Page;
  modal: ModalState[];
  toasts: Toast[];
  stages: Stage[];
  products: Product[];
  clients: Client[];
  deals: Deal[];
  tasks: Task[];
  objects: WorkObject[];
  jobs: Job[];
  payments: Payment[];
  supplies: Supply[];
  leadSources: string[];
  objectStatuses: string[];
  notifPrefs: Record<string, boolean>;
  rolePerms: Record<Role, Record<string, boolean>>;
  roles: RoleDef[];
  invites: Invite[];
  notifications: Notification[];

  /* облако */
  mode: "demo" | "cloud";
  cloudState: "idle" | "loading" | "ready" | "error";
  cloudUser: { id: string; email: string } | null;
  lastSyncError: string | null;
  setSyncError: (msg: string | null) => void;

  /* конфигурация ИИ-ассистента (без ключа — ключ хранится только в базе) */
  aiConfig: { provider: string; model: string; enabled: boolean; hasKey: boolean; keyHint: string } | null;
  setAiConfig: (c: { provider: string; model: string; enabled: boolean; hasKey: boolean; keyHint: string } | null) => void;

  setPage: (p: Page) => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  closeAllModals: () => void;
  replaceModal: (m: ModalState) => void;
  toast: (text: string, icon?: Toast["icon"]) => void;
  dropToast: (id: number) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleCollapsed: () => void;
  loginDemo: (userId: string) => void;
  logout: () => void;
  setCloudState: (s: CRMState["cloudState"]) => void;
  enterCloud: (profile: User, email: string) => void;
  leaveCloud: () => void;
  hydrate: (data: Record<string, any[]>, keepRefs?: boolean) => void;
  remoteApply: (table: string, action: string, row: any) => void;
  saveClient: (c: Client, isNew: boolean) => void;
  deleteClient: (id: string) => void;
  saveDeal: (d: Deal, isNew: boolean, opts?: { bookings?: boolean }) => void;
  deleteDeal: (id: string) => void;
  renameStage: (id: string, title: string) => void;
  addStage: (title: string, color: string) => void;
  deleteStage: (id: string) => void;
  moveDeal: (dealId: string, stageId: string) => void;
  saveTask: (t: Task, isNew: boolean) => void;
  deleteTask: (id: string) => void;
  saveObject: (o: WorkObject, isNew: boolean) => void;
  deleteObject: (id: string) => void;
  saveJob: (j: Job, isNew: boolean) => void;
  deleteJob: (id: string) => void;
  moveJob: (id: string, stage: Job["stage"]) => void;
  addPayment: (p: Payment) => void;
  updatePayment: (p: Payment) => void;
  deletePayment: (id: string) => void;

  /* склад */
  saveProduct: (p: Product, isNew: boolean) => void;
  deleteProduct: (id: string) => void;
  saveSupply: (s: Supply) => void;
  markDealItemsPaid: (dealId: string, productId?: string) => void;

  addSource: (s: string) => void;
  removeSource: (s: string) => void;
  addObjectStatus: (s: string) => void;
  removeObjectStatus: (s: string) => void;
  setNotifPref: (k: string, v: boolean) => void;
  setRolePerm: (r: Role, k: string, v: boolean) => void;
  updateUser: (u: User) => Promise<void>;

  /* должности и приглашения */
  saveRole: (r: RoleDef, isNew: boolean) => void;
  deleteRole: (id: string) => void;
  addInvite: (inv: Invite) => void;
  revokeInvite: (id: string) => void;
  markInviteUsed: (token: string) => void;

  /* уведомления */
  notify: (n: { id?: string; userId: string; type: Notification["type"]; title: string; text?: string; dealId?: string; taskId?: string }) => void;
  wipeLocal: () => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  checkOverdue: () => void;
}

let toastSeq = 1;

/* удаление дублей по id (страховка от задвоения справочников) */
const dedupeById = <T extends { id: string }>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return (arr ?? []).filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
};

/* облачные хелперы: пишут в Supabase только в командном режиме */
const isCloud = () => useCRM.getState().mode === "cloud";
const up = (table: any, row: any) => { if (isCloud()) pushUpsert(table, row); };
const del = (table: any, id: string) => { if (isCloud()) pushDelete(table, id); };
const syncSettings = () => {
  if (!isCloud()) return;
  const s = useCRM.getState();
  pushSettings({ leadSources: s.leadSources, objectStatuses: s.objectStatuses, notifPrefs: s.notifPrefs, rolePerms: s.rolePerms });
};

/* ---------------- склад: бронирование ---------------- */
/* сколько единиц товара сейчас забронировано (неоплаченные позиции во всех сделках) */
export const reservedQty = (deals: Deal[], productId: string): number =>
  deals.reduce((sum, d) => sum + d.items.filter((i) => i.productId === productId && !i.paid).reduce((a, i) => a + i.qty, 0), 0);

/* FIFO-распределение остатка между бронями одного товара: приоритет у более ранних заказов.
   Единая формула для плитки брони, карточки брони и уведомлений закупщику. */
export function allocateFifo(deals: Deal[], productId: string, stock: number): Map<string, { fromStock: number; toOrder: number }> {
  const bookings = deals
    .map((d) => ({
      dealId: d.id,
      createdAt: +new Date(d.createdAt),
      qty: d.items.filter((i) => i.productId === productId && !i.paid && i.qty > 0).reduce((a, i) => a + i.qty, 0),
    }))
    .filter((b) => b.qty > 0)
    .sort((a, b) => a.createdAt - b.createdAt || a.dealId.localeCompare(b.dealId));
  const res = new Map<string, { fromStock: number; toOrder: number }>();
  let remaining = Math.max(0, stock);
  for (const b of bookings) {
    const fromStock = Math.min(b.qty, remaining);
    remaining -= fromStock;
    res.set(b.dealId, { fromStock, toOrder: b.qty - fromStock });
  }
  return res;
}

/* сотрудники, которым нужно отправлять уведомления о бронях (у кого есть право «Создание поставки») */
const buyersToNotify = (s: CRMState): User[] =>
  s.users.filter((u) => {
    if (u.id === s.currentUserId || u.blocked) return false;
    const role = s.roles.find((r) => r.name === u.role);
    const isFull = role?.permissions[FULL_ACCESS] === "granted" || u.overrides?.[FULL_ACCESS] === "granted";
    return effectiveScope("products.supply", role?.permissions, u.overrides, isFull) !== "denied";
  });

export const useCRM = create<CRMState>()(
  persist(
    (set, get) => ({
      users,
      currentUserId: "u1",
      loggedIn: true,
      theme: "light",
      collapsed: false,
      page: "home",
      modal: [],
      toasts: [],
      stages,
      products,
      clients,
      deals,
      tasks,
      objects,
      jobs,
      payments,
      supplies,
      leadSources: ["Авито", "Рекомендация", "Сайт", "Соцсети", "Повторное обращение"],
      objectStatuses: ["Проект", "Замер", "Смета", "В работе", "Пауза", "Завершён"],
      notifPrefs: { overdue: true, newTask: true, payments: true, stage: false, sound: true, booking: true },
      rolePerms: {
        Директор: { fin: true, deals: true, clients: true, tasks: true, settings: true },
        Менеджер: { fin: false, deals: true, clients: true, tasks: true, settings: false },
        Прораб: { fin: false, deals: false, clients: false, tasks: true, settings: false },
        Закупщик: { fin: true, deals: false, clients: true, tasks: true, settings: false },
      },
      roles: DEFAULT_ROLES,
      invites: [],
      notifications: [],
      mode: "demo",
      cloudState: "idle",
      cloudUser: null,
      lastSyncError: null,
      aiConfig: null,

      setSyncError: (msg) => set({ lastSyncError: msg }),
      setAiConfig: (c) => set({ aiConfig: c }),
      setPage: (p) => set({ page: p, modal: [] }),
      openModal: (m) => set((s) => ({ modal: [...s.modal, m] })),
      closeModal: () => set((s) => ({ modal: s.modal.slice(0, -1) })),
      closeAllModals: () => set({ modal: [] }),
      replaceModal: (m) => set((s) => ({ modal: [...s.modal.slice(0, -1), m] })),
      toast: (text, icon = "check") => {
        const id = toastSeq++;
        set((s) => ({ toasts: [...s.toasts, { id, text, icon }] }));
        setTimeout(() => get().dropToast(id), 4200);
      },
      dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      setTheme: (t) => set({ theme: t }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      loginDemo: (userId) => set({ loggedIn: true, mode: "demo", currentUserId: userId, cloudState: "idle", cloudUser: null }),
      logout: () => set({ loggedIn: false, modal: [], mode: "demo", cloudState: "idle", cloudUser: null }),
      setCloudState: (cs) => set({ cloudState: cs }),
      enterCloud: (profile, email) =>
        set({ mode: "cloud", loggedIn: true, cloudState: "ready", currentUserId: profile.id, cloudUser: { id: profile.id, email } }),
      leaveCloud: () => set({ mode: "demo", cloudState: "idle", cloudUser: null, loggedIn: false, modal: [] }),

      /* загрузка данных из облака (каталог и воронку сохраняем, если в базе пусто) */
      hydrate: (data, keepRefs = true) =>
        set((s) => {
          const st = data.settings?.[0];
          return {
            /* облачные профили — приоритет; но текущего пользователя не теряем,
               даже если его записи вдруг нет в базе (чтобы экран не «осиротел») */
            users: data.profiles?.length
              ? dedupeById([...data.profiles, ...s.users.filter((u) => u.id === s.currentUserId)])
              : s.users,
            stages: data.stages?.length ? data.stages : s.stages,
            products: data.products?.length ? data.products : s.products,
            clients: data.clients ?? [],
            deals: data.deals ?? [],
            objects: data.objects ?? [],
            tasks: data.tasks ?? [],
            jobs: data.jobs ?? [],
            payments: data.payments ?? [],
            supplies: data.supplies ?? [],
            leadSources: st?.leadSources ?? s.leadSources,
            objectStatuses: st?.objectStatuses?.length ? st.objectStatuses : s.objectStatuses,
            notifPrefs: { ...s.notifPrefs, ...(st?.notifPrefs ?? {}) },
            rolePerms: st?.rolePerms ?? s.rolePerms,
            roles: normalizeRoles(dedupeById(data.roles?.length ? data.roles : s.roles)),
            invites: data.invites ?? [],
            notifications: data.notifications ?? [],
            ...(keepRefs ? {} : {}),
          } as any;
        }),

      /* живые обновления от других сотрудников */
      remoteApply: (table, action, row) => {
        if (!row || get().mode !== "cloud") return;
        if (table === "settings") {
          set((s) => ({
            leadSources: row.leadSources ?? s.leadSources,
            objectStatuses: row.objectStatuses ?? s.objectStatuses,
            notifPrefs: row.notifPrefs ?? s.notifPrefs,
            rolePerms: row.rolePerms ?? s.rolePerms,
          }));
          return;
        }
        const key = table === "profiles" ? "users" : table;
        set((s) => {
          const list = (s as any)[key] as any[];
          if (!list) return {};
          if (action === "DELETE") return { [key]: list.filter((x) => x.id !== row.id) } as any;
          const exists = list.some((x) => x.id === row.id);
          return { [key]: exists ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list] } as any;
        });
      },

      saveClient: (c, isNew) => {
        set((s) => ({ clients: isNew ? [c, ...s.clients] : s.clients.map((x) => (x.id === c.id ? c : x)) }));
        up("clients", c);
      },
      deleteClient: (id) => {
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
        del("clients", id);
      },

      saveDeal: (d, isNew, opts) => {
        const s0 = get();
        const old = isNew ? undefined : s0.deals.find((x) => x.id === d.id);
        /* идемпотентно: если сделка с таким id уже есть — заменяем, а не добавляем вторую.
           Это страхует от дублей при случайном двойном нажатии «Создать сделку». */
        set((s) => {
          const exists = s.deals.some((x) => x.id === d.id);
          return { deals: exists ? s.deals.map((x) => (x.id === d.id ? d : x)) : [d, ...s.deals] };
        });
        up("deals", d);

        /* Уведомления закупщикам — ТОЛЬКО при явном подтверждении заказа
           (кнопка «Сохранить заказ» / создание сделки), а не на каждый ввод.
           Сравниваем фактическое количество с «подтверждённым» (confirmedQty):
           позиции сохраняются сразу (автосохранение), но уведомление уходит
           лишь когда менеджер нажмёт «Сохранить заказ». */
        const shouldNotify = isNew || opts?.bookings === true;
        if (shouldNotify && get().notifPrefs.booking !== false) {
          const s1 = get();
          /* агрегируем по товару: несколько строк одного товара — одна бронь */
          const sumBy = (arr: DealItem[], key: "qty" | "confirmedQty") => {
            const m = new Map<string, number>();
            arr.forEach((i) => {
              if (!i.paid && i.productId !== "custom" && i.qty > 0) {
                const v = key === "qty" ? i.qty : (i.confirmedQty ?? 0);
                m.set(i.productId, (m.get(i.productId) ?? 0) + v);
              }
            });
            return m;
          };
          const after = sumBy(d.items, "qty");                 // фактические количества
          const before = sumBy(old?.items ?? [], "confirmedQty"); // ранее подтверждённые
          after.forEach((newQty, pid) => {
            const confirmed = before.get(pid) ?? 0;
            if (!(newQty > confirmed)) return;
            const prod = s1.products.find((p) => p.id === pid);
            if (!prod || prod.kind !== "товар") return;
            /* FIFO — те же цифры, что показываются на плитке и в карточке брони */
            const alloc = allocateFifo(s1.deals, pid, prod.stock ?? 0).get(d.id) ?? { fromStock: 0, toOrder: newQty };
            const text = alloc.toOrder > 0
              ? `${prod.name} — ${newQty} ${prod.unit}: ${alloc.fromStock} со склада, ${alloc.toOrder} — заказать у поставщика`
              : `${prod.name} — ${newQty} ${prod.unit} (со склада)`;
            buyersToNotify(s1).forEach((b) => {
              /* taskId несёт id товара — по клику на уведомление откроется именно эта бронь */
              get().notify({ userId: b.id, type: "booking", title: "Бронь товара", text, dealId: d.id, taskId: pid });
            });
          });
        }
      },
      deleteDeal: (id) => {
        set((s) => ({ deals: s.deals.filter((d) => d.id !== id) }));
        del("deals", id);
      },
      renameStage: (id, title) => {
        let st: Stage | undefined;
        set((s) => ({ stages: s.stages.map((x) => (x.id === id ? (st = { ...x, title }) : x)) }));
        if (st) up("stages", st);
      },
      addStage: (title, color) => {
        const st: Stage = { id: uid(), title, color };
        set((s) => ({ stages: [...s.stages, st] }));
        up("stages", st);
      },
      deleteStage: (id) => {
        const s0 = get();
        const first = s0.stages.find((x) => x.id !== id)?.id;
        if (!first) { get().toast("Нельзя удалить единственный столбец", "alert"); return; }
        set((s) => ({
          stages: s.stages.filter((x) => x.id !== id),
          deals: s.deals.map((d) => (d.stageId === id ? { ...d, stageId: first } : d)),
        }));
        const moved = useCRM.getState().deals.filter((d) => d.stageId === first);
        moved.forEach((d) => up("deals", d));
        del("stages", id);
      },
      moveDeal: (dealId, stageId) => {
        set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, stageId } : d)) }));
        const d = get().deals.find((x) => x.id === dealId);
        if (d) up("deals", d);
      },

      saveTask: (t, isNew) => {
        const prev = get().tasks.find((x) => x.id === t.id);
        /* если срок перенесли в будущее — разрешаем повторно уведомить о просрочке */
        const fixed = { ...t };
        if (+new Date(t.due) > Date.now() && prev?.overdueNotified) fixed.overdueNotified = false;
        set((s) => ({ tasks: isNew ? [...s.tasks, fixed] : s.tasks.map((x) => (x.id === fixed.id ? fixed : x)) }));
        up("tasks", fixed);
        /* уведомление о назначении задачи (только если назначили не себе) */
        const prefs = get().notifPrefs;
        if (prefs.newTask && fixed.assigneeId && fixed.assigneeId !== get().currentUserId) {
          const isNewAssign = isNew || (prev && prev.assigneeId !== fixed.assigneeId);
          if (isNewAssign) {
            get().notify({
              id: `task-${fixed.id}-${fixed.assigneeId}`,
              userId: fixed.assigneeId, type: "task",
              title: "Вам назначена задача", text: fixed.title,
              dealId: fixed.dealId, taskId: fixed.id,
            });
          }
        }
      },
      deleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        del("tasks", id);
      },

      saveObject: (o, isNew) => {
        set((s) => ({ objects: isNew ? [o, ...s.objects] : s.objects.map((x) => (x.id === o.id ? o : x)) }));
        up("objects", o);
      },
      deleteObject: (id) => {
        const gone = get().jobs.filter((j) => j.objectId === id);
        set((s) => ({
          objects: s.objects.filter((o) => o.id !== id),
          jobs: s.jobs.filter((j) => j.objectId !== id),
          deals: s.deals.map((d) => (d.objectId === id ? { ...d, objectId: undefined } : d)),
        }));
        gone.forEach((j) => del("jobs", j.id));
        get().deals.filter((d) => d.objectId === undefined).forEach((d) => up("deals", d));
        del("objects", id);
      },

      saveJob: (j, isNew) => {
        set((s) => ({ jobs: isNew ? [j, ...s.jobs] : s.jobs.map((x) => (x.id === j.id ? j : x)) }));
        up("jobs", j);
      },
      deleteJob: (id) => {
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
        del("jobs", id);
      },
      moveJob: (id, stage) => {
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, stage } : j)) }));
        const j = get().jobs.find((x) => x.id === id);
        if (j) up("jobs", j);
      },

      addPayment: (p) => {
        set((s) => ({ payments: [p, ...s.payments] }));
        up("payments", p);
      },
      updatePayment: (p) => {
        set((s) => ({ payments: s.payments.map((x) => (x.id === p.id ? p : x)) }));
        up("payments", p);
      },
      deletePayment: (id) => {
        set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }));
        del("payments", id);
      },

      /* ---------------- склад ---------------- */
      saveProduct: (p, isNew) => {
        set((s) => ({ products: isNew ? [...s.products, p] : s.products.map((x) => (x.id === p.id ? p : x)) }));
        up("products", p);
      },
      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
        del("products", id);
      },
      saveSupply: (sup) => {
        const s0 = get();
        const newProducts = s0.products.map((p) => {
          const lines = sup.items.filter((i) => i.productId === p.id);
          if (!lines.length) return p;
          const addQty = lines.reduce((a, i) => a + i.qty, 0);
          const lastPrice = lines[lines.length - 1].price;
          return { ...p, stock: (p.stock ?? 0) + addQty, purchasePrice: lastPrice, lastSupplyPrice: lastPrice };
        });
        set((s) => ({ supplies: [sup, ...s.supplies], products: newProducts }));
        up("supplies", sup);
        newProducts.forEach((p) => {
          const old = s0.products.find((x) => x.id === p.id);
          if (old && (old.stock !== p.stock || old.purchasePrice !== p.purchasePrice)) up("products", p);
        });
      },
      markDealItemsPaid: (dealId, productId) => {
        const s0 = get();
        const deal = s0.deals.find((d) => d.id === dealId);
        if (!deal) return;
        const toMark = deal.items.filter((i) => !i.paid && (!productId || i.productId === productId));
        if (!toMark.length) return;
        const nowIso = new Date().toISOString();
        const prodIds = [...new Set(toMark.map((i) => i.productId))];
        const entries: DealLogEntry[] = prodIds.map((pid) => {
          const prod = s0.products.find((p) => p.id === pid);
          const qty = toMark.filter((i) => i.productId === pid).reduce((a, i) => a + i.qty, 0);
          return { id: uid(), t: nowIso, icon: "box", text: `Оплачено и списано со склада: ${prod?.name ?? "товар"} — ${qty} ${prod?.unit ?? "шт"}`, tone: "var(--green)" };
        });
        const newProducts = s0.products.map((p) => {
          const qty = toMark.filter((i) => i.productId === p.id).reduce((a, i) => a + i.qty, 0);
          return qty > 0 ? { ...p, stock: Math.max(0, (p.stock ?? 0) - qty) } : p;
        });
        const newItems = deal.items.map((i) => (toMark.includes(i) ? { ...i, paid: true } : i));
        const newDeal = { ...deal, items: newItems, log: [...(deal.log ?? []), ...entries] };
        set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? newDeal : d)), products: newProducts }));
        up("deals", newDeal);
        newProducts.forEach((p) => {
          const old = s0.products.find((x) => x.id === p.id);
          if (old && old.stock !== p.stock) up("products", p);
        });
        get().toast("Оплачено: товар списан со склада", "ruble");
      },

      addSource: (src) => {
        set((s) => (s.leadSources.includes(src) ? s : { leadSources: [...s.leadSources, src] }));
        syncSettings();
      },
      removeSource: (src) => {
        set((s) => ({ leadSources: s.leadSources.filter((x) => x !== src) }));
        syncSettings();
      },
      addObjectStatus: (st) => {
        set((s) => (s.objectStatuses.includes(st) ? s : { objectStatuses: [...s.objectStatuses, st] }));
        syncSettings();
      },
      removeObjectStatus: (st) => {
        set((s) => ({ objectStatuses: s.objectStatuses.filter((x) => x !== st) }));
        syncSettings();
      },
      setNotifPref: (k, v) => {
        set((s) => ({ notifPrefs: { ...s.notifPrefs, [k]: v } }));
        syncSettings();
      },
      setRolePerm: (r, k, v) => {
        set((s) => ({ rolePerms: { ...s.rolePerms, [r]: { ...s.rolePerms[r], [k]: v } } }));
        syncSettings();
      },
      updateUser: async (u) => {
        /* ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — база.
           Сначала записываем в базу и ждём подтверждения; экран обновляется
           ТОЛЬКО после успеха. Если база отказала — экран не меняется,
           ошибка летит вызывающему. Рассинхрон «экран ≠ база» невозможен. */
        if (isCloud()) await pushProfileAwait(u); // бросает ошибку при отказе базы
        set((s) => ({ users: s.users.map((x) => (x.id === u.id ? u : x)) }));
      },

      /* должности */
      saveRole: (r, isNew) => {
        const prev = get().roles.find((x) => x.id === r.id);
        // идемпотентно: если должность с таким id уже есть — заменяем, а не дублируем
        set((s) => {
          const exists = s.roles.some((x) => x.id === r.id);
          return { roles: exists ? s.roles.map((x) => (x.id === r.id ? r : x)) : [...s.roles, r] };
        });
        up("roles", r);
        // переименование должности → обновляем всех сотрудников и активные приглашения со старым названием
        if (prev && prev.name !== r.name) {
          const renamedUsers = get().users.filter((u) => u.role === prev.name);
          renamedUsers.forEach((u) => {
            const nu = { ...u, role: r.name };
            set((s) => ({ users: s.users.map((x) => (x.id === u.id ? nu : x)) }));
            pushProfile(nu);
          });
          const renamedInv = get().invites.filter((i) => i.role === prev.name && !i.usedAt);
          renamedInv.forEach((i) => {
            const ni = { ...i, role: r.name };
            set((s) => ({ invites: s.invites.map((x) => (x.id === i.id ? ni : x)) }));
            up("invites", ni);
          });
        }
      },
      deleteRole: (id) => {
        const role = get().roles.find((r) => r.id === id);
        if (!role) return;
        const inUse = get().users.some((u) => u.role === role.name);
        if (inUse) { get().toast(`Нельзя удалить: должность «${role.name}» назначена сотруднику. Сначала переведите его на другую.`, "alert"); return; }
        set((s) => ({ roles: s.roles.filter((r) => r.id !== id) }));
        del("roles", id);
      },

      /* приглашения */
      addInvite: (inv) => {
        set((s) => ({ invites: [inv, ...s.invites] }));
        up("invites", inv);
      },
      revokeInvite: (id) => {
        set((s) => ({ invites: s.invites.filter((x) => x.id !== id) }));
        del("invites", id);
      },
      markInviteUsed: (token) => {
        set((s) => ({ invites: s.invites.map((x) => (x.token === token ? { ...x, usedAt: new Date().toISOString() } : x)) }));
      },

      /* ---------------- уведомления ---------------- */
      notify: (n) => {
        /* детерминированный id (если передан) защищает от дублей:
           два устройства, создающие одно и то же уведомление, дадут одинаковый id,
           и база (on conflict do nothing) сохранит только одну копию */
        const row: Notification = { read: false, createdAt: new Date().toISOString(), ...n, id: n.id ?? uid() };
        /* локальная дедупликация (в т.ч. от «эха» по realtime) */
        if (get().notifications.some((x) => x.id === row.id)) return;
        set((s) => ({ notifications: [row, ...s.notifications] }));
        pushNotification(row);
      },
      markNotifRead: (id) => {
        set((s) => ({ notifications: s.notifications.map((x) => (x.id === id && !x.read ? { ...x, read: true } : x)) }));
        if (isCloud()) markNotificationReadRemote(id);
      },
      markAllNotifsRead: () => {
        const me = get().currentUserId;
        const mine = get().notifications.filter((x) => x.userId === me && !x.read);
        set((s) => ({ notifications: s.notifications.map((x) => (x.userId === me && !x.read ? { ...x, read: true } : x)) }));
        if (isCloud()) mine.forEach((x) => markNotificationReadRemote(x.id));
      },

      /* фоновая проверка просроченных задач → уведомление исполнителю и директору */
      checkOverdue: () => {
        const s = get();
        if (!s.loggedIn || !s.notifPrefs.overdue) return;
        const nowT = Date.now();
        const directorName = s.roles.find((r) => r.id === "role-director")?.name ?? "Директор";
        const already = (taskId: string, userId: string) =>
          s.notifications.some((x) => x.type === "overdue" && x.taskId === taskId && x.userId === userId);
        s.tasks.forEach((t) => {
          if (t.done || t.overdueNotified) return;
          if (+new Date(t.due) >= nowT) return;
          const assignee = s.users.find((u) => u.id === t.assigneeId);
          const directors = s.users.filter((u) => u.role === directorName && u.id !== t.assigneeId);
          if (assignee && !already(t.id, assignee.id)) {
            get().notify({
              id: `ovd-${t.id}-${assignee.id}`,
              userId: assignee.id, type: "overdue",
              title: "Задача просрочена", text: t.title,
              dealId: t.dealId, taskId: t.id,
            });
          }
          directors.forEach((dir) => {
            if (already(t.id, dir.id)) return;
            get().notify({
              id: `ovd-${t.id}-${dir.id}`,
              userId: dir.id, type: "overdue",
              title: "Просрочена задача сотрудника",
              text: `${t.title} · ${assignee?.name ?? "—"}`,
              dealId: t.dealId, taskId: t.id,
            });
          });
          get().saveTask({ ...t, overdueNotified: true }, false);
        });
      },

      /* локальная очистка после полного удаления данных (справочники остаются) */
      /* полная очистка после серверного wipe: сбрасывается ВСЁ —
         рабочие данные, справочники, настройки и сотрудники.
         Затем в облако возвращаются только «заводские» справочники
         (воронка, каталог, должности, базовые настройки) — без них CRM
         не сможет работать. База остаётся чистой от любых введённых
         данных: следующий зарегистрированный автоматически станет Директором. */
      wipeLocal: () => {
        const s = get();
        const me = s.users.find((u) => u.id === s.currentUserId);
        set({
          users: me ? [me] : [],
          clients: [], deals: [], objects: [], tasks: [], jobs: [], payments: [],
          notifications: [], invites: [],
          supplies: supplies.map((x) => ({ ...x, items: x.items.map((i) => ({ ...i })) })),
          stages: stages.map((x) => ({ ...x })),
          products: products.map((x) => ({ ...x })),
          roles: DEFAULT_ROLES.map((r) => ({ ...r, permissions: { ...r.permissions } })),
          leadSources: ["Авито", "Рекомендация", "Сайт", "Соцсети", "Повторное обращение"],
          objectStatuses: ["Проект", "Замер", "Смета", "В работе", "Пауза", "Завершён"],
          notifPrefs: { overdue: true, newTask: true, payments: true, stage: false, sound: true, booking: true },
          rolePerms: {
            Директор: { fin: true, deals: true, clients: true, tasks: true, settings: true },
            Менеджер: { fin: false, deals: true, clients: true, tasks: true, settings: false },
            Прораб: { fin: false, deals: false, clients: false, tasks: true, settings: false },
            Закупщик: { fin: true, deals: false, clients: true, tasks: true, settings: false },
          },
          aiConfig: null, page: "home", modal: [],
        });
        /* возвращаем заводские справочники в облако, чтобы CRM была рабочей */
        if (isCloud()) {
          const g = get();
          g.stages.forEach((st) => pushUpsert("stages", st));
          g.products.forEach((p) => pushUpsert("products", p));
          g.roles.forEach((r) => pushUpsert("roles", r));
          pushSettings({ leadSources: g.leadSources, objectStatuses: g.objectStatuses, notifPrefs: g.notifPrefs, rolePerms: g.rolePerms });
        }
      },
    }),
    {
      name: "prorab-crm-v1",
      version: 2,
      /* при загрузке: вычищаем дубли должностей и мигрируем права на новую модель */
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as any) };
        if (Array.isArray((merged as any).roles)) (merged as any).roles = normalizeRoles(dedupeById((merged as any).roles));
        /* новые ключи настроек (например, sound) не должны теряться из-за старых сохранений */
        (merged as any).notifPrefs = { ...current.notifPrefs, ...((persisted as any)?.notifPrefs ?? {}) };
        return merged as any;
      },
      partialize: (s) => ({
        users: s.users, currentUserId: s.currentUserId, loggedIn: s.loggedIn, theme: s.theme,
        /* режим ОБЯЗАТЕЛЬНО сохраняется: без этого после перезапуска страницы
           облачный пользователь молча «просыпался» в демо-режиме */
        mode: s.mode, cloudUser: s.cloudUser,
        collapsed: s.collapsed,
        stages: s.stages, products: s.products, clients: s.clients, deals: s.deals,
        tasks: s.tasks, objects: s.objects, jobs: s.jobs, payments: s.payments, supplies: s.supplies,
        leadSources: s.leadSources, objectStatuses: s.objectStatuses,
        notifPrefs: s.notifPrefs, rolePerms: s.rolePerms,
        roles: s.roles, invites: s.invites, notifications: s.notifications,
      }),
    }
  )
);

/* ---------------- derived selectors ---------------- */
export const dealTotal = (d: Deal) => {
  const items = d.items.reduce((a, i) => a + i.qty * i.price, 0);
  return items > 0 ? items : d.estimate;
};
export const dealPaid = (d: Deal, payments: Payment[]) =>
  payments.filter((p) => p.kind === "income" && p.dealId === d.id).reduce((a, p) => a + p.amount, 0);
export const productName = (id: string, products: Product[]) =>
  products.find((p) => p.id === id)?.name ?? "—";

/* область действия права текущего пользователя: scope("finance.edit") → "denied" | "granted" | "own" */
export function usePermScope() {
  const users = useCRM((s) => s.users);
  const currentUserId = useCRM((s) => s.currentUserId);
  const roles = useCRM((s) => s.roles);
  return (permId: string): PermScope => {
    const me = users.find((u) => u.id === currentUserId);
    if (!me) return "granted";
    const norm = (s?: string) => (s ?? "").trim().toLowerCase();
    /* ищем должность: сначала точное совпадение, затем без учёта регистра/пробелов */
    const role = roles.find((r) => r.name === me.role) ?? roles.find((r) => norm(r.name) === norm(me.role));
    if (!role) {
      /* Должность не найдена. Раньше здесь возвращалось «granted» (разрешено всё) —
         это была дыра: при любом несовпадении названия сотрудник получал полный доступ.
         Теперь проверяем только личные переопределения, по умолчанию — запрещено. */
      return me.overrides?.[permId] ?? "denied";
    }
    const isFull = role.permissions[FULL_ACCESS] === "granted" || me.overrides?.[FULL_ACCESS] === "granted";
    return effectiveScope(permId, role.permissions, me.overrides, isFull);
  };
}

/* проверка права текущего пользователя: can("finance.edit") → true/false */
export function useCan() {
  const scope = usePermScope();
  return (permId: string): boolean => isAllowed(scope(permId));
}

export { EXPENSE_CATS };
