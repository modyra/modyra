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
import { action, toolbar, readoutPrinter } from "./shell.js";

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
    "MdyRecordHandle",
    "group",
    "field",
    "required",
    "serverValidator",
    "renderField",
  ],
  invariant:
    "The interface shows portions of the structure; the model owns identity, data, validity and " +
    "lifecycle whole. A collapsed line keeps its verdict, a filtered order keeps its rows, and a " +
    "removed order comes back whole on undo.",

  mount(work, readout) {
    readout.classList.add("demo-state");
    const scenario = document.createElement("p");
    scenario.className = "demo-scenario";
    scenario.textContent =
      "Sei un operatore logistico. Gestisci ordini che contengono righe di prodotto, e ogni riga " +
      "va coperta da allocazioni di magazzino. La demo mostra che ordinare, filtrare e chiudere " +
      "pezzi di interfaccia non tocca mai i dati: il modello possiede tutto, lo schermo ne mostra " +
      "una parte.";
    work.append(scenario);
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
        head.textContent = `${orderKey} — ${order.customer.value()}`;
        box.append(head);
        if (!collapsed.has(orderKey)) {
          for (const lineKey of order.lines.keys()) {
            const line = order.lines.row(lineKey);
            const row = document.createElement("div");
            row.className = "grid";
            row.dataset.line = `${orderKey}.${lineKey}`;
            box.append(row);
            rendered.push(renderField(row, { name: `o-${orderKey}-${lineKey}-sku`, kind: "text", ariaLabel: `SKU ${lineKey}` }, line.sku, form.reactivity));
            rendered.push(renderField(row, { name: `o-${orderKey}-${lineKey}-qty`, kind: "number", ariaLabel: `Qty ${lineKey}` }, line.qty, form.reactivity));
            for (const allocKey of line.allocs.keys()) {
              const alloc = line.allocs.row(allocKey);
              const arow = document.createElement("div");
              arow.className = "grid";
              arow.dataset.alloc = `${orderKey}.${lineKey}.${allocKey}`;
              box.append(arow);
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
    // Every action explains itself: label + one line of what it will do.
    const explain = {
      "Add order": "crea un ordine con chiave provvisoria tmp:*",
      "Server assigns code": "il server risponde: la chiave tmp diventa ORD-*, i dati restano",
      "Add allocation": "aggiunge un'allocazione alla prima riga (copre la quantita)",
      "Remove order": "elimina il primo ordine con tutte le righe e allocazioni",
      "Undo": "ripristina intero l'ultimo ordine rimosso",
      "Collapse first": "nasconde le righe del primo ordine: la validita non cambia",
      "Filter ORD": "mostra solo gli ordini confermati: i tmp restano nel modello",
    };
    const _origAction = action;
    const actionWithHint = (host, label, run) => {
      _origAction(host, label, run);
      const btn = host.querySelector(`[data-action="${label}"]`);
      if (btn && explain[label]) { btn.title = explain[label]; btn.classList.add("demo-action-btn"); }
    };
    actionWithHint(bar, "Add order", () => {
      form.f.orders.upsert(`tmp:${form.f.orders.keys().length + 1}`, { customer: "New Co", lines: {} });
      draw();
    });
    actionWithHint(bar, "Server assigns code", () => {
      const provisional = form.f.orders.keys().find((k) => k.startsWith("tmp:"));
      if (provisional) form.f.orders.rename(provisional, `ORD-${100 + form.f.orders.keys().length}`);
      draw();
    });
    actionWithHint(bar, "Add allocation", () => {
      const key = firstOrder();
      if (!key) return;
      const lines = form.f.orders.row(key).lines;
      const lineKey = lines.keys()[0];
      if (!lineKey) return;
      const allocs = lines.row(lineKey).allocs;
      allocs.upsert(`a${allocs.keys().length + 1}`, { warehouse: "W2", lot: "L-9", qty: 1 });
      draw();
    });
    actionWithHint(bar, "Remove order", () => {
      const key = firstOrder();
      if (key) form.f.orders.remove(key);
      draw();
    });
    actionWithHint(bar, "Undo", () => { form.undo(); draw(); });
    actionWithHint(bar, "Collapse first", () => {
      const key = firstOrder();
      if (!key) return;
      if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
      draw();
    });
    actionWithHint(bar, "Filter ORD", () => { filter = filter ? "" : "ORD"; draw(); });

    print = readoutPrinter(readout, () => ({
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
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.state.pending();
      print();
    });

    draw();
    return () => { effect.destroy(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
