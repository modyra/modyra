/**
 * A control that is part of a field is always there, and says so when it cannot act.
 *
 * Two facts look like one and change at different rates: whether a control *exists*, which is a fact
 * about the field's design and fixed, and whether it can *act*, which is a fact about the moment.
 * Taking the control away when it cannot act collapses them — the number of tab stops changes as
 * somebody works, and whoever has never used the field learns what it can do only after filling it
 * in, or never.
 *
 * So: absent for configuration, disabled for state. The clear-all was hidden while there was nothing
 * to clear, which is absence by another name — a hidden element is out of the accessibility tree
 * along with everything about it.
 *
 * `aria-disabled` rather than the property, and that is not a detail: the native one takes the button
 * out of the tab order, which is the moving-stops problem again, and takes focus with it at the
 * moment it changes — which is exactly the moment somebody has just pressed the button. Announced as
 * unavailable, still reachable, refused in the handler.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

function chosen() {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(
    host,
    [{ name: "f", kind: "multiselect", label: "F", options: [{ value: "a", label: "A" }] }],
    { submitLabel: null },
  );
  return { host, ...mounted };
}

test("the clear-all is there and reachable whether or not there is anything to clear", async () => {
  const { host, form, reactivity, dispose } = chosen();
  await reactivity.flush();

  const clear = host.querySelector(".mdy-multiselect__clear-all");
  assert.ok(clear !== null, "no clear-all at all");
  assert.equal(clear.hidden, false,
    "the clear-all is hidden on an empty field, so it is out of the accessibility tree and the tab "
    + "stops change as somebody fills the field in");
  assert.notEqual(clear.tabIndex, -1,
    "the clear-all cannot be reached by keyboard, so the stops move when it becomes available");

  form.f.f.set(["a"]);
  await reactivity.flush();
  assert.equal(clear.hidden, false);
  assert.notEqual(clear.tabIndex, -1);

  dispose?.();
  host.remove();
});

test("and it says whether it can act", async () => {
  const { host, form, reactivity, dispose } = chosen();
  await reactivity.flush();
  const clear = host.querySelector(".mdy-multiselect__clear-all");

  assert.equal(clear.getAttribute("aria-disabled"), "true",
    "an empty field's clear-all looks live and does nothing. A button that lies is worse than one "
    + "that says it is unavailable");

  form.f.f.set(["a"]);
  await reactivity.flush();
  assert.equal(clear.getAttribute("aria-disabled"), "false",
    "a field with something in it says its clear-all cannot act, so nobody can empty it");

  dispose?.();
  host.remove();
});

test("and refuses the press it says it will refuse", async () => {
  /**
   * The half the attribute promises, and it needs a state the first two do not.
   *
   * Pressing a clear-all on an already-empty field proves nothing: refused and "cleared what was
   * already nothing" look identical from the value. Measured — removing the refusal from the handler
   * left this green while it said one thing and did another.
   *
   * A field out of play *with something in it* is where the two come apart: the button says it cannot
   * act, acting would change the value, and the value is what says which happened.
   *
   * What this does *not* establish, said because the mutation says so: removing the handler's guard
   * leaves it green. The controller is what refuses a clear on a field out of play, and clearing an
   * empty one changes nothing — so the guard is a second lock rather than the one that holds. The
   * property asserted here is real and belongs to the field; which layer keeps it is not visible from
   * outside, and a check that claimed the guard would be claiming what it cannot see.
   */
  const { host, form, reactivity, dispose } = chosen();
  await reactivity.flush();
  form.f.f.set(["a"]);
  await reactivity.flush();
  form.setDisabled("f", () => true);
  await reactivity.flush();

  const clear = host.querySelector(".mdy-multiselect__clear-all");
  assert.equal(clear.getAttribute("aria-disabled"), "true",
    "a field out of play does not say its clear-all is unavailable, so what follows is about an "
    + "available button and asserts nothing");

  const Click = host.ownerDocument.defaultView.MouseEvent;
  clear.dispatchEvent(new Click("click", { bubbles: true }));
  await reactivity.flush();
  assert.deepEqual(form.value().f, ["a"],
    "the clear-all said it was unavailable and emptied the field anyway. A control announced as "
    + "unavailable that still acts is worse than one that never said so");

  dispose?.();
  host.remove();
});
