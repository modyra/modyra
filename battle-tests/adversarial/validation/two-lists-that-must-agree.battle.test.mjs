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

import { MDY_FIELD_KINDS, MDY_VALUE_CONTRACTS, NO_CONSTRAINTS, factsOf, minLength, withFacts } from "@modyra/core";

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
