/**
 * A document that passes every check the contract offers, and crashes the form it describes.
 *
 * The parser is the trust boundary the guides name in those words: a document that did not come from
 * your code is parsed first, and strict mode returns nothing at all when any diagnostic exists. An
 * application that follows that instruction has, at `ok === true`, been told the data is safe to
 * build from.
 *
 * Depth is a thing the contract knows how to bound. `MDY_LAYOUT_MAX_DEPTH` is 6 and
 * `MDY_MAX_EXPRESSION_DEPTH` is 32 — both published, both enforced, both refusing rather than
 * throwing. The tree of collections has no such limit, and nothing checks one.
 *
 * So a document nesting a collection deeply enough parses clean — `ok: true`, zero diagnostics — the
 * schema builds, and `createForm` throws `RangeError: Maximum call stack size exceeded`. The
 * application crashes on data it was told was valid, at the call after the one that vetted it.
 *
 * The depth where it happens is the runtime's stack, not a number in the contract: records were
 * observed crossing it between 5000 and 6000, arrays past 8000, and both move with the platform. So
 * this battle asserts the property rather than a threshold — at every depth, a document is either
 * refused or buildable, never both accepted and fatal. That stays true on a bigger stack, where the
 * rung simply passes for the right reason.
 *
 * Each rung runs in a child process. A stack overflow cannot be measured from inside the process it
 * overflows, and a battle that takes the suite down with it is a battle nobody keeps.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_LAYOUT_MAX_DEPTH, MDY_MAX_EXPRESSION_DEPTH } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** Depths a document can nest to, spanning the runtime's stack rather than aiming at it. */
const LADDER = Object.freeze([3, 1000, 20000, 60000]);

/** How long one document may take before the answer is "it stopped answering". */
const BUDGET_MS = 30000;

/**
 * Parse a nested document and build a form from it, in a child process.
 *
 * The three steps are reported separately because which one gives way is the finding: a refusal at
 * the door is the contract working, and a throw after `ok: true` is not.
 */
function parseAndBuild(depth, kind) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-depth-"));
  const script = join(dir, "run.mjs");
  writeFileSync(
    script,
    [
      `import { buildDynamicFormSchema, createForm, parseDynamicForm } from "@modyra/core";`,
      `let node = { node: "field", field: { kind: "text", label: "C" } };`,
      `for (let i = 0; i < ${depth}; i++) node = { node: ${JSON.stringify(kind)}, item: node };`,
      `const tree = { node: "group", children: { root: node } };`,
      `const step = (fn) => { try { return { ok: true, value: fn() }; } catch (error) { return { ok: false, error: String(error?.name ?? "") }; } };`,
      `const parsed = step(() => parseDynamicForm({ version: 3, fields: [], schema: tree }, { mode: "strict" }));`,
      `const built = parsed.ok ? step(() => buildDynamicFormSchema(tree)) : { ok: false, error: "skipped" };`,
      `const made = built.ok ? step(() => { const form = createForm(built.value, { devWarnings: false }); form.destroy(); return true; }) : { ok: false, error: "skipped" };`,
      `console.log(JSON.stringify({`,
      `  accepted: parsed.ok === true && parsed.value.ok === true,`,
      `  parseThrew: parsed.ok === false ? parsed.error : null,`,
      `  diagnostics: parsed.ok ? (parsed.value.diagnostics ?? []).length : null,`,
      `  buildThrew: built.ok === false ? built.error : null,`,
      `  createThrew: made.ok === false ? made.error : null,`,
      `}));`,
    ].join("\n"),
    "utf8",
  );

  try {
    const stdout = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: BUDGET_MS,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { answered: true, ...JSON.parse(stdout.trim()) };
  } catch (error) {
    return { answered: false, killed: error.killed === true, signal: error.signal ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["SEC-004", "DYN-001"],
    title: "a document the parser accepts builds the form it describes",
    environments: ["node"],
  },
  async (ctx) => {
    // Depth is something this contract bounds elsewhere, with numbers it publishes and enforces by
    // refusing. Named here because it is what makes the tree's silence an omission.
    ctx.log.note("depths the contract does declare", {
      layout: MDY_LAYOUT_MAX_DEPTH,
      expression: MDY_MAX_EXPRESSION_DEPTH,
    });

    expectClaim(Number.isInteger(MDY_LAYOUT_MAX_DEPTH) && Number.isInteger(MDY_MAX_EXPRESSION_DEPTH), {
      claimIds: ["DYN-001"],
      what: "the published depth limits are not numbers, so the comparison this battle draws has no basis",
      detail: JSON.stringify({ MDY_LAYOUT_MAX_DEPTH, MDY_MAX_EXPRESSION_DEPTH }),
    });

    for (const kind of ["record", "array"]) {
      for (const depth of LADDER) {
        const outcome = parseAndBuild(depth, kind);
        ctx.log.note("a document nesting one collection", { kind, depth, outcome });

        // A document that takes longer than the budget has stopped answering by itself.
        expectClaim(outcome.answered, {
          claimIds: ["SEC-004"],
          what: `a ${kind} nested ${depth} deep did not finish within ${BUDGET_MS}ms`,
          detail: JSON.stringify(outcome),
        });

        // The property: refused at the door, or buildable. Never vetted and then fatal.
        expectClaim(!(outcome.accepted === true && outcome.createThrew !== null), {
          claimIds: ["SEC-004", "DYN-001"],
          what: `a ${kind} nested ${depth} deep parsed clean and then threw ${outcome.createThrew} when the form was built`,
          detail: JSON.stringify(outcome),
        });
      }
    }
  },
);

battle(
  {
    claims: ["SEC-004"],
    title: "an ordinary document goes through the same three steps",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the child process, the parse, the build and the form all work on a document with
    // nothing wrong with it. Without this, a failure above could be the harness rather than a depth.
    const shallow = parseAndBuild(2, "record");
    ctx.log.note("a document nobody would call deep", shallow);

    expectClaim(shallow.answered && shallow.accepted === true && shallow.createThrew === null, {
      claimIds: ["SEC-004"],
      what: "a two-deep document did not parse and build, so the ladder above measures the harness",
      detail: JSON.stringify(shallow),
    });
  },
);
