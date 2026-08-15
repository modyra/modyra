/**
 * What a layout does at a size the document said nothing about.
 *
 * A `columns` node carries `at`, a per-breakpoint column count, and `layoutNodeAttributes` turns it
 * into the custom properties the stylesheets read — `MDY_LAYOUT_COLUMN_COUNT_PROPERTIES` names them,
 * one per breakpoint. A document rarely fills all four, so most of what a layout does is what it does
 * at a size nobody wrote down.
 *
 * Nothing tested it. Five published tables govern layout — the classes, the breakpoints, and three
 * families of custom property — and no battle cited any of them.
 *
 * The rule, measured rather than assumed and written here so a change to it is a change somebody has
 * to make on purpose:
 *
 * - `base` is `at.base` when the document gives one, and **1** otherwise. The smallest screen stacks.
 * - `sm` is `at.sm` when given, and otherwise **the number of columns the node actually has**. Once
 *   there is room, the layout spreads to its natural width.
 * - `md` and `lg` appear only when the document names them.
 *
 * The second of those is the one worth pinning: a node of four columns declaring only `{ base: 2 }`
 * resolves to two columns on a phone and four above it, and neither number is in the document. A
 * first reading of this took `sm` for a cascade of `base` — two probes disagreed, and what differed
 * between them was the number of columns, not the `at`.
 */

