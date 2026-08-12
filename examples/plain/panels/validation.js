/**
 * Where a verdict comes from, and what it makes the DOM carry.
 *
 * Four sources of the same word "invalid" — a rule on the field, a rule that reads the whole form,
 * a rule that has to ask a server, and a server that answered after the fact — and one thing they
 * must never do differently: a declared constraint reaches the input as a native attribute. A
 * `maxLength` that only becomes a validator lets someone type five hundred characters and then tells
 * them off; that is what the facts on a rule exist to prevent.
 */
import {
  compose,
  createForm,
  crossField,
  email as mdyEmail,
  field as mdyField,
  maxLength as mdyMaxLength,
  minLength as mdyMinLength,
  pattern as mdyPattern,
  required as mdyRequired,
  serverValidator,
} from "@modyra/core";
import { renderField } from "@modyra/plain";
import { action, grid, readoutPrinter, toolbar } from "./shell.js";

const FIELDS = [
  { name: "code", kind: "text", label: "Code", placeholder: "Two to eight capitals" },
  { name: "email", kind: "email", label: "Email" },
  { name: "handle", kind: "text", label: "Handle", placeholder: "Checked against a server" },
  { name: "password", kind: "password", label: "Password" },
  { name: "confirm", kind: "password", label: "Confirm password" },
];

/** Stands in for a server: `taken` is rejected, and the answer takes a moment to arrive. */
function remoteCheck(latencyMs) {
  return (value) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(String(value ?? "").toLowerCase() === "taken" ? "That handle is taken" : null), latencyMs);
    });
}

export const validationPanel = {
  id: "validation",
  title: "Validation",
  blurb:
    "Synchronous rules, a rule that reads two fields at once, and a rule that has to wait for an answer. The readout separates what the form thinks from what the DOM carries.",
  invariant:
    "A declared fact survives composition. `compose(required(), maxLength(8), pattern(…))` marks the field required AND puts maxlength and pattern on the input — a rule that combines two others must not swallow what either declared.",

  mount(work, readout) {
    const form = createForm(
      {
        code: mdyField("", [compose(mdyRequired(), mdyMinLength(2), mdyMaxLength(8), mdyPattern(/^[A-Z]+$/))]),
        email: mdyField("", [mdyRequired(), mdyEmail()]),
        // `serverValidator` is the shape a rule takes when the answer is somewhere else: it returns
        // the field options, so the debounce and the timeout are declared with the check.
        handle: mdyField("", [], serverValidator(remoteCheck(700), { debounceMs: 200 })),
        password: mdyField("", [mdyMinLength(8)]),
        confirm: mdyField(""),
      },
      {
        validators: [
          // The paths are where the message lands, and the function answers about the whole value:
          // a rule that reads two fields has no single field to be attached to.
          crossField(["confirm"], (value) =>
            value.confirm !== "" && value.confirm !== value.password ? "The two do not match" : null),
        ],
      },
    );

    const bar = toolbar(work);
    const area = grid(work);
    const dispose = FIELDS.map((f) => renderField(area, f, form.f[f.name], form.reactivity));

    action(bar, "Touch everything", () => form.markAllTouched());
    action(bar, "Take the handle", () => form.f.handle.set("taken"));
    action(bar, "Fill it correctly", () => {
      form.f.code.set("ABC");
      form.f.email.set("someone@example.com");
      form.f.handle.set("free");
      form.f.password.set("longenough");
      form.f.confirm.set("longenough");
      form.markAllTouched();
    });
    // A server rejecting a value the client accepted is the ordinary case, not the exceptional one:
    // the client's rules are a courtesy and the server's are the authority.
    // A server rejecting a value the client accepted is the ordinary case, not the exceptional one:
    // the client's rules are a courtesy and the server's are the authority. It arrives as a
    // validator under its own key, so nothing the field already declared is disturbed.
    action(bar, "Server rejects the email", () => {
      form.upsertValidators("email", "server", [() => ["Already registered"]], false);
      form.markAllTouched();
    });
    action(bar, "Server changes its mind", () => form.upsertValidators("email", "server", [], false));

    /** What the input actually carries, which is the half a validator alone never reaches. */
    const attributesOf = (name) => {
      const control = area.querySelector(`[id="${name}"]`);
      if (!control) return null;
      const carried = {};
      for (const attribute of ["required", "aria-required", "minlength", "maxlength", "pattern", "type", "aria-invalid"]) {
        const value = control.getAttribute(attribute);
        if (value !== null) carried[attribute] = value;
      }
      return carried;
    };

    const print = readoutPrinter(readout, () => ({
      formValid: form.state.valid(),
      pending: FIELDS.filter((f) => form.f[f.name].pending()).map((f) => f.name),
      errors: Object.fromEntries(
        FIELDS.map((f) => [f.name, form.f[f.name].errors().map((e) => e.message)]).filter(([, e]) => e.length),
      ),
      // The declared facts, read off the DOM rather than off the schema — the schema is the claim
      // and the attribute is whether it arrived.
      code: attributesOf("code"),
      email: attributesOf("email"),
      password: attributesOf("password"),
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      for (const f of FIELDS) { form.f[f.name].errors(); form.f[f.name].pending(); form.f[f.name].touched(); }
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of dispose) d?.(); form.destroy(); };
  },
};
