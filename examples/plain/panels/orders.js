/**
 * Orders → lines → allocations: three keyed levels, driven like an operator would.
 *
 * The point on show: the interface renders portions of the structure, while the model owns
 * identity, data, validity and lifecycle whole. Filtering, collapsing and partial mounting change
 * what is drawn; they never change what the form holds.
 */
import {
  createForm,
  field as mdyField,
  group as mdyGroup,
  record as mdyRecord,
  required as mdyRequired,
  serverValidator,
} from "@modyra/core";
import { renderField } from "@modyra/plain";
import { actionWithHint, badge, level, scenario, toolbar, verdictPrinter } from "./shell.js";

/** The lot check a server would run: L-DEAD is never available, everything else takes a beat. */
const lotAvailable = async (value) => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value === "L-DEAD" ? "Lot unavailable" : null;
};

const lineItem = () =>
  mdyGroup({
    sku: mdyField("", [mdyRequired()]),
    qty: mdyField(1),
    allocs: mdyRecord(
      mdyGroup({
        warehouse: mdyField(""),
        lot: mdyField("", [], serverValidator(lotAvailable, { debounceMs: 50 })),
        qty: mdyField(0),
      }),
    ),
  });

/** Every line's allocations must cover its quantity — checked on the collection that owns the lines. */
const linesCovered = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const allocated = Object.values(line.allocs ?? {}).reduce((sum, a) => sum + Number(a.qty ?? 0), 0);
    if (allocated !== Number(line.qty ?? 0)) {
      failures.push(`line ${key}: allocated ${allocated} of ${line.qty}`);
    }
  }
  return failures;
};

