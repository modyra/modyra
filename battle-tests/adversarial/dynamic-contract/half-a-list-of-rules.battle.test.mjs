/**
 * A list of rules that stopped halfway and left what it had already done.
 *
 * The parser's promise for a document is all-or-nothing, and it is stated: strict mode *returns
 * nothing at all when any diagnostic exists — a partly valid document is never accepted*. That is
 * what makes acceptance mean something.
 *
 * `applyDynamicRules` is the engine-side half of the same journey and does not carry that property.
 * It walks the list in order and throws at the first rule it cannot apply, leaving every rule before
 * it live and every rule after it absent. A caller that handled the error is holding a form that is
 * neither ruled nor unruled, with nothing to tell it which rules took.
 *
 * The refusal itself is right: a target of `__proto__` is refused by name rather than written, and
 * `Object.prototype` is untouched after every case here. What is missing is the undo.
 *
 * The claim cited is the dynamic contract's alone. The two security checks here — the reserved path
 * refused by name, the prototype untouched — both hold, and citing them would report this at the
 * severity of a promise that is being kept.
 *
 * Reported rather than enforced: the throw is loud, the caller can discard the form, and nothing
 * leaves that should not. It is filed because "some of your rules are in effect" is a state no
 * consumer can inspect, and because the parser's own answer to the same question is the opposite.
 */

import { applyDynamicRules, buildDynamicFormSchema, createForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const document = {
  node: "group",
  children: {
    a: { node: "field", field: { kind: "text", label: "A" } },
    b: { node: "field", field: { kind: "text", label: "B" } },
    c: { node: "field", field: { kind: "text", label: "C" } },
  },
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 90));

/** A rule that switches one field off when `a` is "x". */
const off = (target) => ({ effect: "hidden", target, when: { field: "a", operator: "equals", value: "x" } });

/** Which fields a form still sends, after a list of rules was handed to it. */
async function sendsAfter(rules) {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  let threw = false;
  try {
    applyDynamicRules(form, rules);
  } catch {
    threw = true;
  }
  form.patchValue({ a: "x", b: "B", c: "C" });
  await settled();
  const sends = Object.keys(form.submitValue()).sort();
  form.destroy();
  return { threw, sends };
}

battle(
  {
    claims: ["DYN-001"],
    title: "a list of rules is applied whole or not at all",
    environments: ["node"],
    open: "reported, not enforced: finding 162, open in battle-tests/reports/open-findings.md",
  },
  async (ctx) => {
    // The control: a list with nothing wrong with it applies all of it.
    const whole = await sendsAfter([off("b"), off("c")]);
    ctx.log.note("a list with nothing wrong with it", whole);

    expectEqual(whole, { threw: false, sends: ["a"] }, {
      claimIds: ["DYN-001"],
      what: "a good list of rules did not apply, so nothing below is a measurement",
    });

    // And the refusal that stops the list, which is right in itself: the reserved path is refused by
    // name rather than written.
    const stopped = await sendsAfter([off("b"), off("__proto__"), off("c")]);
    ctx.log.note("a list with one rule that cannot be applied", stopped);

    expectClaim(stopped.threw === true, {
      claimIds: ["DYN-001"],
      what: "a rule targeting a reserved path was applied instead of refused, so the stop below is not the one this battle measures",
    });

    expectClaim(Object.getPrototypeOf({}) === Object.prototype, {
      claimIds: ["DYN-001"],
      what: "the prototype was touched by a rule naming it",
    });

    // The form is left where the walk stopped: `b` switched off, `c` never reached.
    const untouched = await sendsAfter([off("__proto__"), off("b"), off("c")]);
    ctx.log.note("the same list with the bad rule first", untouched);

    expectEqual(untouched.sends, ["a", "b", "c"], {
      claimIds: ["DYN-001"],
      what: "a list that failed on its first rule still applied something",
    });

    // So the question is only whether the half that ran can be undone, and it is the same question
    // strict mode answers "no partial acceptance" for a document.
    expectEqual(stopped.sends, ["a", "b", "c"], {
      claimIds: ["DYN-001"],
      what: `a list that threw left ${JSON.stringify(stopped.sends)} sending: the rules before the failure stayed in effect and the ones after never ran`,
    });

    // The contrast, in the repository rather than in this file's opinion: the parser refuses the
    // whole document for one bad rule.
    const parsed = parseDynamicForm({
      version: 2,
      id: "f",
      fields: [{ name: "a", kind: "text", label: "A" }, { name: "b", kind: "text", label: "B" }],
      rules: [
        { effect: "hidden", target: "b", when: { field: "a", operator: "equals", value: "x" } },
        { effect: "sparkle", target: "b", when: { field: "a", operator: "equals", value: "x" } },
      ],
    }, { mode: "strict" });

    expectClaim(parsed.ok === false && parsed.rules.length === 0, {
      claimIds: ["DYN-001"],
      what: "the parser kept part of a rule list, so the two halves of the journey agree after all",
      detail: JSON.stringify({ ok: parsed.ok, kept: parsed.rules.length }),
    });
  },
);
