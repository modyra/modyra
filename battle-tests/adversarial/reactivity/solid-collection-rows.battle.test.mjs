/**
 * A row with more than one cell, on Solid's reactivity.
 *
 * `@modyra/solid` is a published adapter and `differential/runtimes/every-runtime` compares five of
 * its siblings against vanilla successfully. Solid cannot get past declaring a row: under the export
 * condition the repository's own `test:adapters` uses for it — `--conditions=browser` — a keyed or
 * positional row whose template has two cells raises
 *
 *   [modyra] Flat value does not match schema shape
 *
 * from inside `getValue`, which a collection calls while it is declaring. One cell is fine. The
 * value supplied makes no difference, and neither does whether anything is watching.
 *
 * A row with one cell is not a form anybody ships, so this is every Solid consumer with a
 * collection. It is invisible to the adapter's own suite because no test there declares one.
 *
 * The condition is the point, so the attack runs in a child process under it. Running Solid without
 * it does not raise — it silently does less, which is how this survived: the module resolves to a
 * build whose computations never run, and a form that computes nothing cannot disagree with itself.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/**
 * Declare one row of `cells` cells on a runtime, in a child process under a chosen condition.
 *
 * The script is written into the suite's own tree so bare specifiers resolve exactly as they do for
 * every other battle; the child is what carries the export condition, which cannot be changed inside
 * a running process.
 */
function declareRow({ runtime, cells, condition }) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-condition-"));
  const script = join(dir, "declare.mjs");
  const names = Array.from({ length: cells }, (_, index) => `c${index}`);

  writeFileSync(
    script,
    [
      `import { createForm, field, group, record } from "@modyra/core";`,
      `import { ${runtime}Reactivity } from "@modyra/${runtime}";`,
      `const shape = { ${names.map((name) => `${name}: field("")`).join(", ")} };`,
      `const form = createForm({ rows: record(group(shape)) }, { reactivity: ${runtime}Reactivity(), devWarnings: false });`,
      `form.f.rows.upsert("a", { c0: "A" });`,
      `console.log(JSON.stringify(form.getValue()));`,
      `form.destroy();`,
    ].join("\n"),
    "utf8",
  );

  try {
    const argv = condition ? [`--conditions=${condition}`, script] : [script];
    const stdout = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, value: stdout.trim() };
  } catch (error) {
    return { ok: false, message: `${error.stderr ?? ""}`.split("\n").find((line) => line.includes("modyra")) ?? "raised" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["COL-001", "COL-008"],
    title: "a row with more than one cell can be declared on every published runtime",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: one cell works on Solid under the same condition, so a failure below is about
    // how many cells the row has rather than about the adapter being unusable in a child process.
    const single = declareRow({ runtime: "solid", cells: 1, condition: "browser" });
    ctx.log.note("one cell, on solid, under the browser condition", { ok: single.ok });

    expectClaim(single.ok, {
      claimIds: ["COL-001"],
      what: "a one-cell row can be declared on solid at all",
      detail: single.message ?? "",
    });

    // And the second control: two cells work on a sibling adapter under the same condition, so the
    // condition itself is not what breaks it.
    const sibling = declareRow({ runtime: "vue", cells: 2, condition: "browser" });
    ctx.log.note("two cells, on vue, under the browser condition", { ok: sibling.ok });

    expectClaim(sibling.ok, {
      claimIds: ["COL-001"],
      what: "a two-cell row can be declared on another adapter under the same condition",
      detail: sibling.message ?? "",
    });

    const pair = declareRow({ runtime: "solid", cells: 2, condition: "browser" });
    ctx.log.note("two cells, on solid, under the browser condition", { ok: pair.ok });

    expectClaim(pair.ok, {
      claimIds: ["COL-001", "COL-008"],
      what: "declaring a two-cell row on solid raised instead of producing the row",
      detail: pair.message ?? "",
    });
  },
);

/**
 * Declare a row and then take it apart, in a child process under a chosen condition.
 *
 * The teardown is the half the registration fix does not reach: a row ends cell by cell, and a
 * runtime whose computations run eagerly reads the form between two of them.
 */
function structuralOperation({ runtime, condition, operation }) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-condition-"));
  const script = join(dir, "structural.mjs");

  writeFileSync(
    script,
    [
      `import { createForm, field, group, record } from "@modyra/core";`,
      `import { ${runtime}Reactivity } from "@modyra/${runtime}";`,
      `const form = createForm({ rows: record(group({ a: field(""), b: field("") })) },`,
      `  { reactivity: ${runtime}Reactivity(), devWarnings: false });`,
      `form.f.rows.upsert("r", { a: "A" });`,
      operation === "rename" ? `form.f.rows.rename("r", "q");` : `form.f.rows.remove("r");`,
      `console.log(JSON.stringify(form.getValue()));`,
      `form.destroy();`,
    ].join("\n"),
    "utf8",
  );

  try {
    const argv = condition ? [`--conditions=${condition}`, script] : [script];
    const stdout = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, value: stdout.trim() };
  } catch (error) {
    return { ok: false, message: `${error.stderr ?? ""}`.split("\n").find((line) => line.includes("modyra")) ?? "raised" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["COL-005", "COL-007"],
    title: "a row can be renamed and removed on every published runtime",
    environments: ["node"],
  },
  async (ctx) => {
    // Declaring a row works on solid now — that fix batched the registration. Taking one apart is
    // the other half, and it is reached by a different path: a row ends cell by cell, so a runtime
    // that recomputes eagerly reads the form between two of them and finds a shape the schema does
    // not describe.
    for (const operation of ["rename", "remove"]) {
      const sibling = structuralOperation({ runtime: "vue", condition: "browser", operation });
      ctx.log.note("a row taken apart on a sibling adapter", { operation, ok: sibling.ok });

      expectClaim(sibling.ok, {
        claimIds: ["COL-005"],
        what: `a row could not be ${operation}d on another adapter under the same condition`,
        detail: sibling.message ?? "",
      });

      const onSolid = structuralOperation({ runtime: "solid", condition: "browser", operation });
      ctx.log.note("the same row taken apart on solid", { operation, ok: onSolid.ok });

      expectClaim(onSolid.ok, {
        claimIds: ["COL-005", "COL-007"],
        what: `${operation} on a row raised instead of taking the row apart`,
        detail: onSolid.message ?? "",
      });
    }
  },
);
