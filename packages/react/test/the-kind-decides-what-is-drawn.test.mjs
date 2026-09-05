/**
 * React's text-like control draws what the contract declares, not what the component remembers.
 *
 * The first version of this component built the input by hand — id, value, handlers — and produced
 * an email field with **no `type` and no ARIA at all**: the projection names that part `input`, and
 * a component looking for `control` found nothing and silently drew a bare box. Nothing crashed, and
 * a reading of the source would have said it was fine.
 *
 * So what is asserted here is what the projection carries, read from the contract rather than
 * spelled: the native input the kind declares, the relations that make the control findable, and the
 * label pointing at the thing a person operates.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { MdyTextField, createForm, field } = await import("../dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const draw = async (kind, props = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field(kind === "number" ? null : "") });
  const root = createRoot(host);
  root.render(React.createElement(MdyTextField, {
    field: form.f.value, kind, label: "Given", widgetId: `t-${kind}`, ...props,
  }));
  await settle();
  return { host, form, dispose: () => { root.unmount(); host.remove(); } };
};

for (const kind of ["text", "email", "password", "number"]) {
  test(`${kind}: asks the platform for the input the contract declares`, async () => {
    const declared = MDY_WIDGET_CONTRACTS[kind].controlType;
    assert.ok(declared, `${kind} declares no controlType, so this test asserts nothing`);

    const { host, dispose } = await draw(kind);
    const control = host.querySelector("input, textarea");

    assert.ok(control, "the component drew no control at all");
    assert.equal(control.getAttribute("type"), declared,
      `a ${kind} field asked for "${control.getAttribute("type")}" instead of "${declared}"`);
    dispose();
  });
}

test("textarea is drawn as the element its anatomy declares", async () => {
  // Not an input with a different type: the catalogue says this kind's control is a `textarea`, and
  // that is a different element rather than a different attribute.
  const { host, dispose } = await draw("textarea");
  assert.ok(host.querySelector("textarea"), "a textarea field drew something that is not a textarea");
  dispose();
});

test("the control carries the relations that make it findable", async () => {
  const { host, dispose } = await draw("email");
  const control = host.querySelector("input");
  const label = host.querySelector("label");

  // The half the hand-built version lost silently: an input with none of these is still an input,
  // and still reads as a working field to anyone looking at the page.
  assert.equal(label.getAttribute("for"), control.getAttribute("id"),
    "the caption names something other than the control");

  // And the reference that is *not* owed here. This field has no supporting text and no rule it can
  // fail, so there is nothing to describe it by: naming an empty element asserts a description that
  // does not exist and sends a reader somewhere to hear nothing. Silence is the honest answer, and
  // it is the one that keeps "I have a description, and it is empty" from reading like "I have one".
  const describedBy = control.getAttribute("aria-describedby");
  if (describedBy !== null) {
    const named = describedBy.split(/\s+/).filter(Boolean)
      .map((id) => host.ownerDocument.getElementById(id));
    assert.ok(named.every((element) => element !== null),
      `aria-describedby points at ${describedBy}, which is not on the page`);
    assert.ok(named.some((element) => (element.textContent ?? "").trim() !== ""),
      "the control names a description that holds no text");
  }
  dispose();
});

test("a host that gives no id still gets one that holds still", async () => {
  // React can name a widget itself, which Vue cannot: `useId` survives a re-render and matches
  // between server and client. What matters is that it is stable — an id regenerated per render
  // breaks every relation that points at it.
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field("") });
  const root = createRoot(host);
  const draw = () => root.render(React.createElement(MdyTextField, { field: form.f.value, kind: "text", label: "Given" }));

  draw();
  await settle();
  const first = host.querySelector("input").getAttribute("id");
  draw();
  await settle();

  assert.ok(first, "no id was generated at all");
  assert.equal(host.querySelector("input").getAttribute("id"), first, "the id changed between renders");
  root.unmount();
  host.remove();
});
