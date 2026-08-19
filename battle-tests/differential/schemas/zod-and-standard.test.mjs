/**
 * Three ways to declare one form: by hand, from a Zod schema, and through Standard Schema.
 *
 * `z.record()` becoming a keyed collection is the entry point to every `COL-*` claim for a Zod
 * consumer, and no battle had ever gone through it. The schema adapters were attacked by their own
 * unit tests and by nothing that compares them against the hand-written form they are supposed to
 * produce.
 *
 * The three paths differ in where the shape comes from and must not differ in what the form then
 * does. `buildZodTree` derives the tree from the schema; `buildStandardTree` takes a tree and
 * patches the vendor's defaults into it, so it is given the hand-written one — which is also why
 * comparing all three is worth more than comparing two: the middle path proves the derivation, and
 * the third proves the defaults do not move anything else.
 *
 * Zod drives the Standard Schema path because it implements Standard Schema v1 and is the vendor
 * this repository installs. Valibot and ArkType are named in the package's own description and are
 * not resolvable here, so this says nothing about them.
 */

import { z } from "zod";

import { array, createForm, field, group, record } from "@modyra/core";
import { buildStandardTree } from "@modyra/standard-schema";
import { buildZodTree } from "@modyra/zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual, expectSameObservation } from "../../harness/assertions.mjs";
import { canonicalObservation } from "../../harness/canonical-snapshot.mjs";

const SCHEMA = z.object({
  rows: z.record(
    z.string(),
    z.object({ code: z.string().min(1), note: z.string().default("unset") }),
  ),
});

/**
 * The same shape a maintainer would write if there were no schema library involved.
 *
 * A text cell starts at `""` because that is what a maintainer writing a text field writes, and
 * because ADR 0086 has the derivation arrive at the same place: a derived field starts at the empty
 * its own kind accepts. The two agreeing here is the decision holding, not the twin being bent to
 * match — `how-a-rule-was-written.battle.test.mjs` is where that agreement is attacked directly,
 * against the kind rather than against this file.
 */
const byHand = () => ({ rows: record(group({ code: field(""), note: field("unset") })) });

/**
 * Keys chosen for what they mean to JavaScript rather than to a domain.
 *
 * `"0"` and `"4294967295"` are the boundaries where an object stops being an object if anything on
 * the path treats a key as an index — `COL-004` — and a schema adapter is one more place that could.
 */
const SEQUENCE = Object.freeze([
  ["upsert", "a", { code: "A" }],
  ["upsert", "0", undefined],
  ["upsert", "4294967295", undefined],
  ["upsert", "01", { code: "leading zero" }],
  ["rename", "a", "z"],
]);

function drive(tree) {
  const form = createForm(tree, { devWarnings: false });
  for (const [operation, key, argument] of SEQUENCE) {
    if (operation === "upsert") form.f.rows.upsert(key, argument);
    else form.f.rows.rename(key, argument);
  }
  const state = canonicalObservation({ form, collections: { rows: form.f.rows } });
  form.destroy();
  return state;
}

battle(
  {
    claims: ["DYN-002", "COL-001", "COL-004", "COL-008", "SUB-002"],
    title: "a form derived from a schema is the form it was meant to derive",
    environments: ["node"],
  },
  async (ctx) => {
    const written = drive(byHand());
    ctx.log.note("the same collection declared three ways", { keys: written.collections[0].keys });

    // The control: the sequence has to have produced a collection with the awkward keys in it, or
    // the three paths agree about a form that was never built.
    expectClaim(written.collections[0].keys.length === 4, {
      claimIds: ["COL-001"],
      what: "the sequence declared every row it was given",
      detail: JSON.stringify(written.collections[0].keys),
    });

    // `z.record()` has to have produced a collection at all. A schema adapter that emitted a plain
    // group would agree about the value and answer none of the collection's own questions.
    const derived = buildZodTree(SCHEMA);
    const fromZod = createForm(derived, { devWarnings: false });
    expectClaim(typeof fromZod.f.rows?.upsert === "function" && typeof fromZod.f.rows?.keys === "function", {
      claimIds: ["DYN-002"],
      what: "z.record() produced a keyed collection rather than a group",
      detail: Object.keys(fromZod.f.rows ?? {}).join(", "),
    });
    fromZod.destroy();

    // The two forms differ in one way on purpose: a derived tree carries the schema's rules and a
    // hand-written one carries none, so the derived form is invalid where a cell holds an empty its
    // rules refuse and the other is not. That is the adapter working. Everything else — which rows exist, in which order,
    // what they hold, what a submit would carry, which cells are marked — may not differ at all,
    // and the two verdict fields are excluded here and asserted below rather than dropped.
    const VERDICT = Object.freeze(["valid", "errors", "collections"]);

    const fromDerived = drive(derived);
    expectSameObservation(fromDerived, written, {
      claimIds: ["DYN-002", "COL-001", "COL-004", "COL-008", "SUB-002"],
      ignore: [...VERDICT],
      what: "the form derived from a Zod schema diverged from the hand-written one",
    });

    // The collections are compared without their verdict, because a keyed collection reports its
    // own errors and only the derived form has any.
    expectSameObservation(
      fromDerived.collections.map(({ path, kind, keys }) => ({ path, kind, keys })),
      written.collections.map(({ path, kind, keys }) => ({ path, kind, keys })),
      {
        claimIds: ["COL-001", "COL-004", "DYN-002"],
        ignore: [],
        what: "the derived collection holds different rows from the hand-written one",
      },
    );

    // And the excluded half, stated: the hand-written form has no rules and is valid; the derived
    // one is invalid for the reason the schema gives, naming the cell whose empty its rules refuse.
    // `min(1)` is what makes that visible — a bare `z.string()` accepts the empty its own kind
    // starts at, so the derived form would be valid and the two would agree by having nothing to
    // disagree about.
    expectClaim(written.valid && written.errors.length === 0, {
      claimIds: ["DYN-002"],
      what: "the hand-written form carries no rules of its own",
      detail: JSON.stringify(written.errors),
    });

    expectClaim(!fromDerived.valid && fromDerived.errors.length > 0, {
      claimIds: ["DYN-002"],
      what: "a form derived from a schema carries the schema's rules",
      detail: JSON.stringify(fromDerived.errors.slice(0, 2)),
    });

    // Standard Schema patches defaults into a tree rather than deriving one, so it inherits the
    // hand-written form's absence of rules — and must change nothing else.
    expectSameObservation(drive(buildStandardTree(SCHEMA, byHand())), written, {
      claimIds: ["DYN-002", "COL-004", "COL-008"],
      ignore: [],
      what: "patching a vendor's defaults through Standard Schema changed the form",
    });
  },
);