export const ordersPanel = {
  id: "orders",
  title: "Orders",
  blurb:
    "Three keyed levels — orders, lines, warehouse allocations. Provisional keys renamed by the server, " +
    "allocation sums checked per line, lot availability checked asynchronously, and a whole subtree " +
    "removed and restored by undo.",
  exercises: [
    "createForm",
    "record",
    "group",
    "field",
    "required",
    "serverValidator",
    "renderField"
  ],
  invariant:
    "The interface shows portions of the structure; the model owns identity, data, validity and " +
    "lifecycle whole. A collapsed line keeps its verdict, a filtered order keeps its rows, and a " +
    "removed order comes back whole on undo.",

  mount(work, readout) {
    readout.classList.add("demo-state");
    scenario(
      work,
      "Sei un operatore logistico. Gestisci ordini che contengono righe di prodotto, e ogni riga " +
        "va coperta da allocazioni di magazzino. La demo mostra che ordinare, filtrare e chiudere " +
        "pezzi di interfaccia non tocca mai i dati: il modello possiede tutto, lo schermo ne mostra " +
        "una parte.",
    );
    const form = createForm(
      {
        orders: mdyRecord(
          mdyGroup({ customer: mdyField("", [mdyRequired()]), lines: mdyRecord(lineItem(), { validators: [linesCovered] }) }),
        ),
      },
      { history: true },
    );
    form.f.orders.upsert("tmp:1", {
      customer: "Acme",
      lines: { l1: { sku: "SKU-1", qty: 3, allocs: { a1: { warehouse: "W1", lot: "L-7", qty: 2 } } } },
    });

    let print = () => {};
    let filter = "";
    let collapsed = new Set();
    let rendered = [];

    const bar = toolbar(work);
    const host = document.createElement("div");
    host.dataset.ordersHost = "";
    work.append(host);

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      host.replaceChildren();
      for (const orderKey of form.f.orders.keys()) {
        if (filter && !orderKey.includes(filter)) continue;
        const order = form.f.orders.row(orderKey);
        const box = document.createElement("div");
        box.className = "order-box";
        box.dataset.order = orderKey;
        const head = document.createElement("strong");
        head.textContent = `Ordine ${orderKey} — ${order.customer.value()}`;
        box.append(head);
        if (orderKey.startsWith("tmp:")) badge(head, "provvisorio");
        if (collapsed.has(orderKey)) {
          const note = document.createElement("p");
          note.className = "demo-hidden-note";
          const n = order.lines.keys().length;
          note.textContent = `${n} ${n === 1 ? "riga nascosta" : "righe nascoste"} — validita ed errori restano attivi`;
          box.append(note);
        }
        if (!collapsed.has(orderKey)) {
          for (const lineKey of order.lines.keys()) {
            const line = order.lines.row(lineKey);
            const lineLevel = level(box, `Riga ${lineKey} — prodotto e quantita`);
            const row = document.createElement("div");
            row.className = "grid";
            row.dataset.line = `${orderKey}.${lineKey}`;
            lineLevel.append(row);
            rendered.push(renderField(row, { name: `o-${orderKey}-${lineKey}-sku`, kind: "text", ariaLabel: `SKU ${lineKey}` }, line.sku, form.reactivity));
            rendered.push(renderField(row, { name: `o-${orderKey}-${lineKey}-qty`, kind: "number", ariaLabel: `Qty ${lineKey}` }, line.qty, form.reactivity));
            for (const allocKey of line.allocs.keys()) {
              const alloc = line.allocs.row(allocKey);
              const allocLevel = level(lineLevel, `Allocazione ${allocKey} — lotto e quantita coperta`);
              const arow = document.createElement("div");
              arow.className = "grid";
              arow.dataset.alloc = `${orderKey}.${lineKey}.${allocKey}`;
              allocLevel.append(arow);
              rendered.push(renderField(arow, { name: `o-${orderKey}-${lineKey}-${allocKey}-lot`, kind: "text", ariaLabel: `Lot ${allocKey}` }, alloc.lot, form.reactivity));
              rendered.push(renderField(arow, { name: `o-${orderKey}-${lineKey}-${allocKey}-aqty`, kind: "number", ariaLabel: `Allocated ${allocKey}` }, alloc.qty, form.reactivity));
            }
          }
        }
        host.append(box);
      }
      print();
    };

    const firstOrder = () => form.f.orders.keys()[0];
    actionWithHint(bar, "Add order", "crea un ordine con chiave provvisoria tmp:*", () => {
      form.f.orders.upsert(`tmp:${form.f.orders.keys().length + 1}`, { customer: "New Co", lines: {} });
      draw();
    });
    actionWithHint(bar, "Server assigns code", "il server risponde: la chiave tmp diventa ORD-*, i dati restano", () => {
      const provisional = form.f.orders.keys().find((k) => k.startsWith("tmp:"));
      if (provisional) form.f.orders.rename(provisional, `ORD-${100 + form.f.orders.keys().length}`);
      draw();
    });
    actionWithHint(bar, "Add allocation", "aggiunge un'allocazione alla prima riga (copre la quantita)", () => {
      const key = firstOrder();
      if (!key) return;
      const lines = form.f.orders.row(key).lines;
      const lineKey = lines.keys()[0];
      if (!lineKey) return;
      const allocs = lines.row(lineKey).allocs;
      allocs.upsert(`a${allocs.keys().length + 1}`, { warehouse: "W2", lot: "L-9", qty: 1 });
      draw();
    });
    actionWithHint(bar, "Remove order", "elimina il primo ordine con tutte le righe e allocazioni", () => {
      const key = firstOrder();
      if (key) form.f.orders.remove(key);
      draw();
    });
    actionWithHint(bar, "Undo", "ripristina intero l'ultimo ordine rimosso", () => { form.undo(); draw(); });
    actionWithHint(bar, "Collapse first", "nasconde le righe del primo ordine: la validita non cambia", () => {
      const key = firstOrder();
      if (!key) return;
      if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
      draw();
    });
    actionWithHint(bar, "Filter ORD", "mostra solo gli ordini confermati: i tmp restano nel modello", () => { filter = filter ? "" : "ORD"; draw(); });

    const collect = () => ({
      orders: form.f.orders.keys(),
      lines: Object.fromEntries(form.f.orders.keys().map((k) => [k, form.f.orders.row(k).lines.keys()])),
      valid: form.state.valid(),
      pending: form.state.pending(),
      lineErrors: Object.fromEntries(
        form.f.orders.keys().map((k) => [k, form.f.orders.row(k).lines.errors()]).filter(([, e]) => e.length > 0),
      ),
      canUndo: form.canUndo(),
      canRedo: form.canRedo(),
      value: form.getValue().orders,
    });

    print = verdictPrinter(readout, collect, (s) => {
      const rows = [];
      rows.push(s.valid
        ? ["ok", "Tutti i controlli passano: ogni riga e coperta dalle sue allocazioni"]
        : ["ko", "L'ordine non e completo — vedi sotto"]);
      if (s.pending) rows.push(["", "… verifica disponibilita lotto in corso"]);
      for (const key of s.orders) {
        rows.push(["", key.startsWith("tmp:")
          ? `Ordine ${key} — provvisorio, in attesa del codice server`
          : `Ordine ${key} — confermato`]);
      }
      for (const errs of Object.values(s.lineErrors)) {
        for (const e of errs) rows.push(["ko", e.message.replace(/^line (\S+): allocated (\d+) of (\d+)$/, "Riga $1 — allocati $2 su $3")]);
      }
      if (s.canUndo) rows.push(["", "Undo disponibile: l'ultima operazione e reversibile, struttura inclusa"]);
      return rows;
    });

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.state.pending();
      print();
    });

    draw();
    return () => { effect.destroy(); print.cancel?.(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
