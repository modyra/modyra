// Signup form demo: schema-defined validators, cross-field password check,
// draft persistence (reload the page mid-typing), undo/redo history, a
// cancellable server-side username check and a simulated server error on
// submit. The devtools panel at the bottom shows the live engine state;
// sensitive fields (password) are masked automatically.
//
// Unlike the React/Preact examples, field handles are read directly as
// accessors inside JSX (`handle.value()`) — Solid's compiler wraps each
// such binding in its own fine-grained update, so there is no
// useMdyField-style hook or whole-component re-render here at all.
import { render } from "solid-js/web";
import { createSignal, onMount } from "solid-js";
import {
  createSolidForm, crossField, email, field, minLength, required,
  serverValidator,
} from "@modyra/solid";
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
  const [theme, setTheme] = createSignal("material");
  return (
    <label class="mdy-label" style={{ display: "flex", gap: ".5rem", "align-items": "center" }}>
      Theme
      <select
        value={theme()}
        onInput={(e) => {
          setTheme(e.target.value);
          document.getElementById("theme").href = `./themes/${THEMES[e.target.value]}`;
        }}
      >
        {Object.keys(THEMES).map((t) => <option value={t}>{t}</option>)}
      </select>
    </label>
  );
}

function TextField(props) {
  const { label, handle, type = "text" } = props;
  return (
    <div class={`mdy-renderer mdy-renderer--text${handle.touched() ? " mdy-renderer--touched" : ""}`}>
      <label class="mdy-label">
        {label}
        {/* required() marks the field, so the star and aria stay in sync */}
        {handle.required() && <span class="mdy-label__required" aria-hidden="true">*</span>}
      </label>
      <div class="mdy-input-wrapper">
        <input
          type={type}
          value={handle.value() ?? ""}
          aria-invalid={!handle.valid()}
          aria-required={handle.required()}
          onInput={(e) => handle.set(e.target.value)}
          onBlur={handle.markAsTouched}
        />
      </div>
      {/* Async validators keep the field pending until the run settles */}
      {handle.pending() && (
        <div class="mdy-supporting-text" role="status">checking…</div>
      )}
      {handle.touched() && handle.errors().length > 0 && (
        <ul class="mdy-control__errors" role="alert">
          {handle.errors().map((er) => <li class="mdy-control__error">{er.message}</li>)}
        </ul>
      )}
    </div>
  );
}

function Signup() {
  const form = createSolidForm(
    {
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
    },
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
      draft: { key: "signup-solid", exclude: ["password", "confirm"] },
    },
  );

  let devtools;
  onMount(() => mountMdyDevtools(form, devtools));

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
    <main style={{ "max-width": "30rem", margin: "2rem auto", display: "grid", gap: "1rem" }}>
      <h1>Modyra × Solid</h1>
      <ThemeSwitcher />
      <p>Try username <code>admin</code> for a cancellable server check, <code>taken@example.com</code> for a server error. Reload mid-typing: the draft survives.</p>
      <form class="mdy-form" onSubmit={submit}>
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
render(() => <Signup />, document.getElementById("app"));
