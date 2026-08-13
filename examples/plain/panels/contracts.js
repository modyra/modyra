/**
 * Contracts → lines → price bands: the advanced demo.
 *
 * What it shows: a rule that spans a whole collection is checked where the collection lives, not
 * where a field is drawn. Bands that overlap or leave a gap are refused by the collection that owns
 * them, so the verdict survives collapsing every band; a currency that disagrees with its contract
 * is refused one level up; and sorting the bands for reading never renames them.
 */
import {
  createForm,
  field as mdyField,
  group as mdyGroup,
  record as mdyRecord,
  required as mdyRequired,
} from "@modyra/core";
import { renderField } from "@modyra/plain";
import { actionWithHint, badge, level, scenario, toolbar, verdictPrinter } from "./shell.js";

/**
 * A line's bands must tile its quantity axis: each band's minimum below its maximum, no two bands
 * covering the same quantity, and no quantity left uncovered between the lowest and the highest.
 */
export const bandsTile = (bands) => {
  const failures = [];
  const rows = Object.entries(bands ?? {}).map(([key, b]) => ({
    key,
    min: Number(b.minQty ?? 0),
    max: Number(b.maxQty ?? 0),
  }));
  for (const b of rows) {
    if (b.min >= b.max) failures.push(`band ${b.key}: min ${b.min} is not below max ${b.max}`);
  }
  const ordered = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.min < previous.max) failures.push(`bands ${previous.key} and ${current.key} overlap at ${current.min}`);
    else if (current.min > previous.max) failures.push(`bands ${previous.key} and ${current.key} leave ${previous.max}-${current.min} uncovered`);
  }
  return failures;
};

/** Across a contract's lines: one currency, and a price that never rises with quantity. */
export const linesCoherent = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const bands = Object.entries(line.bands ?? {})
      .map(([bandKey, b]) => ({ key: bandKey, min: Number(b.minQty ?? 0), price: Number(b.price ?? 0) }))
      .sort((a, b) => a.min - b.min);
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i].price > bands[i - 1].price) {
        failures.push(`line ${key}: band ${bands[i].key} costs more per unit than ${bands[i - 1].key}`);
      }
    }
  }
  return failures;
};

const bandItem = () =>
  mdyGroup({ minQty: mdyField(0), maxQty: mdyField(0), price: mdyField(0) });

