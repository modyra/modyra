/**
 * What leaves the browser while somebody is still typing.
 *
 * `serverValidator` is documented against Angular's `AsyncValidatorFn`, side by side, and the
 * comparison is a list of what this one does that the other does not: debounce, cancellation,
 * last-wins, timeout, cross-field reads. The one thing `AbstractControl` does and this does not is
 * absent from that table — Angular runs an async validator only once the synchronous ones pass — and
 * `mdyCva` is a documented migration path, so a consumer arrives carrying that assumption.
 *
 * Here every value reaches the validator, including the ones the field's own rules refuse. A
 * `minLength(11)` tax id asks the server about `""`, `"I"`, `"IT"`, `"IT1"` — four values the form
 * itself declares too short to be a tax id.
 *
 * Two things this is not. The debounce works: typed at speed, those keystrokes collapse into one
 * request. And `when` suppresses the calls completely, so the mechanism to stop them exists. What
 * the debounce bounds is the *rate*, not the validity — a person reading a number off a card pauses
 * between groups, every pause settles, and each settled prefix is sent.
 *
 * `when` is documented as the way to "skip the call for obviously invalid input", which asks a
 * consumer to restate in a second predicate something the field has already declared. The two drift
 * the moment one of them changes: a `minLength` raised from 3 to 5 leaves a `when` guarding the old
 * bound, and nothing reports it.
 */

import { createForm, field, minLength, required, serverValidator } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Type `text` one character at a time, pausing long enough for each keystroke to settle.
 *
 * The pause is what a person does between the groups of a number they are reading off a card, and it
 * is what makes each prefix a value the engine considers final rather than one still being typed.
 */
async function typedWithPauses(text, rules, options) {
  const asked = [];
  const form = createForm(
    {
      taxId: field("", rules, serverValidator(async (value) => {
        asked.push(value);
        return null;
      }, options)),
    },
    { devWarnings: false },
  );

  const debounce = options.debounceMs ?? 0;
  await settled(debounce + 80);
  let sofar = "";
  for (const character of text) {
    sofar += character;
    form.f.taxId.set(sofar);
    await settled(debounce + 120);
  }
  await settled(debounce + 150);
  form.destroy();
  return asked;
}

battle(
  {
    claims: ["VAL-005"],
    title: "a value the field's own rules refuse is not sent to a server",
    environments: ["node"],
  },
  async (ctx) => {
    const rules = [required(), minLength(11)];
    const options = { debounceMs: 120 };

    const asked = await typedWithPauses("IT12", rules, options);
    ctx.log.note("what a minLength(11) field sent while four characters were typed", { asked });

    // The control: the debounce is doing its job, so what follows is about which values are sent
    // rather than about a validator that runs on every keystroke unconditionally.
    const typedFast = [];
    const fast = createForm(
      {
        taxId: field("", rules, serverValidator(async (value) => {
          typedFast.push(value);
          return null;
        }, { debounceMs: 400 })),
      },
      { devWarnings: false },
    );
    let sofar = "";
    for (const character of "IT1234567") {
      sofar += character;
      fast.f.taxId.set(sofar);
      await settled(40);
    }
    await settled(600);
    fast.destroy();
    ctx.log.note("the same field typed at speed", { asked: typedFast });

    expectClaim(typedFast.length < 4, {
      claimIds: ["VAL-005"],
      what: "the debounce did not collapse fast typing, so this battle measures the debounce rather than the gate",
      detail: JSON.stringify(typedFast),
    });

    // The second control: `when` stops every one of them, so a gate is reachable and the assertion
    // below is about the default rather than about something the engine cannot express.
    const guarded = await typedWithPauses("IT12", rules, {
      ...options,
      when: (value) => value.length >= 11,
    });
    expectEqual(guarded, [], {
      claimIds: ["VAL-005"],
      what: "`when` did not suppress the calls, so there is no gate to compare the default against",
    });

    // And the finding: every value that reached the server is one the field's own rules refuse.
    const refusedByTheForm = asked.filter((value) => value.length < 11);
    expectEqual(refusedByTheForm, [], {
      claimIds: ["VAL-005"],
      what: "values the field's own minLength refuses were sent to a server anyway",
      detail: `a tax id field asked about ${JSON.stringify(asked)} while somebody was still typing it`,
    });
  },
);
