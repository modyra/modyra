/**
 * An option spelled wrong, on a form and on a field.
 *
 * `createForm` reads its options and says so when it is handed one it does not know:
 * *"[modyra] createForm was given \"autoActivte\", which it does not read"*. The decision that a
 * misspelled option should be reported has already been taken, in this repository, for this reason.
 *
 * `field()` does not do it. Measured:
 *
 *   createForm({ autoActivte: false })      reported by name
 *   createForm({ validaters: [...] })       reported by name
 *   createForm({ securty: {...} })          reported by name
 *   field("", [], { asyncDebounce: 300 })   nothing
 *   field("", [], { requred: true })        nothing
 *   field("", [], { sanitise: "strict" })   nothing
 *
 * The last line is the one with teeth, and the contrast inside that single option is the finding:
 *
 *   sanitize: "strict"    the value is sanitized — `<b>x</b>` becomes `bx/b`
 *   sanitize: "stict"     REFUSED, by name, at construction
 *   sanitise: "strict"    built, `<b>x</b>` kept whole, nothing said
 *
 * A wrong **value** is caught immediately and loudly. A wrong **key** — and `sanitise` is the
 * British spelling, which is the most ordinary way to get it wrong — passes, and leaves a field
 * unsanitized while its author believes otherwise. `asyncDebounce` for `asyncDebounceMs` is the same
 * shape with a different cost: every keystroke reaches the server.
 *
 * This battle asserts the rule the form half already follows: an option the contract does not
 * declare is reported. It does not ask for a throw — `createForm` warns, and warning is enough.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Misspellings of options the contract really has, each one keystroke away from the real name. */
const FIELD_TYPOS = Object.freeze([
  { spelled: "asyncDebounce", meant: "asyncDebounceMs", value: 300 },
  { spelled: "asyncTimeout", meant: "asyncTimeoutMs", value: 500 },
  { spelled: "sanitise", meant: "sanitize", value: "strict" },
  { spelled: "sensative", meant: "sensitive", value: true },
]);

const FORM_TYPOS = Object.freeze([
  { spelled: "autoActivte", meant: "autoActivate", value: false },
  { spelled: "validaters", meant: "validators", value: [] },
]);

/** Builds a form while listening for what the framework says about it. */
function saidAbout(build) {
  const said = [];
  const original = console.warn;
  console.warn = (...args) => said.push(String(args[0] ?? ""));
  try {
    const form = build();
    form.destroy?.();
  } catch (error) {
    said.push(`threw: ${String(error?.message ?? error)}`);
  } finally {
    console.warn = original;
  }
  return said;
}

battle(
  {
    claims: ["API-001", "SEC-003"],
    title: "an option the contract does not declare is reported, on a field as on a form",
    environments: ["node"],
  },
  async (ctx) => {
    const onForm = FORM_TYPOS.map((typo) => ({
      ...typo,
      said: saidAbout(() => createForm({ x: field("") }, { devWarnings: true, [typo.spelled]: typo.value })),
    }));
    const onField = FIELD_TYPOS.map((typo) => ({
      ...typo,
      said: saidAbout(() =>
        createForm({ x: field("", [], { [typo.spelled]: typo.value }) }, { devWarnings: true }),
      ),
    }));
    ctx.log.note("what the framework says about a misspelled option", { onForm, onField });

    // The control, and it is what makes this a gap rather than a policy: the form half already does
    // it, naming the option it did not read.
    expectClaim(
      onForm.every((entry) => entry.said.some((line) => line.includes(entry.spelled))),
      {
        claimIds: ["API-001"],
        what: "a misspelled form option is not reported either, so this is a policy rather than a gap",
        detail: JSON.stringify(onForm),
      },
    );

    // And the sharp end, measured rather than argued: the same option refuses a wrong value and
    // accepts a wrong key, leaving the field unsanitized.
    const withKeyTypo = createForm({ x: field("", [], { sanitise: "strict" }) }, { devWarnings: true });
    const withCorrectKey = createForm({ x: field("", [], { sanitize: "strict" }) }, { devWarnings: true });
    try {
      withKeyTypo.f.x.set("<b>x</b>");
      withCorrectKey.f.x.set("<b>x</b>");
      const held = { typo: withKeyTypo.getValue().x, correct: withCorrectKey.getValue().x };
      ctx.log.note("what each spelling leaves in the field", held);

      expectClaim(held.correct !== "<b>x</b>", {
        claimIds: ["SEC-003"],
        what: "the correctly spelled sanitizer did nothing, so the probe is wrong before the contract is",
        detail: JSON.stringify(held),
      });
    } finally {
      withKeyTypo.destroy();
      withCorrectKey.destroy();
    }

    expectEqual(
      onField.filter((entry) => !entry.said.some((line) => line.includes(entry.spelled))).map((entry) => entry.spelled),
      [],
      {
        claimIds: ["API-001", "SEC-003"],
        what: "a field option the contract does not declare was accepted in silence, so an author who misspells one gets no debounce, no timeout, or no sanitizer and is never told",
      },
    );
  },
);
