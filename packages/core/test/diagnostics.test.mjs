/**
 * What the library says when a mechanism cannot decide for you.
 *
 * Each of these is a place where the code does the right thing and the developer has no way to see
 * it: a binding that cannot win, a constraint that cannot be offered, a predicate that cannot be
 * trusted. Every one is asserted **in both directions** — a warning that also fires in the ordinary
 * case is noise, and noise gets switched off along with everything useful.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_ASYNC_FEATURE_DISABLED, createForm, field, group, pattern, required, vanillaReactivity } from "../dist/index.js";

/** Runs `body` with console.warn captured. */
function warnings(body) {
  const said = [];
  const original = console.warn;
  console.warn = (...args) => said.push(args.join(" "));
  try {
    body();
  } finally {
    console.warn = original;
  }
  return said;
}

test("a binding that cannot put a field back in play says so", () => {
  const said = warnings(() => {
    const form = createForm({
      kind: field("private"),
      company: group({ vat: field("") }, { when: (_s, form) => form.kind === "company" }),
    });
    form.setDisabled("company.vat", () => false);
  });

  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /company\.vat/);
  assert.match(said[0], /condition in the schema/);
});

test("and stays quiet when the field is in play", () => {
  const said = warnings(() => {
    const form = createForm({
      kind: field("company"),
      company: group({ vat: field("") }, { when: (_s, form) => form.kind === "company" }),
    });
    form.setDisabled("company.vat", () => true);
  });

  assert.deepEqual(said, [], "a binding on an active field is ordinary, and ordinary is silent");
});

test("two patterns on one field say why neither reaches the control", () => {
  const said = warnings(() => {
    const form = createForm({ code: field("", [pattern(/^[A-Z]+$/), pattern(/^.{3}$/)]) });
    form.getField("code")().constraints();
  });

  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /more than one pattern/);
});

test("one pattern says nothing at all", () => {
  const said = warnings(() => {
    const form = createForm({ code: field("", [pattern(/^[A-Z]+$/), required()]) });
    // Wrapped: the constraint is the rule said the way an implicitly anchored attribute reads one.
    assert.equal(form.getField("code")().constraints().pattern, "^[A-Z]+$");
  });

  assert.deepEqual(said, []);
});

test("a `when` that cannot agree with itself is reported", () => {
  const said = warnings(() => {
    let calls = 0;
    const form = createForm({ a: field("x", [], { when: () => calls++ % 2 === 0 }) });
    form.getField("a")().disabled();
  });

  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /pure function/);
});

test("a `when` that is a function of its arguments is not", () => {
  const said = warnings(() => {
    const form = createForm({
      kind: field("simple"),
      note: field("", [], { when: (_value, form) => form.kind === "detailed" }),
    });
    form.getField("note")().disabled();
    form.f.kind.set("detailed");
    form.getField("note")().disabled();
  });

  assert.deepEqual(said, []);
});

test("silence is available: devWarnings turns the whole set off", () => {
  const said = warnings(() => {
    const form = createForm(
      {
        kind: field("private"),
        company: group({ vat: field("") }, { when: (_s, form) => form.kind === "company" }),
      },
      { devWarnings: false },
    );
    form.setDisabled("company.vat", () => false);
  });

  assert.deepEqual(said, []);
});

test("a form reports what it could not do to the sink it was given", async () => {
  // The codes and the sinks were published and nothing took one: the only option accepting an
  // `MdyDiagnostics` lived in one adapter's reactivity, so a consumer who read that surface built a
  // sink, named the codes they cared about, and waited for something that could never arrive.
  const rx = vanillaReactivity();
  const withoutEffects = {
    signal: rx.signal.bind(rx),
    computed: rx.computed.bind(rx),
    untracked: rx.untracked.bind(rx),
  };
  const reports = [];

  const form = createForm(
    { a: field("", [], { asyncValidators: [async () => []] }) },
    {
      reactivity: withoutEffects,
      diagnostics: { report: (entry) => reports.push(entry) },
      devWarnings: false,
    },
  );
  form.f.a.set("x");
  await new Promise((resolve) => setTimeout(resolve, 40));

  // A check that cannot run is skipped — documented and right — and every surface an application
  // reads says the same thing either way: valid, submittable, no errors. The code is what tells the
  // two apart, and `devWarnings: false` proves it is not the console channel answering.
  assert.deepEqual(reports.map((entry) => entry.code), [MDY_ASYNC_FEATURE_DISABLED]);
  assert.match(reports[0].message, /effect-capable reactivity/);
  assert.equal(form.state.valid(), true, "the skipped check leaves the form looking exactly as it did");
  form.destroy();
});

test("a sink takes the place of the console rather than doubling it", async () => {
  const said = [];
  const realWarn = console.warn;
  console.warn = (...parts) => said.push(parts.join(" "));
  try {
    const rx = vanillaReactivity();
    const withoutEffects = {
      signal: rx.signal.bind(rx),
      computed: rx.computed.bind(rx),
      untracked: rx.untracked.bind(rx),
    };
    const reports = [];
    const form = createForm(
      { a: field("", [], { asyncValidators: [async () => []] }) },
      { reactivity: withoutEffects, diagnostics: { report: (e) => reports.push(e) }, devWarnings: true },
    );
    form.f.a.set("x");
    await new Promise((resolve) => setTimeout(resolve, 40));
    form.destroy();

    // A consumer holding a sink asked for these as events. Printing them as well duplicates every
    // degradation into a channel they did not ask for.
    assert.equal(reports.length, 1);
    assert.deepEqual(said.filter((line) => line.includes("effect-capable")), []);
  } finally {
    console.warn = realWarn;
  }
});
