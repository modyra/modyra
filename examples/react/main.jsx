// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history and a
// simulated server-side error. The devtools panel at the bottom shows the
// live engine state; sensitive fields (password) are masked automatically.
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import {
  crossField, email, field, minLength, mountMdyDevtools, required,
  useMdyField, useMdyForm,
} from "@modyra/react";

function TextField({ label, handle, type = "text" }) {
  const f = useMdyField(handle);
  const showErrors = f.touched && f.errors.length > 0;
  return (
    <div className={`mdy-renderer mdy-renderer--text${f.touched ? " mdy-renderer--touched" : ""}`}>
      <label className="mdy-label">
        {label}
        {/* required() marks the field, so the star and aria stay in sync */}
        {handle.required() && <span className="mdy-label__required" aria-hidden="true">*</span>}
      </label>
      <div className="mdy-input-wrapper">
        <input
          type={type}
          value={f.value ?? ""}
          aria-invalid={!f.valid}
          aria-required={handle.required()}
          onChange={(e) => f.set(e.target.value)}
          onBlur={f.markAsTouched}
        />
      </div>
      {showErrors && (
        <ul className="mdy-control__errors" role="alert">
          {f.errors.map((er) => <li className="mdy-control__error" key={er.message}>{er.message}</li>)}
        </ul>
      )}
    </div>
  );
}

function Signup() {
  const form = useMdyForm(
    () => ({
      name: field("", [required(), minLength(2)]),
      email: field("", [required(), email()]),
      password: field("", [required(), minLength(8)]),
      confirm: field("", [required()]),
    }),
    {
      // Cross-field rules see the whole typed value and attribute their
      // error to the involved fields.
      validators: [
        crossField(["confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords do not match"),
      ],
      // Value snapshots for undo/redo; keystrokes are batched.
      history: { debounceMs: 300 },
      // Autosaved to localStorage, restored on reload, cleared on submit.
      // The password never touches storage.
      draft: { key: "signup-react", exclude: ["password", "confirm"] },
    },
  );

  // Reading a field via useMdyField keeps the component subscribed.
  useMdyField(form.f.name);
  const devtools = useRef(null);
  useEffect(() => mountMdyDevtools(form, devtools.current), [form]);

  const submit = (e) => {
    e.preventDefault();
    void form.submit(async (value) => {
      // Returned errors are shown on the matching fields until edited.
      if (value.email === "taken@example.com") {
        return [{ path: "email", kind: "server", message: "This email is already registered" }];
      }
      console.log("submitted", value);
    });
  };

  return (
    <main style={{ maxWidth: "30rem", margin: "2rem auto", display: "grid", gap: "1rem" }}>
      <h1>Modyra × React</h1>
      <p>Try <code>taken@example.com</code> to see a server error. Reload mid-typing: the draft survives.</p>
      <form className="mdy-form" onSubmit={submit}>
        <TextField label="Name" handle={form.f.name} />
        <TextField label="Email" handle={form.f.email} type="email" />
        <TextField label="Password" handle={form.f.password} type="password" />
        <TextField label="Confirm password" handle={form.f.confirm} type="password" />
        <div style={{ display: "flex", gap: ".5rem" }}>
          <button type="submit" disabled={!form.state.canSubmit()}>Sign up</button>
          <button type="button" disabled={!form.canUndo()} onClick={() => form.undo()}>Undo</button>
          <button type="button" disabled={!form.canRedo()} onClick={() => form.redo()}>Redo</button>
        </div>
      </form>
      <div ref={devtools}></div>
    </main>
  );
}
createRoot(document.getElementById("app")).render(<Signup />);
