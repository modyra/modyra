/**
 * What every panel needs and none of them should write twice.
 *
 * A demo that reimplements its own toolbar per panel is the same fault the library is being audited
 * for, one layer out — and the copies drift the same way: one toggle that reads its state from the
 * DOM and one that reads it from the model disagree the moment something else changes the model.
 */

/** A labelled checkbox that reports its own state. */
export function toggle(host, label, apply) {
  const wrap = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.toggle = label;
  box.addEventListener("change", () => apply(box.checked));
  wrap.append(box, document.createTextNode(` ${label}`));
  host.append(wrap);
  return box;
}

/** A button that does one thing. */
export function action(host, label, run) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = label;
  button.addEventListener("click", run);
  host.append(button);
  return button;
}

/** The row a panel's controls sit in. */
export function toolbar(host) {
  const bar = document.createElement("div");
  bar.className = "toolbar";
  host.append(bar);
  return bar;
}

export function grid(host) {
  const area = document.createElement("div");
  area.className = "grid";
  host.append(area);
  return area;
}

/**
 * Print a panel's state after the renderer has painted, never during.
 *
 * This renderer's effects land on a task. A readout computed inside the effect that observed the
 * change reports the *previous* paint — a number that looks authoritative and is one state behind,
 * which is exactly the kind of wrong a demo must not be.
 */
export function readoutPrinter(readout, collect) {
  let timer = null;
  const print = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      readout.textContent = JSON.stringify(collect(), null, 2);
    }, 0);
  };
  // A print already scheduled when the panel goes away would read a form that has been destroyed.
  print.cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  return print;
}

/** How many parts in this subtree say the field is failing. */
export function paintedAsFailing(root) {
  return root.querySelectorAll(
    ".mdy-input-wrapper--error, .mdy-label--has-error, [aria-invalid='true']",
  ).length;
}

/** The paragraph that says who the reader is and what they are looking at, in their language. */
export function scenario(host, text) {
  const p = document.createElement("p");
  p.className = "demo-scenario";
  p.textContent = text;
  host.append(p);
  return p;
}

/** A button that also says what it will do, so the reader does not have to guess. */
export function actionWithHint(host, label, hint, run) {
  const button = action(host, label, run);
  button.title = hint;
  button.classList.add("demo-action-btn");
  return button;
}

/** A caption naming which level of the hierarchy the box below belongs to. */
export function level(host, caption) {
  const box = document.createElement("div");
  box.className = "demo-level";
  const cap = document.createElement("div");
  cap.className = "demo-level-caption";
  cap.textContent = caption;
  box.append(cap);
  host.append(box);
  return box;
}

/** A pill for a state a reader should see without reading the JSON. */
export function badge(host, text) {
  const span = document.createElement("span");
  span.className = "demo-badge";
  span.textContent = text;
  host.append(document.createTextNode(" "), span);
  return span;
}

/**
 * The readable half of a state panel: sentences above, the raw JSON behind a `<details>`.
 *
 * Both halves are written in the same call, from the same collected state, so the sentences a
 * reader trusts and the JSON a test reads can never describe two different ticks.
 */
export function verdictPrinter(readout, collect, sentences) {
  const list = document.createElement("ul");
  list.className = "demo-verdict";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "dati grezzi (JSON)";
  details.append(summary);
  readout.before(list, details);
  details.append(readout);
  // Deferred for the reason readoutPrinter documents: printed inside the effect that observed the
  // change, both halves would report the previous paint.
  let timer = null;
  const print = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      const state = collect();
      readout.textContent = JSON.stringify(state, null, 2);
      list.replaceChildren(
        ...sentences(state).map(([cls, text]) => {
          const li = document.createElement("li");
          li.className = cls;
          li.textContent = text;
          return li;
        }),
      );
    }, 0);
  };
  print.cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  return print;
}
