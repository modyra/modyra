// Proves the side-by-side snippet in comparison-react-hook-form.md: build
// the same two-field form in react-hook-form and in Modyra, drive both
// through the same sequence of values via each library's own programmatic
// API (RHF's setValue+trigger, Modyra's set()), and assert they agree on
// every invalid -> valid transition. Same pattern as
// packages/angular/src/lib/core/comparison-reactive-forms.spec.ts, ported
// to a real jsdom + react-dom root since hooks need a render context.
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
const { useForm } = await import("react-hook-form");
const { createForm, field, required, email } = await import("@modyra/core");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildRhf() {
  let api;
  function Harness() {
    api = useForm({ mode: "onChange", defaultValues: { email: "x", name: "" } });
    // formState is a lazily-tracked proxy: RHF only computes/updates a key
    // (here `errors`) once something reads it during render, so this
    // isn't dead code — dropping it silently stops pattern validation from
    // ever populating `errors` on subsequent changes.
    void api.formState.errors;
    return React.createElement("input", {
      ...api.register("email", { required: true, pattern: EMAIL_PATTERN }),
    });
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  const emailInput = container.querySelector("input");
  const nativeSetter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype, "value",
  ).set;
  return {
    async setEmail(value) {
      await act(async () => {
        nativeSetter.call(emailInput, value);
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    emailInvalid: () => !!api.formState.errors.email,
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

test("react-hook-form and Modyra agree on the same email invalid -> valid transitions", async () => {
  const rhf = buildRhf();
  const modyra = buildModyra();

  const cases = ["", "not-an-email", "a@b.co", "", "still bad", "person@example.org"];
  for (const value of cases) {
    await rhf.setEmail(value);
    modyra.setEmail(value);
    assert.equal(
      rhf.emailInvalid(),
      modyra.emailInvalid(),
      `mismatch for email value ${JSON.stringify(value)}`,
    );
  }

  rhf.destroy();
});
