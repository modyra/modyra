/**
 * Invoices → lines → cost splits: the business demo.
 *
 * What it shows: validity lives in the model, not in the viewport. A line collapsed while its
 * splits total 95% keeps the invoice invalid, and reopening finds the error on the split that owns
 * it. An approved line is readonly but still consulted; a server error lands on a split nobody has
 * open and waits in the global bucket, named by its path.
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

/** Every line's splits must total 100%, and a cost centre may appear once per line. */
const linesBalanced = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const splits = Object.entries(line.splits ?? {});
    const total = splits.reduce((sum, [, s]) => sum + Number(s.percent ?? 0), 0);
    if (total !== 100) failures.push(`line ${key}: splits total ${total}%`);
    const centres = splits.map(([, s]) => s.costCenter).filter(Boolean);
    if (new Set(centres).size !== centres.length) failures.push(`line ${key}: duplicate cost centre`);
  }
  return failures;
};

export const invoicesPanel = {
  id: "invoices",
  title: "Invoices",
  blurb:
    "Cost splits that must total 100%, a duplicate cost centre refused per line, an approved line " +
    "readonly but consulted, and a server error attributed to a split nobody has open.",
  exercises: ["createForm", "record", "MdyRecordHandle", "group", "field", "required", "renderField"],
  invariant:
    "Validity lives in the model, not in the viewport: a collapsed line keeps gating the invoice, " +
    "and its error waits on the split that owns it.",

  mount(work, readout) {
    readout.classList.add("demo-state");
    scenario(
      work,
      "Sei in amministrazione. Ogni fattura ha righe di spesa, e ogni riga va ripartita fra centri " +
        "di costo fino a coprire il 100%. La demo mostra che chiudere una riga non la mette a posto: " +
        "una ripartizione incompleta continua a bloccare la fattura anche quando nessuno la guarda.",
    );
    const form = createForm({
      invoices: mdyRecord(
        mdyGroup({
          supplier: mdyField("", [mdyRequired()]),
          lines: mdyRecord(
            mdyGroup({
              desc: mdyField(""),
              amount: mdyField(100),
              splits: mdyRecord(mdyGroup({ costCenter: mdyField(""), percent: mdyField(0) })),
            }),
            { validators: [linesBalanced] },
          ),
        }),
      ),
    });
    form.f.invoices.upsert("INV-1", {
      supplier: "Acme",
      lines: {
        l1: { desc: "Consulting", amount: 100, splits: { s1: { costCenter: "CC-10", percent: 60 }, s2: { costCenter: "CC-20", percent: 35 } } },
      },
    });

    let print = () => {};
    let collapsed = new Set();
    let rendered = [];
    let approvedLocks = [];

    const bar = toolbar(work);
    const host = document.createElement("div");
    host.dataset.invoicesHost = "";
    work.append(host);

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      host.replaceChildren();
      for (const invKey of form.f.invoices.keys()) {
        const inv = form.f.invoices.row(invKey);
        const box = document.createElement("div");
        box.className = "order-box";
        box.dataset.invoice = invKey;
        const head = document.createElement("strong");
        head.textContent = `Fattura ${invKey} — ${inv.supplier.value()}`;
        box.append(head);
        for (const lineKey of inv.lines.keys()) {
          const line = inv.lines.row(lineKey);
          const approved = approvedLocks.includes(`invoices.${invKey}.lines.${lineKey}`);
          if (collapsed.has(`${invKey}.${lineKey}`)) {
            const note = document.createElement("p");
            note.className = "demo-hidden-note";
            const n = line.splits.keys().length;
            note.textContent =
              `Riga ${lineKey} chiusa — ${n} ${n === 1 ? "ripartizione nascosta" : "ripartizioni nascoste"}, ` +
              "la fattura resta bloccata finche non arrivano al 100%";
            box.append(note);
            continue;
          }
          const lineLevel = level(box, `Riga ${lineKey} — descrizione e importo`);
          if (approved) badge(lineLevel.firstChild, "approvata: sola lettura");
          const row = document.createElement("div");
          row.className = "grid";
          row.dataset.line = `${invKey}.${lineKey}`;
          lineLevel.append(row);
          rendered.push(renderField(row, { name: `i-${invKey}-${lineKey}-desc`, kind: "text", ariaLabel: `Description ${lineKey}` }, line.desc, form.reactivity));
          rendered.push(renderField(row, { name: `i-${invKey}-${lineKey}-amount`, kind: "number", ariaLabel: `Amount ${lineKey}` }, line.amount, form.reactivity));
          for (const splitKey of line.splits.keys()) {
            const split = line.splits.row(splitKey);
            const splitLevel = level(lineLevel, `Ripartizione ${splitKey} — centro di costo e quota`);
            const srow = document.createElement("div");
            srow.className = "grid";
            srow.dataset.split = `${invKey}.${lineKey}.${splitKey}`;
            splitLevel.append(srow);
            rendered.push(renderField(srow, { name: `i-${invKey}-${lineKey}-${splitKey}-cc`, kind: "text", ariaLabel: `Cost centre ${splitKey}` }, split.costCenter, form.reactivity));
            rendered.push(renderField(srow, { name: `i-${invKey}-${lineKey}-${splitKey}-pc`, kind: "number", ariaLabel: `Percent ${splitKey}` }, split.percent, form.reactivity));
          }
        }
        host.append(box);
      }
      print();
    };

    actionWithHint(bar, "Close the line", "nasconde la riga: la fattura resta invalida al 95%", () => {
      collapsed.add("INV-1.l1");
      draw();
    });
    actionWithHint(bar, "Reopen the line", "riapre la riga: l'errore e ancora sulla ripartizione che lo causa", () => {
      collapsed.delete("INV-1.l1");
      draw();
    });
    actionWithHint(bar, "Fix the split", "porta CC-20 dal 35% al 40%: la ripartizione arriva a 100", () => {
      form.f.invoices.row("INV-1").lines.row("l1").splits.row("s2").percent.set(40);
      draw();
    });
    actionWithHint(bar, "Approve the line", "blocca la riga in sola lettura: resta validata e inviata", () => {
      // Readonly, not disabled: still submitted, still validated, no longer editable (G4 pattern —
      // per-leaf, since a subtree readonly does not exist yet).
      const base = "invoices.INV-1.lines.l1";
      for (const leaf of ["desc", "amount", "splits.s1.costCenter", "splits.s1.percent", "splits.s2.costCenter", "splits.s2.percent"]) {
        form.setReadonly(`${base}.${leaf}`, () => true);
      }
      approvedLocks.push(base);
      draw();
    });
    actionWithHint(bar, "Submit to the server", "il server rifiuta CC-10: l'errore torna sul path della ripartizione", () => {
      // The server rejects a split nobody has open: the error is attributed to its path and waits
      // in the global bucket while the field is unregistered or unchanged.
      form.submit(async () => [
        { path: "invoices.INV-1.lines.l1.splits.s1.percent", kind: "server", message: "CC-10 is frozen this quarter" },
      ]);
      draw();
    });

    /** Turn a validator's failure into the sentence an accountant would have written. */
    const readable = (message) =>
      message
        .replace(/^line (\S+): splits total (\d+)%$/, "Riga $1 — ripartito $2%, manca il resto per arrivare a 100")
        .replace(/^line (\S+): duplicate cost centre$/, "Riga $1 — lo stesso centro di costo compare due volte");

    print = verdictPrinter(
      readout,
      () => ({
        invoices: form.f.invoices.keys(),
        lines: Object.fromEntries(form.f.invoices.keys().map((k) => [k, form.f.invoices.row(k).lines.keys()])),
        valid: form.state.valid(),
        lineErrors: Object.fromEntries(
          form.f.invoices.keys().map((k) => [k, form.f.invoices.row(k).lines.errors()]).filter(([, e]) => e.length > 0),
        ),
        approved: approvedLocks,
        serverBucket: form.errorsFor("")().map((e) => `${e.path ?? "(form)"}: ${e.message}`),
        splitServerError: form.errorsFor("invoices.INV-1.lines.l1.splits.s1.percent")().map((e) => e.message),
        value: form.getValue().invoices,
      }),
      (s) => {
        const rows = [];
        rows.push(s.valid
          ? ["ok", "Fattura pronta: ogni riga e ripartita al 100%"]
          : ["ko", "Fattura bloccata — le ripartizioni non tornano"]);
        for (const [key, errs] of Object.entries(s.lineErrors)) {
          for (const e of errs) rows.push(["ko", `${key}: ${readable(e.message)}`]);
        }
        for (const base of s.approved) rows.push(["", `${base.split(".").slice(-1)[0]} approvata — sola lettura, ma sempre validata e inviata`]);
        for (const message of s.splitServerError) rows.push(["ko", `Il server rifiuta la ripartizione s1: ${message}`]);
        if (collapsed.size > 0) rows.push(["", "Una riga e chiusa: il verdetto qui sopra la conta comunque"]);
        return rows;
      },
    );

    const effect = form.reactivity.effect(() => { form.state.valid(); print(); });
    draw();
    return () => { effect.destroy(); print.cancel?.(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