/**
 * A collection whose rows hold a collection, declared from a schema.
 *
 * The flat case above proves the derivation makes a collection at all. It cannot prove the
 * derivation makes one *inside a row* — a schema adapter that mapped the row's element to a group or
 * a leaf produces a form whose value looks structurally right and whose inner list is one opaque
 * field with no rows to address. That shape is invisible to a value comparison alone, so what is
 * asserted here is that the inner handle is a list a consumer can drive.
 */
const NESTED_SCHEMA = z.object({
  rows: z.record(
    z.string(),
    z.object({
      code: z.string(),
      lines: z.array(z.object({ sku: z.string() })),
    }),
  ),
});

const nestedByHand = () => ({
  rows: record(group({ code: field(""), lines: array(group({ sku: field("") })) })),
});

function driveNested(tree) {
  const form = createForm(tree, { devWarnings: false });
  form.f.rows.upsert("a", { code: "A", lines: [{ sku: "S1" }] });
  form.f.rows.row("a").lines.push({ sku: "S2" });
  form.f.rows.row("a").lines.move(0, 1);
  form.f.rows.upsert("b", { code: "B", lines: [] });
  form.f.rows.rename("a", "z");
  const state = canonicalObservation({ form, collections: { rows: form.f.rows } });
  const handle = form.f.rows.row("z")?.lines ?? null;
  const drivable = typeof handle?.push === "function" && typeof handle?.length === "function";
  form.destroy();
  return { state, drivable };
}

battle(
  {
    claims: ["DYN-002", "COL-001", "COL-007", "SUB-002"],
    title: "a collection inside a row survives being derived from a schema",
    environments: ["node"],
  },
  async (ctx) => {
    const written = driveNested(nestedByHand());
    const derived = driveNested(buildZodTree(NESTED_SCHEMA));
    ctx.log.note("a record of rows holding a list, declared two ways", {});

    // The control, on both sides: the inner list has to be a list. A row whose `lines` came back as
    // one opaque value agrees about the form's value and cannot be pushed to, moved in, or counted.
    expectClaim(written.drivable, {
      claimIds: ["DYN-002"],
      what: "the hand-written inner collection is not a list a consumer can drive",
    });

    expectClaim(derived.drivable, {
      claimIds: ["DYN-002"],
      what: "a schema-derived row's collection is not a list a consumer can drive",
    });

    // The verdict fields differ for the reason the flat comparison already states — a derived tree
    // carries the schema's rules — so they are excluded here and asserted there.
    expectSameObservation(derived.state, written.state, {
      claimIds: ["DYN-002", "COL-001", "COL-007", "SUB-002"],
      ignore: ["valid", "errors", "collections"],
      what: "a schema-derived nested collection diverged from the hand-written one",
    });

    expectEqual(
      derived.state.collections.map(({ path, kind, keys }) => ({ path, kind, keys })),
      written.state.collections.map(({ path, kind, keys }) => ({ path, kind, keys })),
      {
        claimIds: ["COL-001", "COL-007"],
        what: "the derived collection holds different rows after the rename",
      },
    );
  },
);
