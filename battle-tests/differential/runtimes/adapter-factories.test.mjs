/**
 * The factory a consumer of an adapter actually calls.
 *
 * Every runtime differential in this suite hands `xReactivity()` to `createForm`. That is not what a
 * consumer writes. `@modyra/vue` publishes `createVueForm`, and Solid and Svelte publish their
 * equivalents, and those are the entry points the guides name — so the reactivity comparison proves
 * nothing about the one line an application has in it.
 *
 * Two things could differ and would be invisible to every existing battle: a factory could default
 * an option differently from `createForm`, and the three could default differently from each other.
 * Both are the kind of divergence that shows up as one framework's users reporting a bug nobody else
 * can reproduce.
 *
 * Solid is driven in a child process under each export condition, and the third battle is why. Node
 * resolves `solid-js` to its server build when the `browser` condition is absent, and that is not a
 * test-runner quirk — it is what a server render resolves. On that build a form once froze at
 * creation and reported itself valid with an empty `required` field, which made a server asking
 * whether to accept a submission answer yes about a form that should have been refused.
 *
 * `solidReactivity()` now probes the graph it resolved and falls back to the framework-agnostic one
 * when computations do not re-run, so the **verdicts** are the same on both builds. What is still
 * not the same is **tracking**: a Solid computation reading a form value re-runs on the client build
 * and does not on the server one. Both halves are asserted, because they are the line every other
 * battle in this suite has to draw — a comparison of what a form *means* may include Solid in any
 * process, and one that asserts a Solid computation *noticed* still needs the condition.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createForm, field, group, minLength, required } from "@modyra/core";
import { createVueForm, vueReactivity } from "@modyra/vue";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** The steps every factory is driven through, as source so a child process can run them too. */
const STEPS = Object.freeze([
  ["initial", ""],
  ["a name too short", `form.f.name.set("ab");`],
  ["a name that satisfies the rule", `form.f.name.set("abcd");`],
  ["a nested value", `form.f.inner.age.set(9);`],
  ["reset", `form.reset();`],
]);

/** Everything a consumer can observe, as one comparable string. */
const OBSERVE = `JSON.stringify({
  value: form.getValue(),
  valid: form.state.valid(),
  canSubmit: form.state.canSubmit(),
  errors: form.errorsFor("name")().map((each) => each.message),
  fields: form.fieldNames(),
  touched: form.f.name.touched(),
  dirty: form.f.name.dirty(),
})`;

/**
 * Drive a form through the steps in this process, collecting one observation per step.
 *
 * The steps are the same ones {@link STEPS} carries as source for the child, in the same order, so
 * the two paths compare like for like.
 */
function driveHere(form) {
  const record = () =>
    JSON.stringify({
      value: form.getValue(),
      valid: form.state.valid(),
      canSubmit: form.state.canSubmit(),
      errors: form.errorsFor("name")().map((each) => each.message),
      fields: form.fieldNames(),
      touched: form.f.name.touched(),
      dirty: form.f.name.dirty(),
    });

  const observed = [record()];
  form.f.name.set("ab");
  observed.push(record());
  form.f.name.set("abcd");
  observed.push(record());
  form.f.inner.age.set(9);
  observed.push(record());
  form.reset();
  observed.push(record());
  return observed;
}

/**
 * Drive the same sequence in a child process, under `condition`.
 *
 * The script is written into the suite's own tree so bare specifiers resolve exactly as they do for
 * every other battle; the child is what carries the export condition, which cannot be changed inside
 * a running process.
 */
function driveThere({ importFrom, factory, condition }) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-factory-"));
  const script = join(dir, "drive.mjs");
  writeFileSync(
    script,
    [
      `import { field, group, minLength, required } from "@modyra/core";`,
      `import { ${factory} } from "${importFrom}";`,
      `const form = ${factory}({ name: field("", [required(), minLength(3)]), inner: group({ age: field(0) }) }, { devWarnings: false });`,
      `const observed = [];`,
      ...STEPS.map(([, step]) => `${step}\nobserved.push(${OBSERVE});`),
      `console.log(JSON.stringify(observed));`,
      `form.destroy();`,
    ].join("\n"),
    "utf8",
  );

  try {
    const argv = condition ? [`--conditions=${condition}`, script] : [script];
    const stdout = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, observed: JSON.parse(stdout.trim()) };
  } catch (error) {
    return { ok: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 3).join(" ") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["REA-001", "DYN-001"],
    title: "an adapter's own factory builds the form its reactivity would have built",
    environments: ["node"],
  },
  async (ctx) => {
    const schema = () => ({
      name: field("", [required(), minLength(3)]),
      inner: group({ age: field(0) }),
    });

    const throughFactory = createVueForm(schema(), { devWarnings: false });
    const throughCore = createForm(schema(), { reactivity: vueReactivity(), devWarnings: false });

    try {
      const factoryRun = driveHere(throughFactory);
      const coreRun = driveHere(throughCore);
      ctx.log.note("the same sequence through a factory and through createForm", {
        steps: factoryRun.length,
      });

      // The control: the sequence reaches more than one distinct observation, so agreeing is
      // agreeing about a form that moved rather than one that never changed.
      expectClaim(new Set(factoryRun).size > 1, {
        claimIds: ["REA-001"],
        what: "the sequence produced one observation throughout, so the comparison is between two still forms",
        detail: JSON.stringify(factoryRun.slice(0, 1)),
      });

      expectEqual(factoryRun, coreRun, {
        claimIds: ["REA-001", "DYN-001"],
        what: "an adapter's factory and createForm on the same reactivity built forms that behave differently",
        detail: JSON.stringify({ factory: factoryRun, core: coreRun }),
      });
    } finally {
      throughFactory.destroy();
      throughCore.destroy();
    }
  },
);

