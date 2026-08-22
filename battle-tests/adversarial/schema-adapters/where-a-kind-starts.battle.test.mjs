/**
 * Where a field starts, asked of the contract that already answers it.
 *
 * ADR 0086 says a derived field starts at the empty its own schema accepts, and `null` where there
 * is no such empty. Said that way it is a rule about schemas, and it can only be checked against
 * whichever schema library is installed — a handful of Zod leaves standing in for a vocabulary of
 * seventeen kinds.
 *
 * There is a stronger reading available, because the framework already publishes the answer.
 * `MDY_VALUE_CONTRACTS` declares, per kind, the `shape` a value has and whether the kind is
 * `nullable` — whether absence is one of the values it can hold at all. A seed is exactly the
 * question that contract answers: a kind that admits absence starts absent, and a kind that does not
 * starts at the empty of its shape.
 *
 * So the property is not about Zod and does not need it:
 *
 *   seed === null   if and only if   MDY_VALUE_CONTRACTS[kind].nullable
 *   seed's shape    is               MDY_VALUE_CONTRACTS[kind].shape
 *
 * Both halves matter. Without the first, a kind could quietly start absent where the contract says
 * absence is not one of its values, and a control bound to it would be handed a `null` its own
 * contract promised it would never see. Without the second, `nullable: false` would be satisfied by
 * any non-null value at all — `0` for a text field, `""` for a checkbox — and a form would open
 * showing an answer nobody gave.
 *
 * Nothing forces the two published facts to agree today: the value contracts are a table, and the
 * seeds are chosen where a schema is built. A kind added to one and not the other is exactly the
 * silence this battle exists to break.
 */

import {
  MDY_FIELD_KINDS,
  MDY_VALUE_CONTRACTS,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The kinds whose document needs a list to choose from before it means anything. */
const NEEDS_OPTIONS = new Set(["select", "radio", "multiselect", "segmented"]);

/** What a one-field document of this kind starts at, through the contract's own front door. */
function seedOf(kind) {
  const doc = {
    version: 2,
    fields: [
      {
        name: "x",
        kind,
        label: "X",
        ...(NEEDS_OPTIONS.has(kind) ? { options: [{ value: "a", label: "A" }] } : {}),
      },
    ],
  };
  const parsed = parseDynamicForm(doc, "lenient");
  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    return form.getValue().x;
  } finally {
    form.destroy();
  }
}

/**
 * Whether `seed` is the empty of `shape` — the value that means *nothing has been answered* while
 * still being of the kind's own type.
 *
 * Written as a closed table rather than a predicate over the value, so a shape nobody described
 * here is reported rather than passed.
 */
function isEmptyOfShape(seed, shape) {
  switch (shape) {
    case "string":
      return seed === "";
    case "number":
      return seed === 0;
    case "boolean":
      return seed === false;
    case "option":
      return seed === null;
    case "option[]":
    case "file[]":
      return Array.isArray(seed) && seed.length === 0;
    case "dateRange":
      return (
        typeof seed === "object" &&
        seed !== null &&
        seed.start === null &&
        seed.end === null
      );
    default:
      return null; // a shape this battle does not describe
  }
}

battle(
  {
    claims: ["SCH-001", "DYN-001"],
    title: "a kind starts where its value contract says it can",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = MDY_FIELD_KINDS.map((kind) => {
      const contract = MDY_VALUE_CONTRACTS[kind];
      const seed = seedOf(kind);
      return { kind, nullable: contract?.nullable, shape: contract?.shape, seed };
    });
    ctx.log.note("where each kind starts, against what its contract says it may hold", observed);

    // The instrument answers first, three ways: every kind has a contract, the vocabulary is the
    // whole of it, and it contains kinds on both sides of the question — otherwise "they all agree"
    // would be a statement about an empty set or a one-sided one.
    expectClaim(
      observed.length >= 17 &&
        observed.every((row) => row.shape !== undefined) &&
        observed.some((row) => row.nullable === true) &&
        observed.some((row) => row.nullable === false),
      {
        claimIds: ["SCH-001"],
        what: "the vocabulary under test is incomplete or one-sided, so agreement across it means nothing",
        detail: JSON.stringify(observed.map(({ kind, nullable }) => ({ kind, nullable }))),
      },
    );

    // Absence is a value only where the contract says it is.
    const absentWithoutLeave = observed.flatMap((row) =>
      (row.seed === null) === (row.nullable === true)
        ? []
        : [{ kind: row.kind, nullable: row.nullable, seed: row.seed }],
    );

    expectEqual(absentWithoutLeave, [], {
      claimIds: ["SCH-001", "DYN-001"],
      what: "a kind starts absent where its contract says absence is not one of its values, or starts present where it says it is",
    });

    // And where it is not absent, it starts at the empty of its own shape rather than at any value
    // that merely is not null.
    const notTheEmpty = observed.flatMap((row) => {
      if (row.nullable === true) return [];
      const verdict = isEmptyOfShape(row.seed, row.shape);
      if (verdict === null) return [{ kind: row.kind, shape: row.shape, seed: row.seed, why: "shape not described here" }];
      return verdict ? [] : [{ kind: row.kind, shape: row.shape, seed: row.seed, why: "not the empty of its shape" }];
    });

    expectEqual(notTheEmpty, [], {
      claimIds: ["SCH-001", "DYN-001"],
      what: "a kind that cannot be absent starts at something other than the empty of its own shape, so a form opens showing an answer nobody gave",
    });
  },
);
