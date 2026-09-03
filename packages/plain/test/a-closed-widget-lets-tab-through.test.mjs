/**
 * Tab leaves a closed widget, in one press, without being pulled back.
 *
 * A trap inside an open panel is at least explicable — there is something on screen. A trap in a
 * *closed* control is not: nothing is showing, nothing says why the key stopped working, and a
 * person tabbing through a form simply cannot get past a field.
 *
 * It is reachable by a rule that reads almost right. `Escape` and `Tab` are both declared `cancel`
 * for a kind with a panel, and they are not the same act: `Escape` takes the reading position back
 * to the opener, `Tab` must leave it where the key was carrying it. The contract says which is which
 * — `restoresFocus` — and a renderer that asks only "does this key mean cancel" answers both the
 * same way and pulls focus back onto the control the person is trying to leave.
 *
 * The phase matters for the same reason. Asked about the open phase while the widget is shut, a
 * closed control answers with the bindings of a panel that is not there.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } = await import("@modyra/widgets");

/**
 * Whether this kind's open panel lets `Tab` out of it, read from the catalogue rather than listed.
 *
 * One kind here does not, and it is not an exception to the rule but the rule's other side: its
 * overlay holds an actions bar, so there is a confirm button inside that `Tab` has to be able to
 * reach, and a dialog that let the key leave would put the button out of reach of the keyboard. It
 * declares no `Tab` dismissal, which is the contract saying exactly that — so the exemption is read
 * from the declaration and a kind that grows or loses an actions bar carries it without an edit here.
 */
const letsTabOut = (kind) => (MDY_WIDGET_KEYBOARD[kind] ?? [])
  .some((binding) => binding.key === "Tab" && binding.when === "open" && binding.intent === "cancel");

const OPTIONS = [{ value: "a", label: "A" }];

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: Tab through it while it is closed does not pull the reading position back`, async () => {
    const host = document.createElement("div");
    const elsewhere = document.createElement("input");
    document.body.append(host, elsewhere);
    const { reactivity, dispose } = mountMdyForm(
      host,
      [{ name: "f", kind, label: "F", options: OPTIONS, searchable: true }],
      { submitLabel: null },
    );
    await reactivity.flush();

    assert.equal(host.querySelector("[aria-expanded='true']"), null, `${kind} mounted open`);

    // Every focusable the widget draws, walked in turn, with the key a person presses at each. What
    // is asserted is not where the browser sends focus — there is no native Tab here — but that
    // nothing in the field *moves it back*, which is what a trap is made of.
    const stops = [...host.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")];
    assert.ok(stops.length > 0, `${kind} draws nothing to tab through`);

    for (const stop of stops) {
      stop.focus();
      if (host.ownerDocument.activeElement !== stop) continue;
      stop.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      await reactivity.flush();
      assert.equal(host.ownerDocument.activeElement, stop,
        `${kind}: Tab pressed on a closed widget moved the reading position by itself. A key that is `
        + "already carrying focus somewhere and is answered by a control that puts it back is a trap, "
        + "and in a closed control there is nothing on screen to explain it");
    }

    dispose?.();
    host.remove();
    elsewhere.remove();
  });
}

/**
 * Tab is never cancelled, open or closed.
 *
 * The other half of the same rule, and the half no environment without a native Tab can see by
 * watching where focus goes: a handler that calls `preventDefault` on `Tab` leaves the person in a
 * panel being torn down, and outside a browser nothing moves either way, so the check that watches
 * movement stays green while the defect ships.
 *
 * The event says so itself. `cancelable: true` and a read of `defaultPrevented` afterwards is the
 * whole measurement, and it works exactly where the behavioural one cannot.
 *
 * `Escape` is the control: the panel *is* allowed to take that one, so a renderer that cancelled
 * nothing at all would pass the first half of this and fail here.
 */
for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: Tab is never cancelled, and Escape still is`, async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { reactivity, dispose } = mountMdyForm(
      host,
      [{ name: "f", kind, label: "F", options: OPTIONS, searchable: true }],
      { submitLabel: null },
    );
    await reactivity.flush();

    const press = (element, key) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const everywhere = [...host.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")];
    assert.ok(everywhere.length > 0, `${kind} draws nothing to press a key on`);

    for (const phase of ["closed", "open"]) {
      // A closed control has no dialog to keep anybody in, so the exemption is the open phase's only.
      if (phase === "open" && !letsTabOut(kind)) {
        // Why a panel may keep the key, asked of the contract rather than of one kind's anatomy.
        //
        // This read `parts.actions`, which was the timepicker's own shape standing in for the rule —
        // and it agreed with the contract for exactly that kind, by coincidence. The colours panel
        // holds an action of its own without an actions bar, and when the contract moved it into the
        // family that keeps Tab, this assertion failed a correct change. ADR 0198.
        const holds = MDY_WIDGET_CONTRACTS[kind].structure.nodes.some((node) =>
          String(node.element) === "button" && node.repeated !== true
          && node.parent !== undefined && node.parent !== "root");
        assert.ok(holds,
          `${kind} declares no way out by Tab and no action of its own in the panel either, so `
          + "nothing explains why its open panel would keep the key");
        continue;
      }
      if (phase === "open") {
        const opener = host.querySelector("[aria-expanded]");
        opener?.dispatchEvent(new host.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
        await reactivity.flush();
        if (host.querySelector("[aria-expanded='true']") === null) continue;
      }
      for (const element of [...host.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")]) {
        element.focus();
        assert.equal(press(element, "Tab"), false,
          `${kind}, ${phase}: Tab was cancelled. It is already carrying the keyboard to the next `
          + "field, and a control that takes it leaves the person in a panel being torn down");
        await reactivity.flush();
      }
    }

    dispose?.();
    host.remove();
  });
}
