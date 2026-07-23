// Proves the side-by-side snippet in comparison-formik.md: build the same
// two-field form in Formik and in Modyra with equivalent validation rules,
// drive both through the same sequence of values via each library's own
// programmatic API (Formik's setFieldValue, Modyra's set()), and assert
// they agree on every invalid -> valid transition. Same pattern as
// packages/angular/src/lib/core/comparison-reactive-forms.spec.ts and
// docs/examples/rhf-migration, ported to a real jsdom + react-dom root
// since hooks need a render context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node >=21 defines a read-only global `navigator`; override it explicitly.
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useFormik } = await import("formik");
const { createForm, field, required, email } = await import("@modyra/core");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values) {
  const errors = {};
  if (!values.email) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(values.email)) errors.email = "Invalid email";
  if (!values.name) errors.name = "Name is required";
  return errors;
}

function buildFormik() {
  let api;
  function Harness() {
    api = useFormik({
      initialValues: { email: "", name: "" },
      validate,
      onSubmit: () => {},
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return {
    async setEmail(value) {
      await act(async () => {
        await api.setFieldValue("email", value);
      });
    },
    emailInvalid: () => !!api.errors.email,
    destroy: () => act(() => root.unmount()),
  };
}

function buildModyra() {
  const form = createForm({
    email: field("", [required(), email()]),
    name: field("", [required()]),
  });
  return {
    setEmail: (value) => form.f.email.set(value),
    emailInvalid: () => !form.f.email.valid(),
  };
}

test("Formik and Modyra agree on the same email invalid -> valid transitions", async () => {
  const formik = buildFormik();
  const modyra = buildModyra();

  const cases = ["", "not-an-email", "a@b.co", "", "still bad", "person@example.org"];
  for (const value of cases) {
    await formik.setEmail(value);
    modyra.setEmail(value);
    assert.equal(
      formik.emailInvalid(),
      modyra.emailInvalid(),
      `mismatch for email value ${JSON.stringify(value)}`,
    );
  }

  formik.destroy();
});
