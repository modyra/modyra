/**
 * Two guides that still describe what `setValue` used to do.
 *
 * ADR 0057 changed it and said so in its own consequences: *`setValue({})` no longer empties a field
 * to `null` but returns it to its initial.* The rule it replaced that with is stated there too — *a
 * field a whole value does not name returns to its initial*, which is what `reset()` already does and
 * a state the form could have started in.
 *
 * Two published guides still say the old thing:
 *
 *     troubleshooting.md   "fields absent from the passed object are reset to `null`"
 *     typed-forms.md       "schema fields absent from `v` are reset to `null`"
 *
 * The first is the more expensive, because it is filed under *Why did my value reset to null after
 * `setValue()`?* — a person reads it while already confused, is told to look for a `null`, and finds
 * `"pro"`. The behaviour is right; the page that explains the behaviour is a version behind.
 *
 * This is the same species as the refusal that advised `Pass {} to empty the form`: one sentence
 * describing the world before a decision. That one was repaired where it was written, in the message.
 * These two were not.
 *
 * The check is anchored to the behaviour rather than to wording: it fails only while a guide claims
 * `null` *and* the engine returns the initial. Rewriting the sentence satisfies it; so would changing
 * the engine, which ADR 0057 decided against.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const GUIDES = resolve(HERE, "..", "..", "..", "docs", "guides");

const settled = () => new Promise((resolve) => setTimeout(resolve, 70));

/** A sentence claiming absent fields go to null, in whatever wording. */
const CLAIMS_NULL = /absent[^.]{0,80}reset to `null`/i;

battle(
  {
    claims: ["SUB-001", "DYN-001"],
    title: "the pages that explain a whole-value write describe the write it performs",
    environments: ["node"],
  },
  async (ctx) => {
    // What it does, with initials that are not null so the two answers are distinguishable — which
    // they are not on a form whose every field starts empty, and that is why the sentence survived.
    const form = createForm(
      { plan: field("pro"), note: field(""), n: field(7) },
      { devWarnings: false },
    );
    form.f.plan.set("enterprise");
    form.f.note.set("typed");
    form.f.n.set(99);
    await settled();

    // The control: the form is somewhere the user put it, so what the write does is visible.
    expectEqual(form.getValue(), { plan: "enterprise", note: "typed", n: 99 }, {
      claimIds: ["SUB-001"],
      what: "the form was not where this battle needs it before the write",
    });

    form.setValue({ note: "kept" });
    await settled();
    const after = form.getValue();
    form.destroy();
    ctx.log.note("after a whole value naming one of three fields", after);

    expectEqual(after, { plan: "pro", note: "kept", n: 7 }, {
      claimIds: ["SUB-001"],
      what: "a field the whole value did not name went somewhere other than its initial",
    });

    // And the pages that explain it. Anchored to the behaviour: this only fails while a guide says
    // `null` and the engine says the initial.
    // The whole file rather than line by line: one of the two sentences is wrapped across a newline,
    // and a check that reads a line at a time would find the other and call the page clean.
    const saying = [];
    for (const name of ["troubleshooting.md", "typed-forms.md"]) {
      const text = readFileSync(join(GUIDES, name), "utf8").replace(/\s+/g, " ");
      const found = CLAIMS_NULL.exec(text);
      if (found !== null) saying.push({ guide: name, says: found[0].slice(0, 96) });
    }
    ctx.log.note("what the guides say a whole-value write does", { saying });

    expectEqual(saying, [], {
      claimIds: ["DYN-001", "SUB-001"],
      what: "a published guide says a whole-value write resets absent fields to null, and it returns them to their initial",
      detail: JSON.stringify(saying, null, 1),
    });

    // The control on the check itself: the phrase it looks for is one the guides could plausibly
    // carry, so an empty result means the sentence is gone rather than that the pattern never matched
    // anything. A file that does not exist would fail the read above.
    expectClaim(CLAIMS_NULL.test("fields absent from the passed object are reset to `null`."), {
      claimIds: ["DYN-001"],
      what: "the pattern this battle searches for no longer matches the sentence it was written for",
    });
  },
);

battle(
  {
    claims: ["PER-002", "SUB-001"],
    title: "reset puts back the initials and takes away everything a submit left",
    environments: ["node"],
  },
  async (ctx) => {
    // The same table's `reset()` row, which makes three promises in one line: *back to the schema
    // initial values; clears touched/dirty and the last submit errors*. The third is the one nothing
    // held — a server's refusal surviving a reset would leave a form that looks answered-for and
    // is not.
    const form = createForm({ a: field("start"), b: field("other") }, { devWarnings: false });
    form.f.a.set("typed");
    form.f.a.markAsTouched();
    form.f.a.markAsDirty();
    await settled();
    await form.submit(() => [
      { path: "a", message: "the server said no" },
      { path: null, message: "and this too" },
    ]);
    await settled();

    const before = {
      value: form.getValue(),
      touched: form.f.a.touched(),
      dirty: form.f.a.dirty(),
      onField: form.errorsFor("a")().map((each) => each.message),
      onForm: form.errorsFor("")().map((each) => each.message),
      lastSubmit: form.state.lastSubmitErrors().length,
    };
    ctx.log.note("before the reset", before);

    // The control: all three things the row promises to clear are present, so clearing them means
    // something.
    expectEqual(
      [before.touched, before.dirty, before.onField.length + before.onForm.length, before.lastSubmit],
      [true, true, 2, 2],
      {
        claimIds: ["SUB-001"],
        what: "the form did not carry what this battle needs it to carry before the reset",
        detail: JSON.stringify(before),
      },
    );

    form.reset();
    await settled();
    const after = {
      value: form.getValue(),
      touched: form.f.a.touched(),
      dirty: form.f.a.dirty(),
      onField: form.errorsFor("a")().map((each) => each.message),
      onForm: form.errorsFor("")().map((each) => each.message),
      lastSubmit: form.state.lastSubmitErrors().length,
    };
    form.destroy();
    ctx.log.note("after the reset", after);

    expectEqual(after, {
      value: { a: "start", b: "other" },
      touched: false,
      dirty: false,
      onField: [],
      onForm: [],
      lastSubmit: 0,
    }, {
      claimIds: ["PER-002", "SUB-001"],
      what: "reset left behind a value, a flag, or an error a submit had put there",
    });
  },
);
