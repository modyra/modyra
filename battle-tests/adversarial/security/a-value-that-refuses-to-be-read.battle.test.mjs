/**
 * The panel, asked about a value that answers a read by refusing.
 *
 * `serialize.ts` exists for one reason and says so: a value JSON cannot carry is **described**
 * rather than raised, *"so that reading a form's value is never the thing that fails"*. A `File`
 * stringifies to `{}`, so it is described. A `BigInt` makes `JSON.stringify` raise outright, so it
 * is described — and the note names who that protects: *"including the devtools panel, which is what
 * a developer opens precisely when something is already wrong"*. A cycle is described rather than
 * walked.
 *
 * A property is not always a stored value. It can be an accessor, and an accessor can refuse:
 * reactive state read outside its tracking scope, a Proxy, a lazily-hydrated model that throws until
 * it loads, a `toJSON` that fails on a half-built object. Each reaches a form the ordinary way,
 * because a field is allowed to hold an object and the engine accepts a shape it does not expect
 * rather than refusing the write.
 *
 * The engine keeps its side: `getValue()`, `submitValue()` and `getChanges()` hand the object back
 * untouched — they never read into it, so they cannot fail on it. The panel is the one surface that
 * walks the value, and it is the one that raises. Which makes this narrow and not small: the failure
 * lands exactly on the tool whose whole purpose is to be readable when the form is already wrong.
 *
 * Two of the five shapes below are described today. Three raise. That is what makes it a defect
 * rather than a limit — the serializer knows how to say *"I could not read this"*, and says it for
 * some values and not others.
 */

import { createForm, field } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Values a form may legitimately hold that JSON cannot carry, each in its own way. */
const SHAPES = Object.freeze([
  { name: "a BigInt", make: () => 10n, describedToday: true },
  {
    name: "a value that refers to itself",
    make: () => {
      const cycle = { name: "c" };
      cycle.self = cycle;
      return cycle;
    },
    describedToday: true,
  },
  {
    name: "an accessor that refuses to be read",
    make: () => ({
      get detail() {
        throw new Error("this value refuses to be read here");
      },
    }),
    describedToday: false,
  },
  {
    name: "a toJSON that fails",
    make: () => ({
      toJSON() {
        throw new Error("this value refuses to be read here");
      },
    }),
    describedToday: false,
  },
  {
    name: "a proxy that refuses to be enumerated",
    make: () =>
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("this value refuses to be enumerated");
          },
        },
      ),
    describedToday: false,
  },
]);

/** What the panel does when the form holds `value`. */
function panelOn(value) {
  const form = createForm({ payload: field(null), other: field("x") }, { devWarnings: false });
  try {
    form.f.payload.value.set(value);
    try {
      mdyFormSnapshot(form);
      return { described: true };
    } catch (error) {
      return { described: false, threw: error instanceof Error ? error.message : String(error) };
    }
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["DEV-001"],
    title: "the panel describes a value it cannot read rather than raising on it",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = SHAPES.map((shape) => ({ shape: shape.name, ...panelOn(shape.make()) }));
    ctx.log.note("what the panel does with each value a form may hold", observed);

    // The instrument answers first, twice over. An ordinary value must be described — otherwise
    // "some raise" would be a statement about a panel that never worked — and at least one of the
    // hard shapes must already be described, or this would be a limit of the serializer rather
    // than an inconsistency in it.
    const ordinary = panelOn("just text");
    expectClaim(ordinary.described === true, {
      claimIds: ["DEV-001"],
      what: "the panel could not describe an ordinary value, so the probe is wrong before the product is",
      detail: JSON.stringify(ordinary),
    });

    expectClaim(
      SHAPES.filter((shape) => shape.describedToday).every(
        (shape) => observed.find((row) => row.shape === shape.name)?.described === true,
      ),
      {
        claimIds: ["DEV-001"],
        what: "no value JSON refuses is described today, so the serializer has no ability here to be inconsistent about",
        detail: JSON.stringify(observed),
      },
    );

    expectEqual(
      observed.filter((row) => row.described !== true).map((row) => row.shape),
      [],
      {
        claimIds: ["DEV-001"],
        what: "the panel raised on a value the form holds, so the tool a developer opens when something is wrong is the one that fails",
      },
    );
  },
);
