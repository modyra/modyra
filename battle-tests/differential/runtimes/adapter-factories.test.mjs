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
 * Solid runs in a child process under `--conditions=browser`, the same way
 * `adversarial/reactivity/solid-collection-rows` runs it. Without that condition Solid resolves to a
 * build whose computations do not run — it reports a form with an empty `required` field as valid,
 * with no errors — so including it here under this process's condition would compare against a
 * runtime that is not evaluating anything, and agreement would mean nothing. Vue and Svelte are
 * driven in process and the sequence is identical in both places.
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
    claims: ["REA-001"],
    title: "solid without its export condition is not a runtime to compare against",
    environments: ["node"],
  },
  async (ctx) => {
    // Why the battle above pays for a child process. This is the state every other differential in
    // the suite excludes solid to avoid, asserted rather than assumed — if it ever stops being
    // true, those exclusions are costing coverage for no reason.
    const lenient = driveThere({ importFrom: "@modyra/solid", factory: "createSolidForm" });
    const proper = driveThere({ importFrom: "@modyra/solid", factory: "createSolidForm", condition: "browser" });
    ctx.log.note("solid under each condition", { lenient: lenient.ok, proper: proper.ok });

    expectClaim(lenient.ok && proper.ok, {
      claimIds: ["REA-001"],
      what: "solid could not be driven under one of the two conditions, so they cannot be compared",
      detail: JSON.stringify({ lenient: lenient.message, proper: proper.message }),
    });

    const first = (run) => JSON.parse(run.observed[0]);
    ctx.log.note("what each condition says about an empty required field", {
      lenient: first(lenient).valid,
      proper: first(proper).valid,
    });

    // The proper condition sees the rule.
    expectEqual(first(proper).valid, false, {
      claimIds: ["REA-001"],
      what: "solid under its own export condition does not see an unsatisfied required rule",
      detail: JSON.stringify(first(proper)),
    });

    // The lenient one does not, which is exactly why folding solid into a differential run in this
    // process would report agreement about a runtime that is not evaluating anything.
    expectEqual(first(lenient).valid, true, {
      claimIds: ["REA-001"],
      what: "solid without the browser condition now evaluates its rules, so the exclusions elsewhere in this suite can be lifted",
      detail: JSON.stringify(first(lenient)),
    });
  },
);
