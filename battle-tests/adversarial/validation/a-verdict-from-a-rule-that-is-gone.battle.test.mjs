/**
 * An async validator removed, and the verdict it is not allowed to leave behind.
 *
 * `VAL-001` is that the latest applicable async validation result wins. A result from a validator that
 * has been removed is not applicable at all — there is no rule left to have an opinion — so the field
 * has to stop carrying it, and it does:
 *
 *     upsertAsyncValidators("a", "k", [async () => ["the first"]])   errors: ["the first"]
 *     removeValidators("a", "k")                                     errors: []
 *     upsertAsyncValidators("a", "k", [async () => []])              errors: []
 *     upsertAsyncValidators("a", "k", [async () => ["the second"]])  errors: ["the second"]
 *
 * All three hold. The battle exists because the removal path is the one with nothing else to catch it:
 * a stale verdict there is a field invalid on account of a rule that does not exist, and nothing a
 * person does clears it except changing the value — which is the one thing they may have no reason to
 * do. A form that attaches a server check while a mode is on and removes it when the mode goes off is
 * the ordinary way to reach that.
 *
 * The second battle is the behaviour the first is measured against: a live validator answers for the
 * value the field holds now, and runs again when it changes. Without it, a repair that stopped async
 * validation altogether would satisfy the first.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));
const messagesAt = (form, path) => form.errorsFor(path)().map((each) => each.message ?? each.kind);

battle(
  {
    claims: ["VAL-001", "API-001"],
    title: "an error from an async validator that was removed does not outlive it",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ a: field("v") }, { devWarnings: false });
    try {
      form.upsertAsyncValidators("a", "k", [async () => ["the first"]]);
      await settled();
      const decided = messagesAt(form, "a");

      // The control: the validator really did run and really did refuse, so what follows is about
      // removal rather than about a check that never happened.
      expectEqual(decided, ["the first"], {
        claimIds: ["VAL-001"],
        what: "the async validator did not refuse the value, so there is no verdict for a removal to outlive",
      });

      form.removeValidators("a", "k");
      const rightAfter = messagesAt(form, "a");
      await settled();
      const afterEverythingRan = messagesAt(form, "a");
      ctx.log.note("what the field says once the rule is gone", { decided, rightAfter, afterEverythingRan });

      expectEqual(afterEverythingRan, [], {
        claimIds: ["VAL-001", "API-001"],
        what: "a field kept an async error from a validator it no longer has, so it is invalid because of a rule that does not exist and nothing but a new value clears it",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["VAL-001"],
    title: "a value change is what a live async validator answers",
    environments: ["node"],
  },
  async (ctx) => {
    // Not a finding — the behaviour the one above is measured against. An async check runs when the
    // value changes, and the newest verdict replaces the last. Held so that a repair to removal that
    // stopped async validation altogether would be seen.
    const form = createForm({ a: field("v") }, { devWarnings: false });
    try {
      let runs = 0;
      form.upsertAsyncValidators("a", "k", [async (value) => { runs += 1; return String(value) === "ok" ? [] : ["not ok"]; }]);
      await settled();
      const first = messagesAt(form, "a");

      form.f.a.set("ok");
      await settled();
      const second = messagesAt(form, "a");
      ctx.log.note("a live validator, twice", { first, second, runs });

      expectEqual([first, second], [["not ok"], []], {
        claimIds: ["VAL-001"],
        what: "a live async validator did not answer for the value the field holds now",
      });
      expectClaim(runs >= 2, {
        claimIds: ["VAL-001"],
        what: "the validator did not run for the second value, so the verdicts above were not both its own",
        detail: JSON.stringify({ runs }),
      });
    } finally {
      form.destroy();
    }
  },
);
