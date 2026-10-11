/**
 * A view bound to a field, ended, and bound again still sees the next write.
 *
 * Every host mounts, cleans up and mounts again: React rehearses it under Strict Mode, a list
 * re-keys a row, a router keeps a page alive. What a host reuses across that cycle differs — React
 * and Preact keep the memoised store and subscribe to it again, a Svelte component keeps its
 * `Readable` and resubscribes, Vue and Solid build a new scope or root — so the scenario is driven
 * through each adapter's own view primitive rather than through `reactivity.effect`, which every
 * adapter shares and which passes whether or not the primitive above it survives a cycle.
 *
 * Each runtime runs in its own child process because Solid only tracks under the `browser` export
 * condition, and a condition cannot change inside a running process. The others run without one, so
 * a difference between them is about the primitive and not about how it was loaded.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/**
 * Per runtime: the imports, the reactivity to build the form with, and `bind`, which mounts a view
 * that pushes what it sees into `seen` and returns its cleanup. `bind` is called twice on the same
 * held object where the host reuses one across a remount, so the second call is the remount.
 */
const VIEWS = Object.freeze({
  react: {
    imports: `import { createFieldStore, reactReactivity as rx } from "@modyra/react";`,
    held: `const held = createFieldStore(form.f.name);`,
    bind: `(seen) => held.subscribe(() => seen.push(form.f.name.value()))`,
  },
  preact: {
    imports: `import { createFieldStore, preactReactivity as rx } from "@modyra/preact";`,
    held: `const held = createFieldStore(form.f.name);`,
    bind: `(seen) => held.subscribe(() => seen.push(form.f.name.value()))`,
  },
  svelte: {
    imports: `import { toStore, svelteReactivity as rx } from "@modyra/svelte";`,
    held: `const held = toStore(form.f.name.value);`,
    bind: `(seen) => held.subscribe((value) => seen.push(value))`,
  },
  // A Vue component's setup runs in an effect scope the adapter owns, and its render reads the
  // composable's state through the same `@vue/reactivity` the adapter was built on.
  vue: {
    imports: `import { useMdyField, vueReactivity as rx } from "@modyra/vue";`,
    held: `const host = rx();`,
    bind: `(seen) => { const scope = host.createScope(); scope.run(() => { const api = useMdyField(form.f.name, { widgetId: "name" }); host.effect(() => seen.push(api.state.value), { scope }); }); return () => scope.destroy(); }`,
  },
  solid: {
    imports: `import { solidReactivity as rx, useMdyField } from "@modyra/solid";\nimport { createComputed, createRoot } from "solid-js";`,
    held: `const held = null;`,
    bind: `(seen) => createRoot((dispose) => { const api = useMdyField(form.f.name, { widgetId: "name" }); createComputed(() => seen.push(api.state.value)); return dispose; })`,
    condition: "browser",
  },
});

function driveThere(name) {
  const view = VIEWS[name];
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-view-"));
  const script = join(dir, "view.mjs");
  writeFileSync(
    script,
    [
      `import { createForm, field } from "@modyra/core";`,
      view.imports,
      `const settle = () => new Promise((done) => setTimeout(done, 0));`,
      `const form = createForm({ name: field("a") }, { reactivity: rx(), devWarnings: false });`,
      view.held,
      `const bind = ${view.bind};`,
      `const first = [];`,
      `const endFirst = bind(first);`,
      `await settle();`,
      `endFirst();`,
      `const second = [];`,
      `const endSecond = bind(second);`,
      `await settle();`,
      `form.f.name.set("b");`,
      `await settle();`,
      `const kind = rx().kind;`,
      `endSecond();`,
      `form.f.name.set("c");`,
      `await settle();`,
      `console.log(JSON.stringify({ kind, first, second, value: form.f.name.value() }));`,
      `form.destroy();`,
    ].join("\n"),
    "utf8",
  );

  try {
    const argv = view.condition ? [`--conditions=${view.condition}`, script] : [script];
    const stdout = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, ...JSON.parse(stdout.trim().split("\n").pop()) };
  } catch (error) {
    return { ok: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 3).join(" ") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["LIF-002", "LIF-001"],
    title: "a view bound, ended and bound again sees the next write on every runtime",
    environments: ["node"],
  },
  async (ctx) => {
    for (const name of Object.keys(VIEWS)) {
      const observed = driveThere(name);
      ctx.log.note("a view across a remount", { runtime: name, observed });

      expectClaim(observed.ok, {
        claimIds: ["LIF-002"],
        what: `the remount scenario did not run on ${name}`,
        detail: observed.message,
      });

      // The control: the runtime under the form is the one named, so a pass below is that
      // runtime's primitive passing and not a fallback's.
      expectEqual(observed.kind, name, {
        claimIds: ["LIF-002"],
        what: `@modyra/${name} supplied a runtime of another kind`,
      });

      expectEqual(observed.value, "c", {
        claimIds: ["LIF-002"],
        what: `the form itself did not take both writes on ${name}`,
      });

      expectClaim(observed.second.includes("b"), {
        claimIds: ["LIF-002"],
        what: `a view bound again after a cleanup never saw the next write on ${name}`,
        detail: JSON.stringify(observed.second),
      });

      expectClaim(!observed.first.includes("b") && !observed.first.includes("c"), {
        claimIds: ["LIF-001"],
        what: `a view that was cleaned up still saw writes on ${name}`,
        detail: JSON.stringify(observed.first),
      });

      // A cleanup that drops the listener but leaves the tracking behind is invisible to the first
      // view; it shows here, as the one write reaching the second view once per effect still alive.
      expectEqual(observed.second.filter((value) => value === "b").length, 1, {
        claimIds: ["LIF-001"],
        what: `one write reached the view bound again more than once on ${name}`,
      });

      expectClaim(!observed.second.includes("c"), {
        claimIds: ["LIF-001"],
        what: `the second view still saw a write after its own cleanup on ${name}`,
        detail: JSON.stringify(observed.second),
      });
    }
  },
);
