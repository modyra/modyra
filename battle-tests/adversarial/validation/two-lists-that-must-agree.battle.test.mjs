/**
 * The exports nothing had ever imported.
 *
 * Seven names in `@modyra/core`'s public surface appeared in no battle in this suite. Most turned out
 * to be low-level seams — the engine class, the base class, an error type — reached through something
 * else. Two are worth holding directly, and one of them guards an invariant that lives in two files
 * and is stated in neither.
 *
 * `MDY_FIELD_KINDS` is the list of kinds a field may be. `MDY_VALUE_CONTRACTS` says, for each kind,
 * what a value of that kind may hold. They are two lists of seventeen and every part of the engine
 * assumes they are the same seventeen: a kind with no value contract has no shape to check against,
 * and a value contract naming no kind is a rule nothing can reach. Nothing checks that they agree, so
 * a kind added to one and not the other is a defect the type system does not see — both are `const`
 * arrays and object literals, not two views of one source.
 *
 * `withFacts` is the other: it is how a hand-written validator says what it enforces, which is what
 * lets a custom rule reach a native constraint. What it declares is what a control promises the
 * browser, so it is asserted to carry exactly what it was given and nothing more.
 */

import {
  MDY_FIELD_KINDS,
  MDY_VALUE_CONTRACTS,
  NO_CONSTRAINTS,
  factsOf,
  minLength,
  parseDynamicForm,
  withFacts,
} from "@modyra/core";
import { MDY_LAYOUT_BREAKPOINTS } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["VAL-004", "DYN-001"],
    title: "the kinds a field may be and the shapes a value may hold are the same list",
    environments: ["node"],
  },
  async (ctx) => {
    const kinds = [...MDY_FIELD_KINDS];
    const contracts = Object.keys(MDY_VALUE_CONTRACTS);
    ctx.log.note("the two lists", { kinds: kinds.length, contracts: contracts.length });

    // The control: neither list is empty, so the comparison below is between two lists rather than
    // between two absences.
    expectClaim(kinds.length > 10 && contracts.length > 10, {
      claimIds: ["DYN-001"],
      what: "one of the two lists is empty or nearly so, so agreeing means nothing",
      detail: JSON.stringify({ kinds: kinds.length, contracts: contracts.length }),
    });

    expectEqual(kinds.filter((kind) => !contracts.includes(kind)), [], {
      claimIds: ["DYN-001"],
      what: "a kind a field may be has no value contract, so nothing states what it may hold",
    });

    expectEqual(contracts.filter((kind) => !kinds.includes(kind)), [], {
      claimIds: ["DYN-001"],
      what: "a value contract names a kind no field may be, so it is a rule nothing can reach",
    });

    // And the baseline a projection starts from: every constraint absent, not merely some of them.
    // A key missing here is a constraint that can never be cleared once something has set it.
    expectEqual(Object.values(NO_CONSTRAINTS).filter((each) => each !== null), [], {
      claimIds: ["VAL-004"],
      what: "the empty constraint set is not empty",
      detail: JSON.stringify(NO_CONSTRAINTS),
    });
  },
);

battle(
  {
    claims: ["VAL-004"],
    title: "a hand-written rule declares exactly what it was given to declare",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a built-in rule declares what it enforces, so `factsOf` is answering rather than
    // returning nothing for everything.
    expectEqual(factsOf(minLength(5)).minLength, 5, {
      claimIds: ["VAL-004"],
      what: "a built-in rule does not declare what it enforces, so nothing below is about withFacts",
    });

    // A plain function declares nothing rather than guessing — which is what makes `withFacts` the
    // only way a custom rule reaches a native constraint, and why what it carries matters.
    expectEqual(factsOf(() => []), {}, {
      claimIds: ["VAL-004"],
      what: "a hand-written rule was read as declaring something nobody wrote",
    });

    const declared = { minLength: 5, required: true };
    const wrapped = withFacts((value) => (String(value).length >= 5 ? [] : [{ kind: "validation", message: "too short" }]), declared);
    ctx.log.note("what a wrapped rule declares", { facts: factsOf(wrapped) });

    expectEqual(factsOf(wrapped), declared, {
      claimIds: ["VAL-004"],
      what: "withFacts carried something other than the facts it was given",
    });

    // And the rule still runs: wrapping is a declaration, not a replacement.
    expectEqual([wrapped("abcde").length, wrapped("abc").length], [0, 1], {
      claimIds: ["VAL-004"],
      what: "withFacts changed what the rule it wrapped decides",
    });
  },
);

