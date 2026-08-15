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

import { parseDynamicForm } from "@modyra/core";

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
