/**
 * A parser's account of its own work.
 *
 * `parseDynamicForm` returns `acceptedCount` and `rejectedCount` beside the fields and the
 * diagnostics. They are how a consumer reports on an untrusted document without re-deriving the
 * answer: "3 fields, 1 rejected — here is why". The guide's whole section on AI-generated documents
 * rests on that account being true, because the document came from somewhere the application does
 * not control.
 *
 * The account does not survive a document with something unknown in it. Two valid fields beside one
 * node whose kind nobody declared come back as no fields at all, `acceptedCount` 0 and
 * `rejectedCount` 0 — three children in, none accepted, none reported as rejected. A field whose
 * *kind* is unknown, or which has no kind, disappears the same way with no diagnostic naming it.
 *
 * Whether the valid fields should have survived is a question this battle deliberately does not
 * answer. The guide says lenient mode is for previews and that "valid fields survive"; claim DYN-003
 * records the opposite position — the whole document is refused when any part is unknown — for the
 * lint rule that reads the same contract. Both are defensible and they cannot both be the rule here.
 *
 * What is wrong under either reading is the counting. If the document was refused whole, three
 * children were rejected and the count says none. If the valid fields should have survived, they did
 * not. The assertions below are the ones that hold whichever way that decision goes.
 *
 * The same silence reaches the gate that is supposed to stop it. `mode: "strict"` is what the guide
 * says to run before accepting a document into a registry, and its rule is that any diagnostic makes
 * `ok` false. A select declared with no options at all produces no diagnostic, so `ok` stays true —
 * for a document whose only field the parser has already dropped. What is stored renders nothing
 * where a select was, and building a form from it directly raises a `TypeError` about reading `map`
 * of undefined.
 */

