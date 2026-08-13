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