export const contractsPanel = {
  id: "contracts",
  title: "Contracts",
  blurb:
    "Price bands that must tile the quantity axis without overlap or gap, a price that may not rise " +
    "with volume, and a discount the server refuses above its threshold. The rules live on the " +
    "collections they describe, so a collapsed band still gates the contract.",
  exercises: ["createForm", "record", "MdyRecordHandle", "group", "field", "required", "renderField"],
  invariant:
    "A rule about a whole collection is checked where the collection lives: overlapping bands are " +
    "refused with both names, and sorting them for reading never renames them.",

  mount(work, readout) {
    readout.classList.add("demo-state");
    scenario(
      work,
      "Sei al commerciale. Un contratto quadro fissa, per ogni prodotto, gli scaglioni di prezzo: " +
        "da 1 a 100 pezzi un prezzo, da 100 a 500 un altro. La demo mostra che gli scaglioni devono " +
        "coprire tutte le quantita senza buchi ne sovrapposizioni, e che l'errore nomina le due " +
        "fasce in conflitto anche quando sono chiuse.",
    );

    const form = createForm({
      contracts: mdyRecord(
        mdyGroup({
          customer: mdyField("", [mdyRequired()]),
          currency: mdyField("EUR"),
          lines: mdyRecord(
            mdyGroup({ sku: mdyField(""), bands: mdyRecord(bandItem(), { validators: [bandsTile] }) }),
            { validators: [linesCoherent] },
          ),
        }),
      ),
    });
    form.f.contracts.upsert("C-1", {
      customer: "Acme",
      currency: "EUR",
      lines: {
        l1: {
          sku: "SKU-1",
          bands: {
            b1: { minQty: 1, maxQty: 100, price: 10 },
            b2: { minQty: 100, maxQty: 500, price: 8 },
          },
        },
      },
    });

    let print = () => {};
    let descending = false;
    let collapsed = false;
    let rendered = [];

    const bar = toolbar(work);
    const host = document.createElement("div");
    host.dataset.contractsHost = "";
    work.append(host);

    /** Reading order only: the model's keys are identity, and sorting must not touch them. */
    const bandOrder = (bands) => {
      const keys = bands.keys();
      const byMin = [...keys].sort((a, b) =>
        Number(bands.row(a).minQty.value()) - Number(bands.row(b).minQty.value()));
      return descending ? byMin.reverse() : byMin;
    };

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      host.replaceChildren();
      for (const contractKey of form.f.contracts.keys()) {
        const contract = form.f.contracts.row(contractKey);
        const box = document.createElement("div");
        box.className = "order-box";
        box.dataset.contract = contractKey;
        const head = document.createElement("strong");
        head.textContent = `Contratto ${contractKey} — ${contract.customer.value()}`;
        box.append(head);
        badge(head, contract.currency.value());
        for (const lineKey of contract.lines.keys()) {
          const line = contract.lines.row(lineKey);
          const lineLevel = level(box, `Riga ${lineKey} — prodotto a listino`);
          const row = document.createElement("div");
          row.className = "grid";
          row.dataset.line = `${contractKey}.${lineKey}`;
          lineLevel.append(row);
          rendered.push(renderField(row, { name: `c-${contractKey}-${lineKey}-sku`, kind: "text", ariaLabel: `SKU ${lineKey}` }, line.sku, form.reactivity));
          if (collapsed) {
            const note = document.createElement("p");
            note.className = "demo-hidden-note";
            const n = line.bands.keys().length;
            note.textContent =
              `${n} ${n === 1 ? "fascia nascosta" : "fasce nascoste"} — le regole di copertura restano attive`;
            lineLevel.append(note);
            continue;
          }
          for (const bandKey of bandOrder(line.bands)) {
            const band = line.bands.row(bandKey);
            const bandLevel = level(lineLevel, `Fascia ${bandKey} — da quanti pezzi, fino a quanti, a che prezzo`);
            const brow = document.createElement("div");
            brow.className = "grid grid--three";
            brow.dataset.band = `${contractKey}.${lineKey}.${bandKey}`;
            bandLevel.append(brow);
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-min`, kind: "number", ariaLabel: `Min ${bandKey}` }, band.minQty, form.reactivity));
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-max`, kind: "number", ariaLabel: `Max ${bandKey}` }, band.maxQty, form.reactivity));
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-price`, kind: "number", ariaLabel: `Price ${bandKey}` }, band.price, form.reactivity));
          }
        }
        host.append(box);
      }
      print();
    };

    const bandsOf = () => form.f.contracts.row("C-1").lines.row("l1").bands;

    actionWithHint(bar, "Move the threshold", "porta la fascia b2 a partire da 80: si sovrappone a b1", () => {
      bandsOf().row("b2").minQty.set(80);
      draw();
    });
    actionWithHint(bar, "Leave a gap", "porta la fascia b2 a partire da 120: 100-120 resta scoperto", () => {
      bandsOf().row("b2").minQty.set(120);
      draw();
    });
    actionWithHint(bar, "Restore the ladder", "riporta b2 a partire da 100: gli scaglioni tornano contigui", () => {
      bandsOf().row("b2").minQty.set(100);
      draw();
    });
    actionWithHint(bar, "Add a band", "aggiunge lo scaglione oltre i 500 pezzi", () => {
      const bands = bandsOf();
      bands.upsert(`b${bands.keys().length + 1}`, { minQty: 500, maxQty: 2000, price: 7 });
      draw();
    });
    actionWithHint(bar, "Raise the top price", "porta l'ultimo scaglione sopra il precedente: il prezzo risale", () => {
      const bands = bandsOf();
      const last = bands.keys()[bands.keys().length - 1];
      if (last) bands.row(last).price.set(99);
      draw();
    });
    actionWithHint(bar, "Sort descending", "inverte solo l'ordine di lettura: le chiavi non cambiano", () => {
      descending = !descending;
      draw();
    });
    actionWithHint(bar, "Collapse the bands", "chiude le fasce: le regole di copertura restano attive", () => {
      collapsed = !collapsed;
      draw();
    });
    actionWithHint(bar, "Send for approval", "il server rifiuta lo sconto oltre la soglia sulla fascia b2", () => {
      form.submit(async () => [
        { path: "contracts.C-1.lines.l1.bands.b2.price", kind: "server", message: "Discount above 20% needs approval" },
      ]);
      draw();
    });

    /** The failures a validator writes, in the words the commercial team uses. */
    const readable = (message) =>
      message
        .replace(/^bands (\S+) and (\S+) overlap at (\d+)$/, "Le fasce $1 e $2 si sovrappongono a partire da $3 pezzi")
        .replace(/^bands (\S+) and (\S+) leave (\d+)-(\d+) uncovered$/, "Fra $1 e $2 le quantita da $3 a $4 non hanno prezzo")
        .replace(/^band (\S+): min (\d+) is not below max (\d+)$/, "La fascia $1 parte da $2 e finisce a $3: non copre nulla")
        .replace(/^line (\S+): band (\S+) costs more per unit than (\S+)$/, "Riga $1 — la fascia $2 costa piu di $3: il prezzo risale col volume");

    print = verdictPrinter(
      readout,
      () => ({
        contracts: form.f.contracts.keys(),
        lines: Object.fromEntries(
          form.f.contracts.keys().map((k) => [k, form.f.contracts.row(k).lines.keys()]),
        ),
        bands: form.f.contracts.row("C-1").lines.row("l1").bands.keys(),
        readingOrder: bandOrder(form.f.contracts.row("C-1").lines.row("l1").bands),
        valid: form.state.valid(),
        bandErrors: form.errorsFor("contracts.C-1.lines.l1.bands")().map((e) => e.message),
        lineErrors: Object.fromEntries(
          form.f.contracts.keys().map((k) => [k, form.f.contracts.row(k).lines.errors()]).filter(([, e]) => e.length > 0),
        ),
        serverErrors: form.errorsFor("contracts.C-1.lines.l1.bands.b2.price")().map((e) => e.message),
        value: form.getValue().contracts,
      }),
      (s) => {
        const rows = [];
        rows.push(s.valid
          ? ["ok", "Listino coerente: gli scaglioni coprono tutte le quantita e il prezzo scende col volume"]
          : ["ko", "Listino non applicabile — vedi sotto"]);
        for (const message of s.bandErrors) rows.push(["ko", readable(message)]);
        for (const errs of Object.values(s.lineErrors)) {
          for (const e of errs) rows.push(["ko", readable(e.message)]);
        }
        for (const message of s.serverErrors) rows.push(["ko", `Il server blocca la fascia b2: ${message}`]);
        rows.push(["", `Ordine di lettura: ${s.readingOrder.join(" → ")} — chiavi nel modello: ${s.bands.join(", ")}`]);
        return rows;
      },
    );

    const effect = form.reactivity.effect(() => { form.state.valid(); print(); });
    draw();
    return () => { effect.destroy(); print.cancel?.(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