import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const field = (label) => ({ node: "field", field: { kind: "text", label } });
const parse = (children) =>
  parseDynamicForm({ version: 2, schema: { node: "group", children } }, { mode: "lenient" });

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a parser that dropped something says how much it dropped",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a document with nothing wrong is counted exactly, so what follows is about the
    // unknown node rather than about counters that never work.
    const clean = parse({ a: field("A"), b: field("B") });
    ctx.log.note("a document with nothing wrong", {
      fields: clean.fields.map((each) => each.name),
      accepted: clean.acceptedCount,
      rejected: clean.rejectedCount,
    });

    expectEqual([clean.fields.length, clean.acceptedCount, clean.rejectedCount], [2, 2, 0], {
      claimIds: ["DYN-001"],
      what: "a clean document was not counted as two accepted and none rejected",
    });

    for (const [what, broken] of [
      ["a node kind nobody declared", { node: "wormhole" }],
      ["a field kind nobody declared", { node: "field", field: { kind: "wormhole" } }],
      ["a field with no kind at all", { node: "field", field: {} }],
    ]) {
      const parsed = parse({ a: field("A"), b: field("B"), odd: broken });
      const kept = parsed.fields.map((each) => each.name);
      ctx.log.note("a document with something unknown in it", {
        what,
        kept,
        accepted: parsed.acceptedCount,
        rejected: parsed.rejectedCount,
        diagnostics: parsed.diagnostics.map((each) => each.code),
      });

      // Three children went in. Whatever the parser decided to do with them, the number it kept and
      // the number it says it rejected have to add up to the number it was given.
      expectEqual(kept.length + parsed.rejectedCount, 3, {
        claimIds: ["DYN-003"],
        what:
          `${what}: three children were parsed, ${kept.length} came back and ${parsed.rejectedCount} ` +
          `are reported as rejected`,
        detail: JSON.stringify({ kept, accepted: parsed.acceptedCount, rejected: parsed.rejectedCount }),
      });

      // And whatever was dropped is explained. A child that disappears without a diagnostic is a
      // document a consumer cannot debug and a person cannot be told about.
      expectClaim(parsed.diagnostics.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what}: a child was dropped and nothing said so`,
        detail: JSON.stringify({ kept, diagnostics: parsed.diagnostics }),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "strict mode refuses a document with anything unknown in it",
    environments: ["node"],
  },
  async (ctx) => {
    // The half of the contract that holds, and the reason the battle above is about counting rather
    // than about the parser being blind: strict mode does exactly what the guide says.
    const strict = (children) =>
      parseDynamicForm({ version: 2, schema: { node: "group", children } }, { mode: "strict" });

    const clean = strict({ a: field("A") });
    expectClaim(clean.ok === true && clean.fields.length === 1, {
      claimIds: ["DYN-001"],
      what: "strict mode refused a document with nothing wrong with it",
      detail: JSON.stringify(clean.diagnostics),
    });

    const refused = strict({ a: field("A"), odd: { node: "wormhole" } });
    ctx.log.note("strict mode against an unknown node", {
      ok: refused.ok,
      fields: refused.fields.length,
      diagnostics: refused.diagnostics.map((each) => `${each.code}@${each.path}`),
    });

    expectEqual([refused.ok, refused.fields.length], [false, 0], {
      claimIds: ["DYN-003"],
      what: "strict mode accepted a document carrying a node nobody declared",
    });

    // The diagnostic names where it is, which is what makes an author able to fix the document.
    expectClaim(refused.diagnostics.some((each) => String(each.path).includes("odd")), {
      claimIds: ["DYN-003"],
      what: "the refusal did not say which part of the document caused it",
      detail: JSON.stringify(refused.diagnostics),
    });
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003", "SEC-001"],
    title: "strict mode does not approve a document whose field it dropped",
    environments: ["node"],
  },
  async (ctx) => {
    const strictly = (field) =>
      parseDynamicForm(
        { version: 2, schema: { node: "group", children: { f: { node: "field", field } } } },
        { mode: "strict" },
      );

    // The control: an option-bearing field declared properly is kept, so the case below is the
    // missing options rather than the kind never being supported.
    const proper = strictly({ kind: "select", label: "S", options: [{ value: "a", label: "A" }] });
    expectEqual([proper.ok, proper.fields.length], [true, 1], {
      claimIds: ["DYN-001"],
      what: "a select declared with options did not survive strict parsing",
      detail: JSON.stringify(proper.diagnostics),
    });

    // And an empty option list is a legitimate document — a select whose choices arrive later. It
    // is kept, which is what makes the missing key below a different thing from an empty one.
    const emptyList = strictly({ kind: "select", label: "S", options: [] });
    expectEqual([emptyList.ok, emptyList.fields.length], [true, 1], {
      claimIds: ["DYN-001"],
      what: "a select declaring no choices yet was refused",
      detail: JSON.stringify(emptyList.diagnostics),
    });

    for (const kind of ["select", "radio", "multiselect", "segmented"]) {
      const parsed = strictly({ kind, label: "F" });
      ctx.log.note("an option-bearing field declared without options", {
        kind,
        ok: parsed.ok,
        kept: parsed.fields.length,
        diagnostics: parsed.diagnostics.map((each) => each.code),
      });

      // Approving a document and keeping none of it are the two halves of the same answer, and the
      // gate gives both at once. Whichever is right, they have to agree.
      expectClaim(parsed.ok === false || parsed.fields.length > 0, {
        claimIds: ["DYN-003", "SEC-001"],
        what: `strict mode approved a ${kind} document and kept none of its fields`,
        detail: JSON.stringify({ ok: parsed.ok, fields: parsed.fields, diagnostics: parsed.diagnostics }),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a document says the same thing about a bad option list in both of its shapes",
    environments: ["node"],
  },
  async (ctx) => {
    // `MDY_DYNAMIC_DIAGNOSTICS` is the published table a consumer maps to their own messages, so the
    // code is read from there rather than written out here: a battle that hardcoded the string would
    // still pass if the table stopped carrying it.
    const entry = MDY_DYNAMIC_DIAGNOSTICS.find((each) => each.code === "MDY_DYNAMIC_OPTIONS_REQUIRED");
    expectClaim(entry !== undefined, {
      claimIds: ["DYN-003"],
      what: "the contract no longer publishes a code for an option list it cannot use",
    });

    // The flat shape, which is where the code fires. This is the control: the diagnostic exists, is
    // reachable, and names the field — so the silence below is the shape of the document rather than
    // a code nobody ever emits.
    const flat = parseDynamicForm([{ name: "a", kind: "select" }], { mode: "lenient" });
    ctx.log.note("a select with no options, written flat", {
      kept: flat.fields.length,
      codes: flat.diagnostics.map((each) => each.code),
    });

    expectClaim(flat.diagnostics.some((each) => each.code === entry?.code), {
      claimIds: ["DYN-003"],
      what: "the flat shape stopped reporting a select whose option list it cannot use",
      detail: JSON.stringify(flat.diagnostics),
    });

    // The same field, in the shape the current spec describes. A consumer who moved from the flat
    // list to the tree keeps the same malformed document and stops being told about it.
    for (const kind of ["select", "radio", "multiselect", "segmented"]) {
      const tree = parseDynamicForm(
        { version: 2, schema: { node: "group", children: { a: { node: "field", field: { kind, label: "F" } } } } },
        { mode: "lenient" },
      );
      ctx.log.note("the same field, written as a tree", {
        kind,
        kept: tree.fields.length,
        codes: tree.diagnostics.map((each) => each.code),
      });

      expectClaim(tree.fields.length > 0 || tree.diagnostics.length > 0, {
        claimIds: ["DYN-001", "DYN-003"],
        what: `a ${kind} with no options was dropped from a v2 document with nothing said, where the same field written flat is reported`,
        detail: JSON.stringify({ kept: tree.fields.length, diagnostics: tree.diagnostics }),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a defect a flat document is told about is one a tree document is told about",
    environments: ["node"],
  },
  async (ctx) => {
    const flat = (fields) => parseDynamicForm(fields, { mode: "lenient" });
    const tree = (name, field) =>
      parseDynamicForm(
        { version: 2, schema: { node: "group", children: { [name]: { node: "field", field } } } },
        { mode: "lenient" },
      );

    // The control: a field with nothing wrong with it is kept and reported on identically in both
    // shapes, so a difference below is the defect rather than the shape.
    const goodFlat = flat([{ name: "a", kind: "text" }]);
    const goodTree = tree("a", { kind: "text", label: "F" });
    expectEqual(
      [goodFlat.fields.length, goodFlat.diagnostics.length, goodTree.fields.length, goodTree.diagnostics.length],
      [1, 0, 1, 0],
      {
        claimIds: ["DYN-001"],
        what: "the two shapes already disagree about a field with nothing wrong with it",
      },
    );

    // And the one that does agree, which is why this is about reporting rather than about the tree
    // parser checking nothing: a name the contract forbids is refused in both shapes, by name.
    const unsafeFlat = flat([{ name: "__proto__", kind: "text" }]);
    const unsafeTree = parseDynamicForm(
      JSON.parse('{"version":2,"schema":{"node":"group","children":{"__proto__":{"node":"field","field":{"kind":"text","label":"F"}}}}}'),
      { mode: "lenient" },
    );
    expectClaim(unsafeFlat.diagnostics.length > 0 && unsafeTree.diagnostics.length > 0, {
      claimIds: ["DYN-003"],
      what: "a name the contract forbids is not reported in both shapes",
      detail: JSON.stringify({ flat: unsafeFlat.diagnostics, tree: unsafeTree.diagnostics }),
    });

    for (const [what, fields, field] of [
      ["a kind nobody declared", [{ name: "a", kind: "wormhole" }], { kind: "wormhole", label: "F" }],
      ["no kind at all", [{ name: "a" }], { label: "F" }],
      ["a select with no options", [{ name: "a", kind: "select" }], { kind: "select", label: "F" }],
      ["a select whose options are not a list", [{ name: "a", kind: "select", options: "x" }], { kind: "select", label: "F", options: "x" }],
      [
        "a pattern that backtracks exponentially",
        [{ name: "a", kind: "text", validators: { pattern: "(a+)+$" } }],
        { kind: "text", label: "F", validators: { pattern: "(a+)+$" } },
      ],
    ]) {
      const asList = flat(fields);
      const asTree = tree("a", field);
      ctx.log.note("one defect in both shapes", {
        what,
        flat: { kept: asList.fields.length, codes: asList.diagnostics.map((each) => each.code) },
        tree: { kept: asTree.fields.length, codes: asTree.diagnostics.map((each) => each.code) },
      });

      // The flat shape names each of these. The tree shape drops the field, or the rule inside it,
      // and says nothing — so a document that lost a rule the author wrote looks like one that
      // never had it, and the form accepts what the document said to refuse.
      expectClaim(asList.diagnostics.length === 0 || asTree.diagnostics.length > 0, {
        claimIds: ["DYN-001", "DYN-003"],
        what: `${what}: reported as a flat field list, silent as a v2 document`,
        detail: JSON.stringify({
          flat: asList.diagnostics.map((each) => each.code),
          tree: asTree.diagnostics.map((each) => each.code),
        }),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "the same document names every other kind of defect it carries",
    environments: ["node"],
  },
  async (ctx) => {
    // The scope of the silence, measured from the other side. A v2 document's rules, validations and
    // layout are all checked and every defect in them is named — so the parser has the machinery and
    // uses it everywhere except on the fields themselves.
    const field = { node: "field", field: { kind: "text", label: "F" } };
    const envelope = (extra) => ({
      version: 2,
      schema: { node: "group", children: { a: field, b: field } },
      ...extra,
    });

    // Each of these is written in the shape `spec/dynamic-form-v3.schema.json` describes, so a
    // refusal is about the defect rather than about the spelling.
    const workingRule = { effect: "hidden", target: "b", when: { field: "a", operator: "equals", value: "x" } };

    const accepted = parseDynamicForm(envelope({ rules: [workingRule] }), { mode: "strict" });
    ctx.log.note("a rule with nothing wrong with it", {
      ok: accepted.ok,
      diagnostics: accepted.diagnostics.map((each) => each.code),
    });

    expectEqual([accepted.ok, accepted.diagnostics.length], [true, 0], {
      claimIds: ["DYN-001"],
      what: "a rule written the way the spec describes was refused, so the refusals below prove nothing",
      detail: JSON.stringify(accepted.diagnostics),
    });

    for (const [what, extra] of [
      ["a rule aimed at a field nobody declared", { rules: [{ ...workingRule, target: "nope" }] }],
      ["a rule reading a field nobody declared", { rules: [{ ...workingRule, when: { ...workingRule.when, field: "nope" } }] }],
      ["a rule with an effect nobody declared", { rules: [{ ...workingRule, effect: "wormhole" }] }],
      ["a rule with an operator nobody declared", { rules: [{ ...workingRule, when: { ...workingRule.when, operator: "wormhole" } }] }],
      ["a rule aimed at __proto__", { rules: [{ ...workingRule, target: "__proto__" }] }],
      [
        "a validation aimed at a field nobody declared",
        { validations: [{ when: { op: "equals", operands: [{ path: "a" }, "x"] }, message: "no", target: "nope" }] },
      ],
      ["a layout placing a field nobody declared", { layout: { id: "l", kind: "section", children: [{ id: "s", field: "nope" }] } }],
    ]) {
      const parsed = parseDynamicForm(envelope(extra), { mode: "lenient" });
      const strict = parseDynamicForm(envelope(extra), { mode: "strict" });
      ctx.log.note("a defect outside the fields", {
        what,
        codes: parsed.diagnostics.map((each) => each.code),
        strictOk: strict.ok,
      });

      expectClaim(parsed.diagnostics.length > 0 && strict.ok === false, {
        claimIds: ["DYN-003"],
        what: `${what} was accepted without a word`,
        detail: JSON.stringify({ lenient: parsed.diagnostics, strictOk: strict.ok }),
      });
    }
  },
);
