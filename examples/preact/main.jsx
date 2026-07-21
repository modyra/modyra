// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history, a
// cancellable server-side username check and a simulated server error on
// submit. The devtools panel at the bottom shows the live engine state;
// sensitive fields (password) are masked automatically.
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";
import {
  createStore, crossField, email, field, minLength, required,
  serverValidator, useMdyField, useMdyForm,
} from "@modyra/preact";
import { mountMdyDevtools } from "@modyra/core/devtools";

// Simulated availability endpoint. The abort signal cancels the request
// when a newer keystroke supersedes the run (last-wins), so stale replies
// never land on the field.
const isUsernameTaken = (value, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(["admin", "root"].includes(value)), 350);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

const THEMES = { default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };

// Swaps the theme stylesheet at runtime — every packaged theme works with
// the same markup, so switching is just a different href.
function ThemeSwitcher() {
  const [theme, setTheme] = useState("material");
  useEffect(() => {
    document.getElementById("theme").href = `./themes/${THEMES[theme]}`;
  }, [theme]);
  return (
    <label className="mdy-label" style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
      Theme
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        {Object.keys(THEMES).map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  );
}

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
      {/* Async validators keep the field pending until the run settles */}
      {f.pending && (
        <div className="mdy-supporting-text" role="status">checking…</div>
      )}
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
      // Debounced, cancellable availability check with a 2s timeout —
      // try "admin" or "root".
      username: field(
        "",
        [required(), minLength(3)],
        serverValidator(
          async (value, { signal }) =>
            (await isUsernameTaken(value, signal)) ? "Username is already taken" : null,
          { debounceMs: 300, timeoutMs: 2000 },
        ),
      ),
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
      draft: { key: "signup-preact", exclude: ["password", "confirm"] },
    },
  );

  // Reading a field via useMdyField keeps the component subscribed.
  useMdyField(form.f.name);
  // Buttons below read form-level state (canSubmit/canUndo/canRedo), which
  // no per-field useMdyField call above is subscribed to — without this,
  // an async validator settling on a field the parent doesn't track (e.g.
  // username) never re-renders Signup, and the buttons go stale.
  const formStore = useMemo(
    () => createStore([form.state.valid, form.state.pending, form.canUndo, form.canRedo]),
    [form],
  );
  useEffect(() => () => formStore.destroy(), [formStore]);
  // Preact's useSyncExternalStore (preact/compat) takes no
  // getServerSnapshot argument, unlike React's.
  useSyncExternalStore(formStore.subscribe, formStore.getSnapshot);
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
      <h1>Modyra × Preact</h1>
      <ThemeSwitcher />
      <p>Try username <code>admin</code> for a cancellable server check, <code>taken@example.com</code> for a server error. Reload mid-typing: the draft survives.</p>
      <form className="mdy-form" onSubmit={submit}>
        <TextField label="Username" handle={form.f.username} />
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
render(<Signup />, document.getElementById("app"));
