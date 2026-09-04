/**
 * The two families of choice React now draws: yes-or-no, and one-of-several.
 *
 * Two claims are worth a bench here, because a reading of the source asserts both and the page
 * disagrees with a reading in each case.
 *
 * **The painted mark is not one part.** A checkbox declares a single `indicator` under its caption;
 * a switch declares a `track` holding a `thumb`. A component that names the checkbox's part draws a
 * switch with an empty span where its two required parts belong — which is what the first draft of
 * this component did, and what a reading of it said was fine.
 *
 * **An option's key is not its label and not `String(value)`.** Every plain object renders through
 * `String` as `[object Object]`, so a list of object-valued choices collapses to one key: two
 * different choices become one, and selecting either marks both. The contract derives the key, and
 * for a primitive its answer and `String`'s agree exactly — which is why a fixture built on strings
 * cannot tell the two apart, and why this one is built on objects.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { MdyBooleanField, MdyOptionField, createForm, field } = await import("../dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const draw = async (Component, props, empty) => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field(empty) });
  const root = createRoot(host);
  root.render(React.createElement(Component, { field: form.f.value, label: "Given", ...props }));
  await settle();
  return { host, form, root, dispose: () => { root.unmount(); host.remove(); } };
};

/** The first class a part declares, which is what the theme keys off. */
const classOf = (kind, part) => MDY_WIDGET_CONTRACTS[kind].parts[part].classes[0];

test("each boolean kind draws the mark its own anatomy declares", async () => {
  for (const [kind, parts] of [["checkbox", ["indicator"]], ["toggle", ["track", "thumb"]]]) {
    const drawn = await draw(MdyBooleanField, { kind, widgetId: `b-${kind}` }, false);
    for (const part of parts) {
      assert.ok(
        drawn.host.querySelector(`.${classOf(kind, part)}`),
        `${kind} declares ${part} and the page has no .${classOf(kind, part)}`,
      );
    }
    // The other kind's mark is not drawn as well: a component that emitted both would satisfy the
    // check above while putting a part on the page that this kind does not declare.
    const foreign = kind === "checkbox" ? classOf("toggle", "track") : classOf("checkbox", "indicator");
    assert.equal(drawn.host.querySelector(`.${foreign}`), null, `${kind} drew ${foreign}`);
    drawn.dispose();
  }
});

test("the caption names the control it captions", async () => {
  const drawn = await draw(MdyBooleanField, { kind: "checkbox", widgetId: "b-for" }, false);
  const label = drawn.host.querySelector("label");
  const input = drawn.host.querySelector("input[type=checkbox]");
  assert.ok(input.id, "the control has no id to be named by");
  assert.equal(label.getAttribute("for"), input.id);
  drawn.dispose();
});

test("object-valued options are distinct choices, not one", async () => {
  const options = [
    { value: { id: 1 }, label: "One" },
    { value: { id: 2 }, label: "Two" },
  ];
  const drawn = await draw(MdyOptionField, { kind: "radio", widgetId: "o-obj", options }, null);
  const inputs = [...drawn.host.querySelectorAll("input[type=radio]")];
  assert.equal(inputs.length, 2);
  assert.notEqual(inputs[0].value, inputs[1].value, "both choices submit under one key");

  // Selecting the second marks the second and only the second.
  // Pressed, not assigned: React reads a radio's change from the click that caused it, so a test
  // that sets `checked` and fires a bare `change` reports "nothing happened" about a control that
  // works — a bench answering toward the wrong verdict either way.
  inputs[1].click();
  await settle();
  assert.equal(drawn.form.f.value.value(), options[1].value);
  assert.equal(drawn.host.querySelectorAll("input[type=radio]:checked").length, 1);
  drawn.dispose();
});

test("a group outside a form submits under its own id, not the field path", async () => {
  const drawn = await draw(
    MdyOptionField,
    { kind: "segmented", widgetId: "o-name", name: "answer", options: [{ value: "a", label: "A" }] },
    null,
  );
  assert.equal(drawn.host.querySelector("input[type=radio]").name, "o-name");
  drawn.dispose();

  const form = document.createElement("form");
  document.body.append(form);
  const host = document.createElement("div");
  form.append(host);
  const model = createForm({ value: field(null) });
  const root = createRoot(host);
  root.render(React.createElement(MdyOptionField, {
    field: model.f.value, kind: "segmented", widgetId: "o-name-2", name: "answer",
    options: [{ value: "a", label: "A" }],
  }));
  await settle();
  assert.equal(host.querySelector("input[type=radio]").name, "answer");
  root.unmount();
  form.remove();
});
