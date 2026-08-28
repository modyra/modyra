/**
 * A required field nobody has reached does not call itself wrong.
 *
 * ADR 0165: `aria-invalid` is a verdict on an act, not a state. Empty and never touched contains
 * nothing — it is not wrong, it is not filled in yet, and `required` is the word for that. Twenty
 * required fields announcing themselves invalid to somebody tabbing through to learn what a form
 * asks spends the word before the first real error arrives.
 *
 * Asked of every kind, because the rule is the contract's and not one kind's: two doors existed for
 * the same question here — one that filters refusals by whether the field is out of play, and one
 * that also asks whether anybody has been at it — and a control could reach for either. On a
 * touched field they agree, which is why the wrong one survived.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");

/**
 * Kinds that can be required *and* empty, so that "nobody has reached it" is a state they can be in.
 *
 * A slider always holds a number and a toggle always holds a boolean: `required` can never fail on
 * either, so a row for them would be green because the state is unreachable rather than because the
 * renderer answered.
 */
const NEVER_EMPTY = new Set(["slider", "toggle", "number"]);

for (const kind of fixture.KINDS.filter((one) => !NEVER_EMPTY.has(one))) {
  test(`${kind}: required and unreached, it does not say anything is wrong`, async () => {
    const mounted = await fixture.mount(kind);
    await mounted.settle();

    const said = [...mounted.root.querySelectorAll("[aria-invalid]")]
      .map((element) => element.getAttribute("aria-invalid"));
    assert.deepEqual(said.filter((one) => one === "true"), [],
      `${kind} calls itself wrong before anybody has reached it. Empty is not wrong — ADR 0165`);

    // The perimeter. Without it this passes just as well against a renderer that never writes the
    // attribute at all, and silence would be read as correctness.
    mounted.drive("invalid");
    await mounted.settle();
    const afterwards = [...mounted.root.querySelectorAll("[aria-invalid]")]
      .map((element) => element.getAttribute("aria-invalid"));
    assert.ok(afterwards.includes("true"),
      `${kind} never says a field is wrong, so the check above asserts nothing`);

    mounted.dispose();
  });
}
