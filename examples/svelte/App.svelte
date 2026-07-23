<script>
  // Signup form demo: schema-defined validators, cross-field password check,
  // draft persistence (reload the page mid-typing), undo/redo history, a
  // cancellable server-side username check and a simulated server error on
  // submit. The devtools panel at the bottom shows the live engine state;
  // sensitive fields (password) are masked automatically.
  //
  // Unlike Solid's direct-accessor style, Svelte has no fine-grained JSX
  // compiler for arbitrary function calls — `toStore()` wraps each field
  // signal into a real Svelte `Readable`, so templates use the native
  // `$store` auto-subscription instead of a useMdyField-style hook.
  import { onMount } from "svelte";
  import {
    createSvelteForm, crossField, email, field, minLength, required,
    serverValidator, toStore,
  } from "@modyra/svelte";
  import { mountMdyDevtools } from "@modyra/core/devtools";
  import TextField from "./TextField.svelte";

  const THEMES = { default: "modyra.css", material: "modyra-material.css", ios: "modyra-ios.css", ionic: "modyra-ionic.css", base: "modyra-base.css" };
  let theme = "material";
  function switchTheme(e) {
    theme = e.target.value;
    document.getElementById("theme").href = `./themes/${THEMES[theme]}`;
  }

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

  const form = createSvelteForm(
    {
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
      validators: [
        crossField(["confirm"], (v) =>
          v.password === v.confirm ? null : "Passwords do not match"),
      ],
      history: { debounceMs: 300 },
      draft: { key: "signup-svelte", exclude: ["password", "confirm"] },
    },
  );

  const canSubmit = toStore(form.state.canSubmit);
  const canUndo = toStore(form.canUndo);
  const canRedo = toStore(form.canRedo);

  let devtoolsEl;
  onMount(() => mountMdyDevtools(form, devtoolsEl));

  function submit(e) {
    e.preventDefault();
    void form.submit(async (value) => {
      if (value.email === "taken@example.com") {
        return [{ path: "email", kind: "server", message: "This email is already registered" }];
      }
      console.log("submitted", value);
    });
  }
</script>

<main style="max-width: 30rem; margin: 2rem auto; display: grid; gap: 1rem;">
  <h1>Modyra × Svelte</h1>
  <label class="mdy-label" style="display: flex; gap: .5rem; align-items: center;">
    Theme
    <select value={theme} on:input={switchTheme}>
      {#each Object.keys(THEMES) as t}<option value={t}>{t}</option>{/each}
    </select>
  </label>
  <p>Try username <code>admin</code> for a cancellable server check, <code>taken@example.com</code> for a server error. Reload mid-typing: the draft survives.</p>
  <form class="mdy-form" on:submit={submit}>
    <TextField label="Username" handle={form.f.username} />
    <TextField label="Name" handle={form.f.name} />
    <TextField label="Email" handle={form.f.email} type="email" />
    <TextField label="Password" handle={form.f.password} type="password" />
    <TextField label="Confirm password" handle={form.f.confirm} type="password" />
    <div style="display: flex; gap: .5rem;">
      <button type="submit" disabled={!$canSubmit}>Sign up</button>
      <button type="button" disabled={!$canUndo} on:click={() => form.undo()}>Undo</button>
      <button type="button" disabled={!$canRedo} on:click={() => form.redo()}>Redo</button>
    </div>
  </form>
  <div bind:this={devtoolsEl}></div>
</main>
