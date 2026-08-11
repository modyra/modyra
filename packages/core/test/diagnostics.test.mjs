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
import { createForm, field, group, pattern, required } from "../dist/index.js";

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
