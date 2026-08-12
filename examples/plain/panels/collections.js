/**
 * Rows that come and go, and the two ways a collection can be keyed.
 *
 * An array is keyed by position: reordering it moves every row after the one that moved, and a
 * handle held across that move must follow its row rather than its index. A record is keyed by data:
 * what is mounted must not decide what exists, so a row can be removed while its controls are on
 * screen and a row can exist before anything has drawn it.
 */
import { createForm, array as mdyArray, field as mdyField, group as mdyGroup, record as mdyRecord, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { action, readoutPrinter, toolbar } from "./shell.js";

export const collectionsPanel = {
  id: "collections",
  title: "Collections",
  blurb:
    "An array of rows and a record keyed by name, both live. Add, remove, move and rename while the controls are mounted; the readout shows what the form holds against what is drawn.",
  invariant:
    "A row exists because it was declared, not because it was mounted. Removing the elements does not remove the row, and moving a row carries its handle, its errors and its touched state with it.",

  mount(work, readout) {
    const form = createForm({
      items: mdyArray(mdyGroup({ name: mdyField("", [mdyRequired()]), qty: mdyField(1) }), {
        initial: [{ name: "Bolt", qty: 4 }, { name: "Nut", qty: 8 }],
      }),
      people: mdyRecord(mdyField("", [mdyRequired()]), { initial: { ada: "Ada", alan: "Alan" } }),
    });

    let print = () => {};

    const arrayBar = toolbar(work);
    const arrayHost = document.createElement("div");
    arrayHost.dataset.arrayHost = "";
    work.append(arrayHost);

    const recordBar = toolbar(work);
    const recordHost = document.createElement("div");
    recordHost.dataset.recordHost = "";
    work.append(recordHost);

    /**
     * Redraw both collections from the handles. The rows decide; the DOM follows.
     *
     * It prints as well as draws. Drawing touches no signal, so an effect watching the model would
     * never re-run — and the readout would keep reporting the number of rows that were on screen
     * before the redraw, with the authority of a current measurement.
     */
    /** Renderer teardowns from the last draw; a redraw disposes them before replacing the nodes. */
    let rendered = [];

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      arrayHost.replaceChildren();
      form.f.items.rows().forEach((row, index) => {
        const line = document.createElement("div");
        line.className = "grid";
        line.dataset.row = String(index);
        arrayHost.append(line);
        rendered.push(renderField(line, { name: `items.${index}.name`, kind: "text", label: `Item ${index + 1}` }, row.name, form.reactivity));
        rendered.push(renderField(line, { name: `items.${index}.qty`, kind: "number", label: "Qty" }, row.qty, form.reactivity));
      });

      recordHost.replaceChildren();
      for (const key of form.f.people.keys()) {
        const line = document.createElement("div");
        line.className = "grid";
        line.dataset.key = key;
        recordHost.append(line);
        rendered.push(renderField(line, { name: `people.${key}`, kind: "text", label: key, ariaLabel: `Person ${key}` }, form.f.people.row(key), form.reactivity));
      }
      print();
    };

    action(arrayBar, "Push a row", () => { form.f.items.push({ name: "", qty: 1 }); draw(); });
    action(arrayBar, "Insert at 0", () => { form.f.items.insert(0, { name: "First", qty: 1 }); draw(); });
    action(arrayBar, "Move 0 → last", () => { form.f.items.move(0, form.f.items.length() - 1); draw(); });
    action(arrayBar, "Remove last", () => { form.f.items.remove(form.f.items.length() - 1); draw(); });
    // Deliberately without a redraw: the rows are gone from the model and still on screen. The
    // readout is what tells the truth, and the two disagreeing is the point being demonstrated.
    action(arrayBar, "Clear the model only", () => form.f.items.setAll([]));
    action(arrayBar, "Redraw", draw);

    action(recordBar, "Upsert 'grace'", () => { form.f.people.upsert("grace", "Grace"); draw(); });
    action(recordBar, "Rename ada → ada2", () => { form.f.people.rename("ada", "ada2"); draw(); });
    action(recordBar, "Remove alan", () => { form.f.people.remove("alan"); draw(); });
    action(recordBar, "Touch everything", () => { form.markAllTouched(); });

    draw();

    print = readoutPrinter(readout, () => ({
      items: form.f.items.rows().map((row) => ({ name: row.name.value(), qty: row.qty.value(), touched: row.name.touched() })),
      itemsDrawn: arrayHost.querySelectorAll("[data-row]").length,
      people: Object.fromEntries(form.f.people.keys().map((k) => [k, form.f.people.row(k).value()])),
      peopleDrawn: recordHost.querySelectorAll("[data-key]").length,
      formValid: form.state.valid(),
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.f.items.length();
      form.f.people.keys();
      for (const row of form.f.items.rows()) { row.name.value(); row.name.touched(); }
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