battle(
  {
    claims: ["DYN-001", "UI-002"],
    title: "the sizes a document may author are the sizes a renderer paints",
    environments: ["node"],
  },
  async (ctx) => {
    // The reason is stated where the type is declared: *a document declares placements against these
    // names and a renderer paints them, so the two sets have to be the same or a document can author
    // a size nothing draws.* It is solved by derivation — the widget contract derives its breakpoints
    // from the document's — which makes a fourth size a compile error on the side that would
    // otherwise stay silent.
    //
    // Derivation protects the source. It does not protect a build: a package published from a stale
    // compile carries whatever it carried, and a consumer installs the two separately. This is the
    // runtime half of that promise, and it costs nothing.
    const painted = Object.keys(MDY_LAYOUT_BREAKPOINTS);
    ctx.log.note("the sizes a renderer paints", { painted, sizes: MDY_LAYOUT_BREAKPOINTS });

    expectEqual(painted, ["base", "sm", "md", "lg"], {
      claimIds: ["DYN-001", "UI-002"],
      what: "the renderer paints a different set of sizes than a document may author",
      detail: JSON.stringify(MDY_LAYOUT_BREAKPOINTS),
    });

    // And each one is a length a stylesheet can use, since a name with nothing behind it is a size
    // that authors and paints nothing.
    const empty = Object.entries(MDY_LAYOUT_BREAKPOINTS).filter(([, width]) => String(width ?? "").trim() === "");
    expectEqual(empty, [], {
      claimIds: ["UI-002"],
      what: "a size a document may author has no width behind it",
      detail: JSON.stringify(MDY_LAYOUT_BREAKPOINTS),
    });
  },
);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a layout that points at a field the parse dropped is told about",
    environments: ["node"],
  },
  async (ctx) => {
    // A document has two halves that name the same fields — the list and the layout — and the parse
    // may drop from one of them. A layout left pointing at a field nobody kept is a section of a page
    // with nothing in it, and the author is the only one who can fix it.
    const section = (refs) => [{ kind: "section", id: "s1", children: refs }];
    const parse = (fields, refs, mode) =>
      parseDynamicForm({ version: 3, fields, layout: section(refs) }, { mode });

    const good = [{ name: "a", kind: "text", label: "A" }, { name: "b", kind: "text", label: "B" }];

    // The control: a layout naming fields that survived is kept, and unremarked.
    for (const mode of ["lenient", "strict"]) {
      const clean = parse(good, ["a", "b"], mode);
      ctx.log.note("a layout naming fields that are there", { mode, kept: (clean.layout ?? []).length });
      expectEqual([clean.ok, (clean.layout ?? []).length, (clean.diagnostics ?? []).length], [true, 1, 0], {
        claimIds: ["DYN-001"],
        what: `a layout naming two fields that survived was reported on in ${mode} mode`,
        detail: JSON.stringify(clean.diagnostics),
      });
    }

    // And the two ways a reference can be dangling: a field the parse dropped, and one that was never
    // written. Both are the same thing to a renderer.
    for (const [what, fields, refs] of [
      ["a field the parse dropped", [good[0], { name: "b", kind: "wormhole", label: "B" }], ["a", "b"]],
      ["a field nobody wrote", [good[0]], ["a", "ghost"]],
    ]) {
      const seen = parse(fields, refs, "strict");
      const codes = (seen.diagnostics ?? []).map((each) => each.code);
      ctx.log.note("a layout pointing at nothing", { what, codes, layoutKept: (seen.layout ?? []).length });

      expectClaim(codes.includes("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE"), {
        claimIds: ["DYN-003"],
        what: `${what}: the layout was left pointing at it with nothing said`,
        detail: JSON.stringify(codes),
      });

      expectEqual((seen.layout ?? []).length, 0, {
        claimIds: ["DYN-001"],
        what: `${what}: the layout survived the reference it names being gone`,
      });
    }
  },
);