battle(
  {
    claims: ["REA-001", "DYN-001"],
    title: "the adapters' factories agree with each other",
    environments: ["node"],
  },
  async (ctx) => {
    const runs = [
      ["vue", driveThere({ importFrom: "@modyra/vue", factory: "createVueForm" })],
      ["svelte", driveThere({ importFrom: "@modyra/svelte", factory: "createSvelteForm" })],
      // Under this process's condition Solid's computations do not run, so it is driven under the
      // one its own suite uses. Without it, a form with an empty `required` field reports valid.
      ["solid", driveThere({ importFrom: "@modyra/solid", factory: "createSolidForm", condition: "browser" })],
    ];

    for (const [name, run] of runs) {
      ctx.log.note("an adapter's factory driven through the sequence", { name, ok: run.ok });

      expectClaim(run.ok === true, {
        claimIds: ["REA-001"],
        what: `${name}'s published factory could not be driven through an ordinary sequence`,
        detail: run.message ?? "",
      });
    }

    // The control: something in the sequence is invalid at some point, so agreement is agreement
    // about verdicts rather than about five copies of "nothing happened".
    const [, first] = runs[0];
    expectClaim(first.observed.some((step) => JSON.parse(step).valid === false), {
      claimIds: ["REA-001"],
      what: "no step in the sequence was ever invalid, so the adapters agree about nothing",
      detail: JSON.stringify(first.observed.slice(0, 1)),
    });

    for (const [name, run] of runs.slice(1)) {
      expectEqual(run.observed, first.observed, {
        claimIds: ["REA-001", "DYN-001"],
        what: `${name}'s factory disagrees with vue's about the same sequence`,
        detail: JSON.stringify({ [name]: run.observed, vue: first.observed }),
      });
    }
  },
);

battle(
  {
    claims: ["REA-001", "SSR-001"],
    title: "a form means the same thing on the build a server render resolves",
    environments: ["node"],
  },
  async (ctx) => {
    // The build a server render gets, against the one a browser gets. A verdict that differed
    // between them is a server accepting a submission the client would have refused.
    const server = driveThere({ importFrom: "@modyra/solid", factory: "createSolidForm" });
    const client = driveThere({ importFrom: "@modyra/solid", factory: "createSolidForm", condition: "browser" });
    ctx.log.note("solid on each build", { server: server.ok, client: client.ok });

    expectClaim(server.ok && client.ok, {
      claimIds: ["REA-001"],
      what: "solid could not be driven on one of the two builds, so they cannot be compared",
      detail: JSON.stringify({ server: server.message, client: client.message }),
    });

    // The control: some step in the sequence is invalid, so agreement is agreement about a verdict
    // rather than about a form that was never asked anything.
    expectClaim(server.observed.some((step) => JSON.parse(step).valid === false), {
      claimIds: ["SSR-001"],
      what: "no step was ever invalid, so the builds agree about nothing",
      detail: JSON.stringify(server.observed.slice(0, 1)),
    });

    expectEqual(server.observed, client.observed, {
      claimIds: ["REA-001", "SSR-001"],
      what: "the build a server render resolves answers differently from the one a browser resolves",
      detail: JSON.stringify({ server: server.observed, client: client.observed }),
    });
  },
);

battle(
  {
    claims: ["REA-001"],
    title: "tracking is the half that does not travel between the builds",
    environments: ["node"],
  },
  async (ctx) => {
    // The residual, and the line every other battle here has to draw. Verdicts are portable now;
    // whether a Solid computation *notices* a write is not, because the server build's `createMemo`
    // computes once and its `createEffect` never runs.
    //
    // Asserted rather than assumed so that a battle needing the condition can point at a measured
    // reason, and so that a future Solid whose server graph recomputes turns this and lets the last
    // condition come off.
    const tracked = (condition) => {
      const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-tracking-"));
      const script = join(dir, "track.mjs");
      writeFileSync(
        script,
        [
          `import { createForm, field } from "@modyra/core";`,
          `import { createComputed, createRoot } from "solid-js";`,
          `import { solidReactivity } from "@modyra/solid";`,
          `const form = createForm({ name: field("a") }, { reactivity: solidReactivity(), devWarnings: false });`,
          `let runs = 0;`,
          `const dispose = createRoot((stop) => { createComputed(() => { form.f.name.value(); runs += 1; }); return stop; });`,
          `const atCreation = runs;`,
          `form.f.name.set("b");`,
          `console.log(JSON.stringify({ atCreation, afterWrite: runs }));`,
          `dispose(); form.destroy();`,
        ].join("\n"),
        "utf8",
      );
      try {
        const argv = condition ? [`--conditions=${condition}`, script] : [script];
        const stdout = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return JSON.parse(stdout.trim().split("\n").pop());
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };

    const client = tracked("browser");
    const server = tracked(null);
    ctx.log.note("whether a solid computation re-runs on a write", { client, server });

    // The control: the computation ran once when it was created on both builds, so a difference
    // below is about re-running rather than about the computation never existing.
    expectEqual([client.atCreation, server.atCreation], [1, 1], {
      claimIds: ["REA-001"],
      what: "a solid computation did not run when it was created, so nothing below measures tracking",
      detail: JSON.stringify({ client, server }),
    });

    expectClaim(client.afterWrite > client.atCreation, {
      claimIds: ["REA-001"],
      what: "a solid computation on the client build did not re-run when the form value changed",
      detail: JSON.stringify(client),
    });

    expectEqual(server.afterWrite, server.atCreation, {
      claimIds: ["REA-001"],
      what: "solid's server build now tracks a form read, so the last battles holding the browser condition can drop it",
      detail: JSON.stringify(server),
    });
  },
);
