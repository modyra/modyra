/**
 * A document the parser passes and the engine cannot build.
 *
 * `parseDynamicForm` is what an author has before anything is rendered, and `mode: "strict"` is what
 * `docs/guides/ai-generated-forms.md` names to run "before publishing a stored contract or accepting"
 * one. Its job is to say what is wrong while there is still somewhere to say it.
 *
 * It checks a field's `kind` against the declared vocabulary, and it stops at a collection. A field
 * inside a `record` or an `array` item may declare any kind at all: the parse is `ok`, the diagnostic
 * list is empty, in every mode, at every depth. Then `buildDynamicFormSchema` throws
 * `[modyra] Unknown dynamic field kind`, which is the engine doing its job at the point where a user
 * is already waiting.
 *
 * The control is the same document with the same bad kind at the top level, where it is reported as
 * `MDY_DYNAMIC_UNKNOWN_KIND`. The check exists; it does not go inside a row.
 *
 * The invariant is written as the thing that actually matters rather than as "diagnose this kind": a
 * document the parser accepts must be one the engine can build. Reporting the kind passes. Refusing
 * the document passes. Building a form that survives an unknown kind would pass too.
 *
 * The second battle asks the same question of every check rather than of one: a mistake the parser
 * reports at the top of a document, made instead inside a row, must still be reported. It is the
 * wider statement, and it catches a case the first does not — a field whose `validators.pattern` is a
 * number is `MDY_DYNAMIC_INVALID_FIELD` at the top and nothing inside a row, and the form builds
 * either way, so only the silence is wrong.
 */

import { buildDynamicFormSchema, createForm, parseDynamicForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = (kind) => ({ node: "field", field: { kind, label: "L" } });

/** A document whose one interesting field sits `where` — at the top, or inside a row. */
function documentWith(kind, where) {
  const cell = { node: "group", children: { cell: leaf(kind) } };
  if (where === "top") {
    return { version: 3, schema: { node: "group", children: { top: leaf(kind) } } };
  }
  if (where === "record") {
    return { version: 3, schema: { node: "group", children: { rows: { node: "record", label: "R", item: cell } } } };
  }
  if (where === "array") {
    return { version: 3, schema: { node: "group", children: { rows: { node: "array", label: "A", item: cell } } } };
  }
  // Two levels: an array inside a record.
  return {
    version: 3,
    schema: { node: "group", children: {
      rows: { node: "record", label: "R", item: { node: "group", children: {
        inner: { node: "array", label: "A", item: cell },
      } } },
    } },
  };
}

/** Whether the engine can build a running form from this document. */
function builds(document) {
  try {
    const form = createForm(buildDynamicFormSchema(document.schema), {
      reactivity: vanillaReactivity(),
      devWarnings: false,
    });
    form.destroy();
    return { built: true, threw: null };
  } catch (error) {
    return { built: false, threw: String(error.message).slice(0, 120) };
  }
}

const PLACES = Object.freeze(["top", "record", "array", "two levels"]);
const MODES = Object.freeze([undefined, "strict", "lenient"]);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a document the parser accepts is one the engine can build",
    open: "reported, not enforced: finding 101, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the same shapes with a kind that exists parse clean and build, so a failure below
    // is the unknown kind rather than the nesting.
    for (const where of PLACES) {
      const good = documentWith("text", where);
      const parsed = parseDynamicForm(good, { mode: "strict" });
      const outcome = builds(good);
      expectClaim(parsed.ok && (parsed.diagnostics ?? []).length === 0 && outcome.built, {
        claimIds: ["DYN-001"],
        what: `a well-formed document with its field ${where} did not parse and build, so this battle cannot tell nesting from an unknown kind`,
        detail: JSON.stringify({ where, ok: parsed.ok, diagnostics: parsed.diagnostics, ...outcome }),
      });
    }

    // The other control: at the top level the check is there and names itself.
    const atTheTop = parseDynamicForm(documentWith("wormhole", "top"));
    ctx.log.note("an unknown kind at the top level", {
      diagnostics: (atTheTop.diagnostics ?? []).map((each) => each.code),
    });
    expectClaim((atTheTop.diagnostics ?? []).some((each) => each.code === "MDY_DYNAMIC_UNKNOWN_KIND"), {
      claimIds: ["DYN-003"],
      what: "an unknown kind is not reported even at the top level, so there is no check for this battle to find the edge of",
      detail: JSON.stringify(atTheTop.diagnostics),
    });

    const accepted = [];
    for (const where of PLACES.filter((each) => each !== "top")) {
      for (const mode of MODES) {
        const document = documentWith("wormhole", where);
        const parsed = parseDynamicForm(document, mode === undefined ? undefined : { mode });
        const said = (parsed.diagnostics ?? []).map((each) => each.code ?? each.message ?? "?");
        const outcome = builds(document);
        ctx.log.note("an unknown kind inside a row", { where, mode: mode ?? "(default)", ok: parsed.ok, said, ...outcome });

        // What must not happen: the parser passes it and the engine cannot build it.
        if (parsed.ok && said.length === 0 && !outcome.built) {
          accepted.push({ where, mode: mode ?? "(default)", threw: outcome.threw });
        }
      }
    }

    expectEqual(accepted, [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: "the parser accepted a document without a word and the engine then refused to build it",
    });
  },
);

