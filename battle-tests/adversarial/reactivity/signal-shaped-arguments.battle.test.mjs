/**
 * An argument the engine cannot use, kept anyway.
 *
 * Five setters on a form take a *reactive* argument: `setDisabled`, `setReadonly` and `setInactive`
 * take a zero-argument function, `addValidators` and `upsertValidators` take a list. They are the
 * adapter-facing surface — an adapter passes a framework's own reactive value through them on every
 * binding — and the guide already warns adapter authors in prose that a ref or a plain boolean is
 * not what these expect.
 *
 * The prose is the whole guard. A value the engine cannot call is accepted without complaint and
 * stored, and the failure surfaces later, somewhere else, in every read that composes it:
 * `disabled()`, `readonly()`, `state.valid()` and `submitValue()` throw a `TypeError` naming
 * `disabledSignal` — an internal the caller has never heard of and did not name. `getValue()` keeps
 * answering, so the form looks alive while it can no longer be validated or submitted.
 *
 * Either answer is defensible: refuse the argument at the call, or hold something the reads can
 * survive. What a public setter may not do is take the argument, return, and leave the form to
 * fail every later question.
 *
 * That this is a gap rather than a house style is what the second battle here establishes. Every
 * other public entry point on a form, a collection handle and a cell — patch, setValue, upsert,
 * setAll, rename, remove, cell, set — was handed the same seven wrong-shaped values and left the
 * form answering all of them. `getField` and `removeField` go further and refuse everything that is
 * not a path. The engine checks its arguments where they arrive; these setters are the exception.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";
import { buildSchema, KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

const PATH = "rows.a.code";

function openWithRow() {
  const reactivity = vanillaReactivity();
  const form = createForm(buildSchema(KEYED_ROWS_SPEC).schema, { reactivity, devWarnings: false });
  form.f.rows.upsert("a", { code: "A" });
  return { form, reactivity };
}

/** The reads a form owes an application after any setter returns. */
const READS = Object.freeze([
  ["getValue", (form) => form.getValue()],
  ["disabled", (form) => form.f.rows.cell("a", "code").disabled()],
  ["readonly", (form) => form.f.rows.cell("a", "code").readonly()],
  ["valid", (form) => form.state.valid()],
  ["submitValue", (form) => form.submitValue()],
  ["errors", (form) => form.errorsFor(PATH)()],
]);

/** The setters that take a reactive argument, each with a value that is not one. */
const SETTERS = Object.freeze([
  ["setDisabled", (form) => form.setDisabled(PATH, true)],
  ["setReadonly", (form) => form.setReadonly(PATH, true)],
  ["setInactive", (form) => form.setInactive(PATH, true)],
  ["addValidators", (form) => form.addValidators(PATH, "not a list of validators")],
  ["upsertValidators", (form) => form.upsertValidators(PATH, "not a list of validators")],
]);

function readsThatThrow(form) {
  return READS.filter(([, read]) => {
    try {
      read(form);
      return false;
    } catch {
      return true;
    }
  }).map(([name]) => name);
}

battle(
  {
    claims: ["REA-002", "VAL-002"],
    title: "a setter given something it cannot call says so, instead of leaving the form to fail later",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the documented shape. A zero-argument function is what the guide shows, and with
    // it every read below answers — so a failure further down is the argument rather than the reads
    // being unreachable from a collection cell.
    const { form: healthy } = openWithRow();
    healthy.setDisabled(PATH, () => true);
    const brokenWhenHealthy = readsThatThrow(healthy);
    ctx.log.note("the documented argument", { throwing: brokenWhenHealthy });

    expectClaim(brokenWhenHealthy.length === 0, {
      claimIds: ["VAL-002"],
      what: "a form given the documented argument could not answer its own reads",
      detail: brokenWhenHealthy.join(", "),
    });

    expectClaim(healthy.f.rows.cell("a", "code").disabled() === true, {
      claimIds: ["VAL-002"],
      what: "the documented argument did not disable the cell",
    });
    healthy.destroy();

    for (const [name, call] of SETTERS) {
      const { form } = openWithRow();

      let refused = false;
      try {
        call(form);
      } catch {
        refused = true;
      }

      const throwing = refused ? [] : readsThatThrow(form);
      ctx.log.note("a setter handed a value it cannot use", { setter: name, refused, throwing });

      // Refusing at the call is a fine answer. So is holding it and answering. Accepting and then
      // failing every later read is the one shape that leaves the caller without a cause.
      expectClaim(refused || throwing.length === 0, {
        claimIds: ["REA-002", "VAL-002"],
        what:
          `${name} accepted an argument it cannot use and left the form unable to answer ` +
          `${throwing.join(", ")}`,
        detail:
          "the call returned normally, so nothing names the argument as the cause; the reads fail " +
          "afterwards with a TypeError naming an internal",
      });

      try {
        form.destroy();
      } catch {
        // A form that cannot even be torn down is the same finding, already stated above.
      }
    }
  },
);

battle(
  {
    claims: ["REA-002"],
    title: "the engine checks a path at the door, and this is what makes the setter a gap",
    environments: ["node"],
  },
  async (ctx) => {
    // A path-taking entry point refuses everything that is not a path, at the call. That is the
    // convention the setters above depart from — the same kind of parameter, the opposite answer.
    for (const wrong of [undefined, null, 42, [], {}, () => "x"]) {
      let refused = false;
      const { form } = openWithRow();
      try {
        form.getField(wrong);
      } catch {
        refused = true;
      }
      ctx.log.note("a path-taking entry point handed something that is not a path", {
        given: typeof wrong,
        refused,
      });

      expectClaim(refused, {
        claimIds: ["REA-002"],
        what: `getField accepted ${String(wrong)} as a field path`,
      });
      form.destroy();
    }

    // And the control on the control: a real path is not refused, so the refusals above are the
    // argument rather than getField refusing everything.
    const { form } = openWithRow();
    expectClaim(form.getField(PATH) !== undefined, {
      claimIds: ["REA-002"],
      what: "getField refused a path that names a declared cell",
    });
    form.destroy();
  },
);
