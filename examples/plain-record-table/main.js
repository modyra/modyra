/**
 * A table whose rows are keyed by data, rendered the way a table actually renders: **by column**.
 *
 * Each column mounts one cell of each row, so the two controls of a row are created in different
 * places and at different moments, and a row leaving edit mode unmounts its controls while the row
 * itself stays. The four things worth watching here are the ones that would be defects anywhere else:
 *
 *   - sorting re-renders every cell and changes nothing about the data;
 *   - leaving edit mode unmounts controls and keeps the values;
 *   - a row that is invalid keeps the form invalid while nothing of it is on screen;
 *   - a provisional key becomes the definitive one without losing what was typed.
 */
import { createForm, field, group, record } from "@modyra/core";
import { renderField } from "@modyra/plain";

const form = createForm({
  lines: record(
    group({
      name: field("", [(v) => (v ? [] : ["Required"])]),
      qty: field(1, [(v) => (Number(v) >= 1 ? [] : ["At least 1"])]),
    }),
  ),
});

// The rows a server would have sent: keys are its ids, serialised.
form.f.lines.setAll({
  12: { name: "Espresso", qty: 2 },
  34: { name: "Cornetto", qty: 1 },
  "tmp:1": { name: "", qty: 1 },
});

const editing = new Set(["tmp:1"]);
let sortDescending = false;

const host = document.getElementById("table");
const verdict = document.getElementById("verdict");

const cellDescriptor = (key, part) =>
  part === "name"
    ? { name: `name-${key}`, kind: "text", label: "" }
    : { name: `qty-${key}`, kind: "number", label: "" };

/** Disposers of the controls currently mounted, cleared on every re-render. */
let mounted = [];

function orderedKeys() {
  const keys = [...form.f.lines.keys()];
  keys.sort((a, b) => (sortDescending ? b.localeCompare(a) : a.localeCompare(b)));
  return keys;
}

function render() {
  for (const dispose of mounted) dispose();
  mounted = [];

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Key</th><th>Item</th><th>Qty</th><th></th></tr>
    </thead>
    <tbody></tbody>`;
  const body = table.querySelector("tbody");

  for (const key of orderedKeys()) {
    const row = document.createElement("tr");
    if (editing.has(key)) row.classList.add("editing");

    const keyCell = document.createElement("td");
    keyCell.className = "read";
    keyCell.textContent = key;
    row.append(keyCell);

    // One cell per column. A column knows the key and the part, and nothing else about the row —
    // in particular, not whether the row is declared: `cell()` answers either way.
    for (const part of ["name", "qty"]) {
      const cell = document.createElement("td");
      if (editing.has(key)) {
        mounted.push(
          renderField(cell, cellDescriptor(key, part), form.f.lines.cell(key, part)),
        );
      } else {
        cell.className = "read";
        cell.textContent = String(form.f.lines.cell(key, part).value() ?? "");
      }
      row.append(cell);
    }

    const actions = document.createElement("td");
    actions.className = "row-actions";

    const edit = document.createElement("button");
    edit.textContent = editing.has(key) ? "Done" : "Edit";
    edit.addEventListener("click", () => {
      if (editing.has(key)) editing.delete(key);
      else editing.add(key);
      render();
    });
    actions.append(edit);

    if (key.startsWith("tmp:")) {
      const save = document.createElement("button");
      save.className = "primary";
      save.textContent = "Save";
      // What a save does when the server answers with the real id: the row keeps its value and the
      // state the user produced, under its new name.
      save.addEventListener("click", () => {
        const assignedId = String(Math.floor(Math.random() * 900) + 100);
        form.f.lines.rename(key, assignedId);
        editing.delete(key);
        editing.add(assignedId);
        render();
      });
      actions.append(save);
    }

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      form.f.lines.remove(key);
      editing.delete(key);
      render();
    });
    actions.append(remove);

    row.append(actions);
    body.append(row);
  }

  const controls = document.createElement("div");
  controls.className = "row-actions";

  const sort = document.createElement("button");
  sort.textContent = sortDescending ? "Sort ascending" : "Sort descending";
  sort.addEventListener("click", () => {
    sortDescending = !sortDescending;
    render();
  });

  const add = document.createElement("button");
  add.textContent = "Add row";
  add.addEventListener("click", () => {
    form.f.lines.upsert(`tmp:${Date.now()}`, { name: "", qty: 1 });
    render();
  });

  const collapse = document.createElement("button");
  collapse.textContent = "Close every editor";
  collapse.addEventListener("click", () => {
    editing.clear();
    render();
  });

  controls.append(sort, add, collapse);

  host.replaceChildren(table, controls);
  report();
}

function report() {
  const rows = form.value().lines;
  verdict.textContent = [
    `form valid: ${form.state.valid()}`,
    `rows declared: ${[...form.f.lines.keys()].join(", ") || "(none)"}`,
    `editors mounted: ${editing.size}`,
    "",
    JSON.stringify(rows, null, 2),
  ].join("\n");
}

// The verdict follows the data, not the rendering: typing in a cell updates it without a re-render.
form.state.valid();
setInterval(report, 250);

render();