/**
 * Every mistake the parser has something to say about, each as one leaf node.
 *
 * Not a chosen pair: this is the whole set of field-level mistakes that produce a diagnostic at the
 * top of a document, and the point of the battle is that the same set produces none inside a row.
 */
const MISTAKES = Object.freeze({
  "a kind nobody declared": { kind: "wormhole", label: "L" },
  "a label that is not a string": { kind: "text", label: 7 },
  "a pattern that is not a string": { kind: "text", label: "L", validators: { pattern: 7 } },
  "a min that is not a number": { kind: "number", label: "L", validators: { min: "five" } },
  "a required that is not a boolean": { kind: "text", label: "L", validators: { required: "yes" } },
  "a pattern past the length limit": { kind: "text", label: "L", validators: { pattern: "a".repeat(300) } },
  "a pattern that backtracks": { kind: "text", label: "L", validators: { pattern: "(a+)+$" } },
  "a select with no options": { kind: "select", label: "L" },
  "options that are not a list": { kind: "select", label: "L", options: "x" },
  "an option with no label": { kind: "select", label: "L", options: [{ value: "a" }] },
});

/** The same leaf, at the top of a document and inside a row of one. */
const atTheTop = (field) => ({ version: 3, schema: { node: "group", children: { f: { node: "field", field } } } });
const insideARow = (field) => ({
  version: 3,
  schema: { node: "group", children: {
    rows: { node: "record", label: "R", item: { node: "group", children: { f: { node: "field", field } } } },
  } },
});

battle(
  {
    claims: ["DYN-003", "COL-001"],
    title: "a mistake the parser reports at the top it reports inside a row",
    environments: ["node"],
  },
  async (ctx) => {
    const codesOf = (parsed) => (parsed.diagnostics ?? []).map((each) => each.code ?? "?");
    const unreported = [];

    for (const [what, leaf] of Object.entries(MISTAKES)) {
      const top = codesOf(parseDynamicForm(atTheTop(leaf), { mode: "strict" }));
      const inside = codesOf(parseDynamicForm(insideARow(leaf), { mode: "strict" }));
      ctx.log.note("the same mistake in two places", { what, top, inside });

      // The control: it really is a mistake the parser has something to say about. A trigger that is
      // silent at the top too is not evidence about rows.
      expectClaim(top.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what} is not reported even at the top of a document, so it says nothing about what happens inside a row`,
        detail: JSON.stringify({ top }),
      });

      if (inside.length === 0) unreported.push({ what, top, inside });
    }

    expectEqual(unreported, [], {
      claimIds: ["DYN-003", "COL-001"],
      what: "a mistake the parser names at the top of a document is passed over in silence one row down",
    });
  },
);
