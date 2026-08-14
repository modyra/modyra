/**
 * A document deep enough that reading it and building it disagree.
 *
 * ADR 0043 removed the one-positional-level rule: a collection may hold a collection at any depth.
 * "Any depth" is not what a recursive walk can do, so the document validator was rewritten as an
 * explicit stack — deliberately, because a document is untrusted input and the thing that must not
 * decide how deep it may go is the call stack.
 *
 * The walks that come after it were not. `parseDynamicForm` and `flattenDynamicForm` accept a
 * document three thousand levels deep and report no diagnostic; `buildDynamicFormSchema` and
 * `createForm` then raise `RangeError: Maximum call stack size exceeded`. So a document passes every
 * check the contract offers and fails when it is used — and fails as a stack overflow rather than as
 * anything a consumer can catch by name, at a depth that is a property of how much stack was left
 * rather than of the document.
 *
 * The battle does not pin a number, because there is not a stable one to pin. It pins the
 * relationship: whatever the parser accepts, the builder has to carry — or the parser has to say so.
 */

import { buildDynamicFormSchema, createForm, flattenDynamicForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/**
 * A document nesting one array inside another, `levels` deep.
 *
 * Built iteratively. A recursive builder overflows before the code under attack is reached, which is
 * how a probe becomes a finding about itself.
 */
function nestedDocument(levels) {
  let item = { node: "group", children: { leaf: { node: "field", field: { kind: "text", label: "Leaf" } } } };
  for (let level = 0; level < levels; level += 1) {
    item = { node: "group", children: { inner: { node: "array", item } } };
  }
  return { version: 3, id: "deep", schema: item };
}

/** What each step of the contract does with a document, without letting one step hide another. */
function walk(document) {
  const outcome = { parsed: null, diagnostics: null, flattened: null, built: null };
  try {
    const parsed = parseDynamicForm(document);
    outcome.parsed = parsed.ok;
    outcome.diagnostics = parsed.diagnostics.length;
  } catch (error) {
    outcome.parsed = `raised ${error.constructor.name}`;
  }
  try {
    flattenDynamicForm(document.schema);
    outcome.flattened = true;
  } catch (error) {
    outcome.flattened = `raised ${error.constructor.name}`;
  }
  try {
    const form = createForm(buildDynamicFormSchema(document.schema), { devWarnings: false });
    form.destroy();
    outcome.built = true;
  } catch (error) {
    outcome.built = `raised ${error.constructor.name}`;
  }
  return outcome;
}

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "a document the contract accepts is a document the engine can build",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary depth passes every step, so a failure below is about how deep the
    // document is rather than about the shape being wrong.
    const ordinary = walk(nestedDocument(20));
    ctx.log.note("an ordinarily nested document", ordinary);

    expectClaim(ordinary.parsed === true && ordinary.flattened === true && ordinary.built === true, {
      claimIds: ["DYN-001"],
      what: "a twenty-level document did not survive every step of the contract",
      detail: JSON.stringify(ordinary),
    });

    // Deep enough that the recursive walks run out of stack while the stack-based one does not.
    // Three thousand is far past anything a person writes and well within what a generator, a CMS
    // or a hostile POST can produce.
    const deep = walk(nestedDocument(3000));
    ctx.log.note("a document three thousand levels deep", deep);

    // Whichever way it is answered, the steps have to agree. A parser that accepts what the builder
    // cannot carry hands a consumer a document that is valid right up to the moment they use it.
    const accepted = deep.parsed === true && deep.diagnostics === 0;
    expectClaim(accepted === (deep.built === true), {
      claimIds: ["SEC-001", "DYN-001"],
      what: "the contract accepted a document the engine then could not build",
      detail: JSON.stringify(deep),
    });

    // And however it ends, it may not end as a stack overflow. A `RangeError` from inside a walk is
    // not something a consumer can catch by name, says nothing about which document was too deep or
    // where, and is the same error a bug in their own code would produce.
    expectClaim(deep.built === true, {
      claimIds: ["SEC-001"],
      what: "building a document the contract accepted raised a stack overflow",
      detail: `build ${JSON.stringify(deep.built)} after parse ${JSON.stringify(deep.parsed)} with ${deep.diagnostics} diagnostic(s)`,
    });
  },
);
