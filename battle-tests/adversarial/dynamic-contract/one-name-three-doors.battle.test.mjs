/**
 * The same name, at each door a document has.
 *
 * A field's name arrives through three of them: a flat `fields` list, a child key in a `schema` tree,
 * and a child key inside a collection's item. They are three spellings of one thing, so a name the
 * contract refuses at one of them is a name it refuses at all three — otherwise which shape an author
 * chose decides whether their mistake is caught.
 *
 * Finding 83 is recorded closed on the strength of the first door: a name carrying whitespace is
 * refused "where the document is read, so the two halves of the same sentence are enforced in the same
 * place". It is refused at the flat list. A tree document declaring the same name parses `ok`, with no
 * diagnostic, and builds a form that holds it — and the renderer is then the one to refuse it, which
 * is the arrangement the repair was meant to end.
 *
 * The battle sweeps names rather than asserting one, and the reserved names are the control: those are
 * refused at every door, so the tree door does check names and the whitespace one is a hole in the
 * check rather than the absence of it.
 */

import {
  buildDynamicFormSchema,
  buildFlatFormSchema,
  createForm,
  flattenDynamicForm,
  isSafeFieldPath,
  parseDynamicForm,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = { node: "field", field: { kind: "text", label: "L" } };

/** One name, put through each door a document has. */
const doors = Object.freeze({
  "a flat list": (name) => ({ version: 3, fields: [{ name, kind: "text", label: "L" }] }),
  "a tree child": (name) => ({ version: 3, schema: { node: "group", children: { [name]: leaf } } }),
  "a cell in a collection": (name) => ({
    version: 3,
    schema: { node: "group", children: {
      rows: { node: "record", label: "R", item: { node: "group", children: { [name]: leaf } } },
    } },
  }),
});

/** Names the contract has something to say about, and one it does not. */
const NAMES = Object.freeze([
  ["__proto__", true],
  ["constructor", true],
  ["a.b", true],
  ["", true],
  ["  ", true],
  ["ordinary", false],
]);

const refused = (document) => {
  const parsed = parseDynamicForm(document, { mode: "strict" });
  return { ok: parsed.ok, said: (parsed.diagnostics ?? []).map((each) => each.code ?? "?") };
};

battle(
  {
    claims: ["SEC-001", "DYN-003"],
    title: "a name the contract refuses at one door is refused at all of them",
    environments: ["node"],
  },
  async (ctx) => {
    const table = {};
    for (const [name] of NAMES) {
      table[JSON.stringify(name)] = {};
      for (const [door, build] of Object.entries(doors)) {
        const outcome = refused(build(name));
        table[JSON.stringify(name)][door] = outcome.said.length > 0 || !outcome.ok;
      }
    }
    ctx.log.note("which door refuses which name", { table });

    // The control at one end: an ordinary name is accepted everywhere, so a refusal below is the
    // name and not a door that refuses whatever it is given.
    for (const door of Object.keys(doors)) {
      expectEqual(table['"ordinary"'][door], false, {
        claimIds: ["DYN-003"],
        what: `${door} refused an ordinary name`,
      });
    }

    // The control at the other: the reserved names are refused at every door, so each door does check
    // a name, and a hole below is in the check rather than in its absence.
    for (const reserved of ['"__proto__"', '"constructor"', '"a.b"']) {
      for (const door of Object.keys(doors)) {
        expectEqual(table[reserved][door], true, {
          claimIds: ["SEC-001"],
          what: `${door} accepted ${reserved}, so it does not check names at all`,
        });
      }
    }

    // And the question: every name some door refuses is refused by all of them.
    const uneven = [];
    for (const [name, shouldRefuse] of NAMES) {
      if (!shouldRefuse) continue;
      const key = JSON.stringify(name);
      const answers = Object.entries(table[key]);
      if (answers.some(([, r]) => r) && answers.some(([, r]) => !r)) {
        uneven.push({ name, byDoor: table[key] });
      }
    }

    expectEqual(uneven, [], {
      claimIds: ["SEC-001", "DYN-003"],
      what: "a name one door refuses another takes, so which shape an author wrote decides whether their mistake is caught",
    });
  },
);

/** A record whose initial keys include one made of spaces, which a CMS or a saved project can hold. */
const withARowKeyOf = (key) => ({
  node: "group",
  children: {
    rows: {
      node: "record",
      label: "R",
      initialValue: { [key]: { c: "x" }, ok: { c: "y" } },
      item: { node: "group", children: { c: { node: "field", field: { kind: "text", label: "C" } } } },
    },
  },
});

const builds = (make) => {
  try {
    const form = createForm(make(), { reactivity: vanillaReactivity(), devWarnings: false });
    const value = form.getValue();
    form.destroy();
    return { built: true, value };
  } catch (error) {
    return { built: false, threw: String(error.message).slice(0, 140) };
  }
};

battle(
  {
    claims: ["SEC-001", "DYN-002"],
    title: "one document, two build routes, one answer",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary row key builds by both routes and holds the same value, so a
    // disagreement below is the key rather than the two routes never agreeing.
    const ordinary = withARowKeyOf("fine");
    const ordinaryFlat = flattenDynamicForm(ordinary);
    const byTree = builds(() => buildDynamicFormSchema(ordinary));
    const byFlat = builds(() => buildFlatFormSchema(ordinaryFlat.fields, ordinaryFlat.collections));
    expectClaim(byTree.built && byFlat.built, {
      claimIds: ["DYN-002"],
      what: "an ordinary row key did not build by both routes",
      detail: JSON.stringify({ byTree, byFlat }),
    });
    expectEqual(byFlat.value, byTree.value, {
      claimIds: ["DYN-002"],
      what: "an ordinary row key built two different values",
    });

    // The same document with a row key made of spaces.
    const spaced = withARowKeyOf("  ");
    const spacedFlat = flattenDynamicForm(spaced);
    const parsed = parseDynamicForm({ version: 3, schema: spaced }, { mode: "strict" });
    const tree = builds(() => buildDynamicFormSchema(spaced));
    const flat = builds(() => buildFlatFormSchema(spacedFlat.fields, spacedFlat.collections));
    ctx.log.note("a row key of spaces, by each route", {
      flattenedNames: spacedFlat.fields.map((each) => each.name),
      parse: { ok: parsed.ok, said: (parsed.diagnostics ?? []).map((each) => each.code) },
      tree,
      flat,
      isSafeFieldPath: { "  ": isSafeFieldPath("  "), "a b": isSafeFieldPath("a b") },
    });

    // Either both routes take it or both refuse it. What must not happen is that the pair of
    // published functions disagrees about the same document.
    expectEqual(flat.built, tree.built, {
      claimIds: ["SEC-001", "DYN-002"],
      what: "one build route took a document the other refused, so which pair of functions a consumer called decides whether their document works",
      detail: JSON.stringify({ tree, flat }),
    });
  },
);