import {
  layoutNodeAttributes,
  layoutSlotStyle,
  MDY_LAYOUT_CLASSES,
  MDY_LAYOUT_COLUMN_COUNT_PROPERTIES,
  MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES,
  MDY_LAYOUT_COLUMN_START_PROPERTIES,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A columns node of `count` columns, declaring `at`. */
const columnsNode = (at, count) => ({
  kind: "columns",
  id: "c",
  ...(at === undefined ? {} : { at }),
  columns: Array.from({ length: count }, (_, index) => [{ ref: `f${index}` }]),
});

/** What the node resolves to at each breakpoint, read through the published property names. */
function resolved(at, count) {
  const { style } = layoutNodeAttributes(columnsNode(at, count));
  const out = {};
  for (const [breakpoint, property] of Object.entries(MDY_LAYOUT_COLUMN_COUNT_PROPERTIES)) {
    const value = style[property];
    if (value !== undefined) out[breakpoint] = Number(value);
  }
  return out;
}

battle(
  {
    claims: ["DYN-001", "UI-002"],
    title: "a layout resolves a size the document did not give it",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: the properties this battle reads are the ones the package publishes, so a rename
    // upstream moves the battle rather than quietly emptying it.
    expectEqual(Object.keys(MDY_LAYOUT_COLUMN_COUNT_PROPERTIES).sort(), ["base", "lg", "md", "sm"], {
      claimIds: ["UI-002"],
      what: "the published breakpoint properties are not the four this battle knows",
      detail: JSON.stringify(MDY_LAYOUT_COLUMN_COUNT_PROPERTIES),
    });

    // The control: a node that declares every size gets exactly what it declared, so the defaults
    // below are defaults rather than the function ignoring `at`.
    expectEqual(resolved({ base: 4, sm: 4, md: 4, lg: 4 }, 2), { base: 4, sm: 4, md: 4, lg: 4 }, {
      claimIds: ["DYN-001"],
      what: "a layout that named every size did not get the sizes it named",
    });

    for (const count of [1, 2, 3, 4]) {
      // Nothing declared: stacked at the smallest size, its own width above it.
      expectEqual(resolved(undefined, count), { base: 1, sm: count }, {
        claimIds: ["UI-002"],
        what: `a ${count}-column layout declaring nothing did not stack at base and spread at sm`,
      });

      // `base` alone: the declared count below, the node's own width above.
      expectEqual(resolved({ base: 2 }, count), { base: 2, sm: count }, {
        claimIds: ["UI-002"],
        what: `a ${count}-column layout declaring only base did not keep its own width at sm`,
      });

      // A declared size always wins over the default.
      expectEqual(resolved({ sm: 3 }, count), { base: 1, sm: 3 }, {
        claimIds: ["UI-002"],
        what: `a ${count}-column layout declaring sm did not get the sm it declared`,
      });
    }

    // The sizes nobody named stay absent rather than being invented.
    const sparse = resolved({ base: 2, md: 4 }, 3);
    ctx.log.note("a layout that named base and md", { sparse });
    expectEqual(sparse, { base: 2, sm: 3, md: 4 }, {
      claimIds: ["UI-002"],
      what: "a layout naming base and md did not resolve the way the rule says",
    });

    expectClaim(!("lg" in sparse), {
      claimIds: ["UI-002"],
      what: "a size the document never named was given a value anyway",
      detail: JSON.stringify(sparse),
    });

    // And the class the node carries is the one the table publishes.
    expectEqual(layoutNodeAttributes(columnsNode({ base: 2 }, 2)).className, MDY_LAYOUT_CLASSES.columns, {
      claimIds: ["DYN-001"],
      what: "a columns node did not carry the class its own table names",
    });
  },
);

battle(
  {
    claims: ["DYN-001", "UI-002"],
    title: "a slot's placement says only what the document authored",
    environments: ["node"],
  },
  async (ctx) => {
    const start = MDY_LAYOUT_COLUMN_START_PROPERTIES;
    const display = MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES;

    // A slot that says nothing adds nothing, which is what lets a column with no placement be
    // untouched rather than reset to a default somebody has to know about.
    expectEqual(layoutSlotStyle(undefined), {}, {
      claimIds: ["UI-002"],
      what: "a slot with no placement produced properties anyway",
    });

    // Only the authored sizes appear. A cascade belongs to the stylesheet, not to this function.
    expectEqual(layoutSlotStyle({ md: { hidden: true } }), { [display.md]: "none" }, {
      claimIds: ["UI-002"],
      what: "a placement authored at one size produced properties at others",
    });

    // `hidden: false` is a value rather than an absence, because "shown again at lg" cannot be said
    // by leaving something out.
    expectEqual(layoutSlotStyle({ base: { hidden: true }, lg: { hidden: false } }), {
      [display.base]: "none",
      [display.lg]: "flex",
    }, {
      claimIds: ["UI-002"],
      what: "a slot hidden at base and shown again at lg did not say both",
    });

    // A column is an integer track number, and the first track is 1.
    for (const [given, expected] of [[0, "1"], [-3, "1"], [1, "1"], [2.7, "2"], [4, "4"]]) {
      expectEqual(layoutSlotStyle({ base: { column: given } }), { [start.base]: expected }, {
        claimIds: ["UI-002"],
        what: `a column of ${given} did not resolve to track ${expected}`,
      });
    }

    // Every size, each carrying its own track.
    const everySize = layoutSlotStyle({ base: { column: 1 }, sm: { column: 2 }, md: { column: 3 }, lg: { column: 4 } });
    ctx.log.note("a slot placed at every size", { everySize });
    expectEqual(everySize, {
      [start.base]: "1", [start.sm]: "2", [start.md]: "3", [start.lg]: "4",
    }, {
      claimIds: ["UI-002"],
      what: "a slot placed at all four sizes did not carry all four tracks",
    });

    // The upper bound is the parser's, not this function's: the published schema caps a column at 12
    // and refuses more, and this function passes a larger one through. Recorded rather than asserted
    // as a defect, because the document door is where the cap is enforced.
    ctx.log.note("a column past the schema's cap, through the function alone", {
      style: layoutSlotStyle({ base: { column: 99 } }),
    });
    expectClaim(layoutSlotStyle({ base: { column: 99 } })[start.base] === "99", {
      claimIds: ["UI-002"],
      what: "the slot function silently changed a column the schema would have refused, so where the cap lives has moved",
    });
  },
);
