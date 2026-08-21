import React, { useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons";
import { Modal, Avatar, Empty, ToneChip, useClickOutside } from "../components/ui";
import { useCRM, useCan, allocateFifo, money, moneyShort, uid, iso, dFmt } from "../store";
import type { Product, Supply, SupplyItem, Deal } from "../types";

/* ---------- помощники ---------- */
const fmtQty = (n: number) => (Math.round(n * 100) / 100).toLocaleString("ru-RU");

/** сколько штук товара забронировано (все неоплаченные позиции сделок) */
function reservedQty(productId: string, deals: Deal[]): number {
  return deals.reduce((a, d) =>
    a + d.items.filter((i) => i.productId === productId && !i.paid).reduce((x, i) => x + i.qty, 0), 0);
}

/* allocateFifo — единая формула распределения остатка (FIFO), импортируется из store */

export default function Warehouse() {
  const { products, deals, clients, openModal } = useCRM();
  const can = useCan();
  const goods = products.filter((p) => p.kind === "товар");

  /* брони: неоплаченные товарные позиции всех сделок.
     Несколько строк одного товара в одной сделке склеиваются в ОДНУ бронь,
     чтобы не появлялось плиток-дублей (баг «1000 шт + 500 шт = две одинаковые плитки»). */
  const bookings = useMemo(() => {
    const map = new Map<string, { deal: Deal; productId: string; qty: number }>();
    deals.forEach((d) => d.items.forEach((i) => {
      if (i.paid || i.productId === "custom" || i.qty <= 0) return;
      const p = products.find((x) => x.id === i.productId);
      if (p?.kind !== "товар") return;
      const key = `${d.id}|${i.productId}`;
      const ex = map.get(key);
      if (ex) ex.qty += i.qty;
      else map.set(key, { deal: d, productId: i.productId, qty: i.qty });
    }));
    return [...map.values()].sort((a, b) => +new Date(b.deal.createdAt) - +new Date(a.deal.createdAt));
  }, [deals, products]);

  /* общая стоимость остатков на складе по закупочным ценам (пункт 8) */
  const stockValue = useMemo(() => goods.reduce((a, p) => {
    const available = Math.max(0, (p.stock ?? 0) - reservedQty(p.id, deals));
    return a + available * (p.purchasePrice ?? 0);
  }, 0), [goods, deals]);

  return (
    <div className="p-6 max-w-[1240px] mx-auto">
      {/* ======== ЗАБРОНИРОВАННЫЕ ТОВАРЫ — сверху, над заголовком ======== */}
      <section className="mb-5 anim-page">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            <Icon name="layers" size={15} />
          </span>
          <span className="font-display text-[14px] font-semibold">Забронированные товары</span>
          <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>{bookings.length}</span>
          <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
        </div>

        {bookings.length === 0 ? (
          <div className="card p-5">
            <Empty icon="layers" text="Броней пока нет — добавьте товар в сделку, и резерв появится здесь" />
          </div>
        ) : (
          <div className="max-h-[330px] overflow-y-auto pb-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {bookings.map((b, i) => <BookingTile key={b.deal.id + b.productId} b={b} />)}
            </div>
          </div>
        )}
      </section>

      {/* ======== ЗАГОЛОВОК + КНОПКИ ======== */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-wide">Склад <span style={{ color: "var(--muted)" }}>· Товары</span></h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {goods.length} позиций на складе
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {can("products.edit") && (
            <button className="btn btn-primary" onClick={() => openModal({ type: "product" })}><Icon name="plus" size={15} sw={2.4} /> Товар</button>
          )}
          {can("products.supply") && (
            <button className="btn btn-ghost" onClick={() => openModal({ type: "supply" })}><Icon name="plus" size={15} sw={2.4} /> Поставка</button>
          )}
        </div>
      </div>

      {/* ======== СПИСОК ТОВАРОВ ======== */}
      <section className="card overflow-hidden anim-page">
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
            <Icon name="box" size={16} />
          </span>
          <div className="flex-1">
            <div className="font-display text-[13px] font-semibold">Товары на складе</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>Остаток считается автоматически с учётом броней и приходов</div>
          </div>
          <div className="text-right flex-none">
            <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>Остатки по закупке</div>
            <div className="font-display text-[15px] font-bold" style={{ color: "var(--brand)" }}>{money(stockValue)}</div>
          </div>
        </div>

        {goods.length === 0 ? (
          <div className="p-5">
            <Empty icon="box" text="Товаров пока нет"
              action={can("products.edit") ? <button className="btn btn-primary btn-sm" onClick={() => openModal({ type: "product" })}>+ Добавить товар</button> : undefined} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--panel)" }}>
                {["Товар", "Закупка", "Продажа", "На складе", "Стоимость остатка", ""].map((h, k) => (
                  <th key={k} className="px-4 py-2.5 text-[10.5px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {goods.map((p) => <ProductRow key={p.id} p={p} />)}
            </tbody>
          </table>
        )}
      </section>

      {/* услуги — компактно, без склада */}
      {products.some((p) => p.kind === "услуга") && (
        <div className="text-[11.5px] font-semibold mt-3 flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
          <Icon name="hammer" size={13} /> Услуги и работы ({products.filter((p) => p.kind === "услуга").length}) не хранятся на складе — они доступны в каталоге сделок
        </div>
      )}
    </div>
  );
}

/* ================= ПЛИТКА БРОНИ (компактная) ================= */
function BookingTile({ b }: { b: { deal: Deal; productId: string; qty: number } }) {
  const { products, deals, openModal } = useCRM();
  const p = products.find((x) => x.id === b.productId)!;
  const stock = p.stock ?? 0;
  /* FIFO: приоритет у более ранних заказов — та же функция, что и в карточке брони */
  const alloc = allocateFifo(deals, b.productId, stock).get(b.deal.id) ?? { fromStock: 0, toOrder: b.qty };
  const { fromStock, toOrder } = alloc;
  const accent = toOrder > 0 ? "var(--amber)" : "var(--brand)";
  return (
    <button onClick={() => openModal({ type: "booking", dealId: b.deal.id, productId: b.productId })}
      className="text-left p-3.5 rounded-[13px] border cursor-pointer transition-all duration-200 hover:-translate-y-1 group relative overflow-hidden flex flex-col"
      style={{ borderColor: "var(--line)", background: "var(--panel)", boxShadow: "var(--shadow)" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.borderColor = `color-mix(in srgb, ${accent} 55%, var(--line))`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.borderColor = "var(--line)"; }}>
      {/* верхняя цветовая кромка */}
      <span className="absolute left-0 right-0 top-0 h-[3.5px]" style={{ background: accent }} />

      <div className="flex items-start gap-2.5 mt-1">
        {p.photo ? (
          <img src={p.photo} alt="" className="w-11 h-11 rounded-[10px] object-cover flex-none transition-transform duration-200 group-hover:scale-105" style={{ border: "1px solid var(--line)" }} />
        ) : (
          <span className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-none transition-transform duration-200 group-hover:scale-105"
            style={{ background: `color-mix(in srgb, ${accent} 14%, var(--panel2))`, color: accent }}>
            <Icon name="layers" size={20} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-extrabold leading-tight line-clamp-2">{p.name}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display text-[19px] font-bold leading-none" style={{ color: accent }}>{fmtQty(b.qty)}</span>
            <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{p.unit}</span>
            <Icon name="chevR" size={13} className="text-[var(--faint)] group-hover:translate-x-0.5 transition-transform ml-auto" />
          </div>
        </div>
      </div>

      {/* разбивка: со склада / дозаказать */}
      <div className="mt-2.5 rounded-[9px] px-2.5 py-1.5 text-[10.5px] font-bold leading-snug"
        style={{ background: `color-mix(in srgb, ${accent} 9%, var(--panel2))` }}>
        {toOrder > 0 ? (
          <>
            <span style={{ color: "var(--green)" }}>{fmtQty(fromStock)} со склада</span>
            <span style={{ color: "var(--muted)" }}> + </span>
            <span style={{ color: "var(--amber)" }}>{fmtQty(toOrder)} заказать</span>
          </>
        ) : (
          <span style={{ color: "var(--green)" }}>✓ полностью со склада</span>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t flex items-center gap-1.5 text-[11px] font-bold truncate" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <Icon name="kanban" size={12} className="flex-none" />
        <span className="truncate">{b.deal.title}</span>
      </div>
    </button>
  );
}

/* ================= СТРОКА ТОВАРА ================= */
function ProductRow({ p }: { p: Product }) {
  const { deals, saveProduct, openModal } = useCRM();
  const can = useCan();
  const [pop, setPop] = useState(false);
  const popRef = useClickOutside(() => setPop(false));
  const reserved = reservedQty(p.id, deals);
  const available = Math.max(0, (p.stock ?? 0) - reserved);
  const priceDrift = p.lastSupplyPrice != null && p.purchasePrice != null && Math.abs(p.lastSupplyPrice - p.purchasePrice) > 0.01;

  return (
    <tr className="row-hover border-t" style={{ borderColor: "var(--line)" }}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {p.photo ? (
            <img src={p.photo} alt="" className="w-10 h-10 rounded-[9px] object-cover flex-none" style={{ border: "1px solid var(--line)" }} />
          ) : (
            <span className="w-10 h-10 rounded-[9px] flex items-center justify-center flex-none" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              <Icon name="box" size={18} />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-bold truncate">{p.name}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>за {p.unit}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="relative inline-block" ref={popRef}>
          <button disabled={!priceDrift || !can("products.edit")} onClick={() => setPop(!pop)}
            className="text-[13px] font-extrabold whitespace-nowrap cursor-pointer disabled:cursor-default flex items-center gap-1.5"
            style={{ color: priceDrift ? "var(--red)" : "var(--ink)" }}
            title={priceDrift ? "Цена отличается от последней поставки" : undefined}>
            {p.purchasePrice != null ? money(p.purchasePrice) : "—"}
            {priceDrift && <Icon name="alert" size={13} className="text-[var(--red)]" />}
          </button>
          {pop && priceDrift && (
            <div className="absolute left-0 top-full mt-1.5 z-30 card p-1.5 w-[240px] anim-pop" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="px-2 py-1.5 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                Закупка {money(p.purchasePrice!)} ≠ поставка {money(p.lastSupplyPrice!)}
              </div>
              <button className="w-full text-left px-2.5 py-2 rounded-lg row-hover text-[12.5px] font-bold" onClick={() => setPop(false)}>Оставить как есть</button>
              <button className="w-full text-left px-2.5 py-2 rounded-lg row-hover text-[12.5px] font-bold" style={{ color: "var(--brand)" }}
                onClick={() => { saveProduct({ ...p, purchasePrice: p.lastSupplyPrice }, false); setPop(false); useCRM.getState().toast("Закупочная цена обновлена по поставке"); }}>
                Применить цену с поставки
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap">{money(p.price)}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-display text-[13.5px] font-bold">{fmtQty(available)}</span>
          <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{p.unit}</span>
          {reserved > 0 && (
            <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>+{fmtQty(reserved)} бронь</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap" style={{ color: "var(--brand)" }}
        title="Свободный остаток × цена закупки">
        {money(available * (p.purchasePrice ?? 0))}
      </td>
      <td className="px-4 py-2.5 text-right">
        {can("products.edit") && (
          <button className="icon-btn" onClick={() => openModal({ type: "product", id: p.id })} title="Редактировать товар">
            <Icon name="pencil" size={15} />
          </button>
        )}
      </td>
    </tr>
  );
}

/* ================= ОКНО ТОВАРА ================= */
export function ProductModal({ id }: { id?: string }) {
  const { products, saveProduct, deleteProduct, toast, closeModal } = useCRM();
  const existing = products.find((p) => p.id === id);
  const [f, setF] = useState<Product>(existing ?? { id: uid(), name: "", unit: "шт", price: 0, kind: "товар", purchasePrice: 0, stock: 0 });
  const [name, setName] = useState(f.name);
  const [unit, setUnit] = useState(f.unit);
  const [purchase, setPurchase] = useState(f.purchasePrice?.toString() ?? "");
  const [price, setPrice] = useState(f.price?.toString() ?? "");
  const [stock, setStock] = useState(f.stock?.toString() ?? "0");
  const [photo, setPhoto] = useState(f.photo ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 220;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        setPhoto(cv.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!name.trim()) { toast("Введите название товара", "alert"); return; }
    saveProduct({
      ...f, name: name.trim(), unit: unit.trim() || "шт",
      purchasePrice: parseFloat(purchase.replace(",", ".")) || 0,
      price: parseFloat(price.replace(",", ".")) || 0,
      stock: parseFloat(stock.replace(",", ".")) || 0,
      photo: photo || undefined,
    }, !existing);
    toast(existing ? "Товар обновлён" : `Товар «${name.trim()}» добавлен на склад`);
    closeModal();
  };

  const priceDrift = existing && f.lastSupplyPrice != null && purchase !== "" && Math.abs(f.lastSupplyPrice - (parseFloat(purchase.replace(",", ".")) || 0)) > 0.01;

  return (
    <Modal onClose={closeModal} width={540} icon="box" title={existing ? "Карточка товара" : "Новый товар"}
      footer={<>
        {existing && (
          <button className="btn btn-danger" onClick={() => { deleteProduct(f.id); toast("Товар удалён со склада"); closeModal(); }}>
            <Icon name="trash" size={14} /> Удалить
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> Сохранить</button>
      </>}>
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <button className="w-[92px] h-[92px] rounded-xl border-2 border-dashed flex-none flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors overflow-hidden relative group"
            style={{ borderColor: "var(--line2)", background: "var(--panel2)" }}
            onClick={() => fileRef.current?.click()}
            title="Загрузить фото (необязательно)">
            {photo ? (
              <>
                <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute inset-0 hidden group-hover:flex items-center justify-center" style={{ background: "rgba(14,20,17,0.55)" }}>
                  <Icon name="camera" size={20} className="text-white" />
                </span>
              </>
            ) : (
              <>
                <Icon name="camera" size={20} className="text-[var(--faint)]" />
                <span className="text-[10px] font-bold" style={{ color: "var(--faint)" }}>фото</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          <div className="flex-1 space-y-3">
            <div>
              <label className="label">Название *</label>
              <input className="input" placeholder="Например: Тротуарная плитка «Классико»" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Единица измерения</label>
              <input className="input !w-[120px]" placeholder="шт / м² / упак" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">
              Цена закупки
              {priceDrift && <Icon name="alert" size={12} className="inline ml-1 text-[var(--red)]" />}
            </label>
            <input className="input" inputMode="decimal" placeholder="0" value={purchase} onChange={(e) => setPurchase(e.target.value)}
              style={priceDrift ? { color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 45%, var(--line))" } : undefined} />
            {priceDrift && (
              <button className="text-[10.5px] font-bold mt-1 cursor-pointer hover:opacity-75" style={{ color: "var(--red)" }}
                onClick={() => setPurchase(String(f.lastSupplyPrice))}>
                с поставки: {money(f.lastSupplyPrice!)} — применить
              </button>
            )}
          </div>
          <div>
            <label className="label">Цена продажи</label>
            <input className="input" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label">Кол-во на складе</label>
            <input className="input" inputMode="decimal" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>

        <div className="p-3 rounded-[10px] flex items-start gap-2.5" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          <Icon name="note" size={15} className="mt-px flex-none text-[var(--muted)]" />
          <div className="text-[11.5px] font-semibold leading-relaxed" style={{ color: "var(--muted)" }}>
            Цена закупки и количество подтягиваются автоматически из приходов. Если после поставки цена отличается —
            поле подсветится красным, и вы сможете применить цену поставки одним нажатием.
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= ОКНО ПРИХОДА (ПОСТАВКИ) ================= */
export function SupplyModal() {
  const { products, saveSupply, toast, closeModal } = useCRM();
  const goods = products.filter((p) => p.kind === "товар");
  const [rows, setRows] = useState<SupplyItem[]>([{ productId: "", qty: 1, price: 0 }]);
  const [note, setNote] = useState("");

  const setRow = (k: number, p: Partial<SupplyItem>) => setRows((r) => r.map((x, i) => (i === k ? { ...x, ...p } : x)));
  const pick = (k: number, pid: string) => {
    const p = goods.find((x) => x.id === pid);
    setRow(k, { productId: pid, price: p?.purchasePrice ?? p?.price ?? 0 });
  };

  const save = () => {
    const ok = rows.filter((r) => r.productId && r.qty > 0);
    if (!ok.length) { toast("Добавьте хотя бы один товар в поставку", "alert"); return; }
    const s: Supply = { id: uid(), items: ok, date: new Date().toISOString(), note: note.trim() || undefined, createdAt: iso(Date.now()) };
    saveSupply(s);
    toast(`Приход оформлен: ${ok.length} поз. — остатки на складе обновлены`);
    closeModal();
  };

  return (
    <Modal onClose={closeModal} width={620} icon="layers" title="Приход товара (поставка)"
      footer={<>
        <div className="flex-1" />
        <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          Итого: <span className="font-display" style={{ color: "var(--ink)" }}>{money(rows.reduce((a, r) => a + r.qty * r.price, 0))}</span>
        </span>
        <button className="btn btn-ghost" onClick={closeModal}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} sw={2.4} /> Сохранить приход</button>
      </>}>
      <div className="p-5">
        {/* подписи колонок */}
        <div className="grid grid-cols-[1fr_76px_100px_96px_28px] gap-2 px-2 pb-1.5">
          <span className="text-[10px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--muted)" }}>Товар</span>
          <span className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-center" style={{ color: "var(--muted)" }}>Кол-во</span>
          <span className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-right" style={{ color: "var(--muted)" }}>Цена закупки</span>
          <span className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-right" style={{ color: "var(--muted)" }}>Сумма</span>
          <span />
        </div>
        <div className="space-y-2">
          {rows.map((r, k) => {
            const prod = goods.find((x) => x.id === r.productId);
            const rowSum = r.qty * r.price;
            return (
              <div key={k} className="grid grid-cols-[1fr_76px_100px_96px_28px] items-center gap-2 p-2 rounded-[10px] border anim-fade" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                <select className="select !py-1.5 !text-[12.5px]" value={r.productId} onChange={(e) => pick(k, e.target.value)}>
                  <option value="">— товар из каталога —</option>
                  {goods.map((p) => <option key={p.id} value={p.id}>{p.name} · на складе {fmtQty(p.stock ?? 0)} {p.unit}</option>)}
                </select>
                <input type="number" min={0} className="input !py-1.5 !text-[12.5px] text-center" title="Количество"
                  value={r.qty} onChange={(e) => setRow(k, { qty: parseFloat(e.target.value) || 0 })} />
                <input type="number" min={0} className="input !py-1.5 !text-[12.5px] text-right" title="Цена закупки за единицу"
                  value={r.price} onChange={(e) => setRow(k, { price: parseFloat(e.target.value) || 0 })} />
                <span className="text-[12px] font-extrabold text-right whitespace-nowrap" title="Итоговая стоимость по этой строке">
                  {money(rowSum)}
                </span>
                <button className="icon-btn !w-7 !h-7 hover:!text-[var(--red)]" onClick={() => setRows((x) => x.filter((_, i) => i !== k))} disabled={rows.length === 1}>
                  <Icon name="x" size={14} />
                </button>
                {prod && (
                  <div className="col-span-5 -mt-0.5 text-[10.5px] font-semibold truncate" style={{ color: "var(--faint)" }}>
                    {prod.name} · ед. {prod.unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn btn-soft btn-sm mt-2.5" onClick={() => setRows((r) => [...r, { productId: "", qty: 1, price: 0 }])}>
          <Icon name="plus" size={13} sw={2.4} /> Добавить товар
        </button>

        <div className="mt-4">
          <label className="label">Комментарий к поставке</label>
          <input className="input" placeholder="Поставщик, накладная…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="p-3 rounded-[10px] mt-4 flex items-start gap-2.5" style={{ background: "var(--green-soft)", border: "1px solid color-mix(in srgb, var(--green) 25%, transparent)" }}>
          <span className="mt-px flex-none" style={{ color: "var(--green)" }}><Icon name="note" size={15} /></span>
          <div className="text-[11.5px] font-semibold leading-relaxed" style={{ color: "var(--muted)" }}>
            После сохранения количество прибавится к остаткам на складе, а закупочные цены товаров обновятся по этой поставке.
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= ОКНО БРОНИ ================= */
export function BookingModal({ dealId, productId }: { dealId: string; productId: string }) {
  const { deals, products, clients, users, markDealItemsPaid, openModal, closeModal } = useCRM();
  const can = useCan();
  const deal = deals.find((d) => d.id === dealId);
  /* брони одного товара в сделке могло быть несколько строк — суммируем их */
  const rowsFor = (deal?.items ?? []).filter((i) => i.productId === productId && !i.paid);
  const totalQty = rowsFor.reduce((a, i) => a + i.qty, 0);
  const item = rowsFor[0] ? { ...rowsFor[0], qty: totalQty } : undefined;
  const p = products.find((x) => x.id === productId);

  if (!deal || !item || !p) {
    return (
      <Modal onClose={closeModal} width={440} icon="layers" title="Бронь товара">
        <div className="p-6 text-center text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
          Эта бронь уже оплачена или снята.
          <div className="mt-3"><button className="btn btn-ghost" onClick={closeModal}>Закрыть</button></div>
        </div>
      </Modal>
    );
  }

  const client = clients.find((c) => c.id === deal.clientId);
  const owner = users.find((u) => u.id === deal.ownerId);
  const stock = p.stock ?? 0;
  /* FIFO: та же функция, что и в плитке брони — снаружи и внутри цифры одинаковые */
  const alloc = allocateFifo(deals, productId, stock).get(deal.id) ?? { fromStock: 0, toOrder: item.qty };
  const { fromStock, toOrder } = alloc;
  const purchase = item.purchasePrice ?? p.purchasePrice ?? 0;
  const canClient = can("clients.viewCard") || can("clients.view");

  return (
    <Modal onClose={closeModal} width={560} icon="layers" title="Бронь товара"
      footer={<>
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={closeModal}>Закрыть</button>
      </>}>
      <div className="p-5">
        {/* шапка: название слева, приглушённая кнопка «Оплачено» справа */}
        <div className="flex items-start gap-3.5">
          {p.photo ? (
            <img src={p.photo} alt="" className="w-[68px] h-[68px] rounded-xl object-cover flex-none" style={{ border: "1px solid var(--line)" }} />
          ) : (
            <span className="w-[68px] h-[68px] rounded-xl flex items-center justify-center flex-none" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              <Icon name="layers" size={26} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-extrabold leading-snug">{p.name}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {toOrder > 0 ? (
                <ToneChip tone="amber">{fmtQty(fromStock)} со склада + {fmtQty(toOrder)} заказать</ToneChip>
              ) : (
                <ToneChip tone="green">полностью со склада</ToneChip>
              )}
            </div>
          </div>
          <button className="btn btn-sm flex-none !py-1.5 transition-colors"
            style={{ color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 35%, var(--line))", background: "var(--panel)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--green-soft)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--green) 55%, var(--line))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--green) 35%, var(--line))"; }}
            title="Отметить бронь оплаченной: товар спишется со склада, запись появится в истории сделки"
            onClick={() => { markDealItemsPaid(deal.id, productId); closeModal(); }}>
            <Icon name="ruble" size={13} /> Оплачено
          </button>
        </div>

        {/* цифры */}
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>Сумма заказа</div>
            <div className="font-display text-[15px] font-bold mt-1">{money(item.qty * item.price)}</div>
          </div>
          <div className="p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>Закупочная стоимость</div>
            <div className="font-display text-[15px] font-bold mt-1" style={{ color: "var(--red)" }}>{money(item.qty * purchase)}</div>
          </div>
          <div className="p-3 rounded-[10px] border"
            style={{ borderColor: "color-mix(in srgb, var(--amber) 35%, var(--line))", background: "color-mix(in srgb, var(--amber) 7%, var(--panel2))" }}>
            <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--amber)" }}>Бронь</div>
            <div className="font-display text-[15px] font-bold mt-1" style={{ color: "var(--amber)" }}>{fmtQty(item.qty)} {p.unit}</div>
          </div>
        </div>

        {/* участники */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button disabled={!canClient}
            className="flex items-center gap-2.5 p-3 rounded-[10px] border text-left transition-all disabled:cursor-default enabled:hover:-translate-y-px enabled:cursor-pointer"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
            onClick={() => client && openModal({ type: "client", id: client.id })}
            title={canClient ? "Открыть карточку клиента" : "Нет доступа к клиентам"}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
              <Icon name="user" size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>Заказчик</span>
              <span className="block text-[12.5px] font-bold truncate">{client?.name ?? "—"}</span>
            </span>
            {canClient && <Icon name="chevR" size={14} className="text-[var(--faint)] flex-none" />}
            {!canClient && <Icon name="lock" size={13} className="text-[var(--faint)] flex-none" />}
          </button>
          <div className="flex items-center gap-2.5 p-3 rounded-[10px] border" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <Avatar user={owner} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>Заявку сделал</span>
              <span className="block text-[12.5px] font-bold truncate">{owner?.name ?? "—"}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 p-3 rounded-[10px]" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <Icon name="kanban" size={13} /> Сделка
          </span>
          <button className="text-[12.5px] font-extrabold cursor-pointer hover:opacity-75" style={{ color: "var(--brand)" }}
            onClick={() => { closeModal(); openModal({ type: "deal", id: deal.id }); }}>
            {deal.title} →
          </button>
        </div>

        <div className="text-[11px] font-semibold mt-3 flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
          <Icon name="note" size={13} className="mt-px flex-none" />
          «Оплачено» — когда клиент оплатил товар: бронь снимается, количество списывается со склада, запись появляется в истории сделки.
        </div>
      </div>
    </Modal>
  );
}
