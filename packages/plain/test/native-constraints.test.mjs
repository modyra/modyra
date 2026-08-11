/**
 * A rule declares what it enforces, and the control offers it.
 *
 * Stated twice — once as a validator, once on the control — the two are free to disagree, and
 * nothing checks that they don't. Stated once, the keyboard and the verdict cannot drift apart.
 *
 * The boundary is the model: an attribute constrains typing. A value that arrives from anywhere
 * else is kept whole and judged by the rules, which is the same promise ADR 0029 makes for a value
 * a widget cannot show.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, compose, email, integer, max, maxLength, min, minLength, pattern, required, vanillaReactivity } =
  await import("@modyra/core");

const host = () => {
  document.body.innerHTML = "";
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

const render = (config, handle, rx) => {
  const container = host();
  renderField(container, config, handle, rx);
  return container.querySelector("input") ?? container.querySelector("textarea");
};

test("a length rule reaches the input", () => {
  const rx = vanillaReactivity();
  const form = createForm({ note: field("", [minLength(3), maxLength(50)]) }, { reactivity: rx });

  const input = render({ name: "note", kind: "text", label: "Note" }, form.f.note, rx);

  assert.equal(input.getAttribute("maxlength"), "50");
  assert.equal(input.getAttribute("minlength"), "3");
});

test("a pattern reaches the input, unless two rules disagree about it", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    {
      code: field("", [pattern(/^[A-Z]{3}$/)]),
      both: field("", [pattern(/^[A-Z]+$/), pattern(/^\d+$/)]),
    },
    { reactivity: rx },
  );

  assert.equal(render({ name: "code", kind: "text", label: "Code" }, form.f.code, rx).getAttribute("pattern"), "^[A-Z]{3}$");
  assert.equal(
    render({ name: "both", kind: "text", label: "Both" }, form.f.both, rx).getAttribute("pattern"),
    null,
    "an input carries one pattern, and inventing their intersection would be a rule nobody wrote",
  );
});

test("a numeric rule reaches the input, integer included", () => {
  const rx = vanillaReactivity();
  const form = createForm({ qty: field(0, [integer(), min(0), max(255)]) }, { reactivity: rx });

  const input = render({ name: "qty", kind: "number", label: "Qty" }, form.f.qty, rx);

  assert.equal(input.getAttribute("min"), "0");
  assert.equal(input.getAttribute("max"), "255");
  assert.equal(input.getAttribute("step"), "1", "a whole number moves by one");
});

test("a composed rule declares what it combines", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { note: field("", [compose(required(), maxLength(10))]) },
    { reactivity: rx },
  );

  const input = render({ name: "note", kind: "text", label: "Note" }, form.f.note, rx);

  assert.equal(input.getAttribute("maxlength"), "10");
  assert.equal(form.getField("note")().required(), true, "and it still marks the field required");
});

test("what a kind cannot carry, it does not carry", () => {
  const rx = vanillaReactivity();
  const form = createForm({ note: field("", [maxLength(10), pattern(/^a+$/)]) }, { reactivity: rx });

  const area = render({ name: "note", kind: "textarea", label: "Note" }, form.f.note, rx);

  assert.equal(area.getAttribute("maxlength"), "10");
  assert.equal(area.getAttribute("pattern"), null, "the platform ignores pattern on a textarea");
});

test("the attribute constrains typing, never the model", () => {
  const rx = vanillaReactivity();
  const form = createForm({ note: field("", [maxLength(5)]) }, { reactivity: rx });

  const input = render({ name: "note", kind: "text", label: "Note" }, form.f.note, rx);
  assert.equal(input.getAttribute("maxlength"), "5");

  // A draft coming back, a server response, a scripted set: all of these are the model's business.
  form.f.note.set("far longer than five");

  assert.equal(form.value().note, "far longer than five", "kept whole");
  assert.equal(form.getField("note")().valid(), false, "and judged by the rule");
});

test("a field with no rules carries no constraint at all", () => {
  const rx = vanillaReactivity();
  const form = createForm({ note: field("") }, { reactivity: rx });

  const input = render({ name: "note", kind: "text", label: "Note" }, form.f.note, rx);

  for (const name of ["maxlength", "minlength", "pattern", "min", "max", "step"]) {
    assert.equal(input.getAttribute(name), null, `${name} was invented`);
  }
});

test("email declares the type of keyboard it wants", () => {
  const rx = vanillaReactivity();
  const form = createForm({ address: field("", [email()]) }, { reactivity: rx });

  const input = render({ name: "address", kind: "email", label: "Email" }, form.f.address, rx);

  assert.equal(input.getAttribute("inputmode"), "email");
});
