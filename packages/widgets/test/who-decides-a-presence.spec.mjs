/**
 * Every presence condition says who decides it, and every named resolver exists.
 *
 * A condition with no way to decide it is a declaration each renderer interprets for itself, which is
 * how one of these came to mean one thing where chips are drawn and another where they are not. The
 * table is what makes the gap countable — and, as much to the point, what makes the three that will
 * never have a resolver *declared* rather than absent, so nobody reports them as findings.
 *
 * Derived from the conditions rather than listed, so a condition added to the contract has to be
 * accounted for here before it can be declared on a part. ADR 0169.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as widgets from "../dist/index.js";
import { MDY_PART_PRESENCES, MDY_PRESENCE_RESOLUTION, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "../dist/index.js";

test("every condition the contract declares is accounted for", () => {
  const declared = [...MDY_PART_PRESENCES].sort();
  const accounted = Object.keys(MDY_PRESENCE_RESOLUTION).sort();
  assert.deepEqual(accounted, declared,
    "a condition can be declared on a part and say nothing about who decides it, which is the state "
    + "this table exists to end");
});

test("a named resolver is a name the package publishes", () => {
  const named = Object.entries(MDY_PRESENCE_RESOLUTION)
    .filter(([, entry]) => entry.resolver !== null);
  assert.ok(named.length >= 3, `only ${named.length} conditions claim a resolver — this asserts nothing`);
  for (const [condition, entry] of named) {
    assert.equal(typeof widgets[entry.resolver], "function",
      `${condition} names ${entry.resolver} as what decides it, and the package publishes no such `
      + "function. A pointer to nothing is worse than no pointer: it stops the search");
  }
});

test("a condition with no resolver says why, and `owed` is not a reason but a debt", () => {
  for (const [condition, entry] of Object.entries(MDY_PRESENCE_RESOLUTION)) {
    if (entry.resolver !== null) {
      assert.equal(entry.because, "answered", `${condition} names a resolver and does not say it is answered`);
      continue;
    }
    assert.ok(entry.because.length > 0, `${condition} has no resolver and no reason`);
    // The distinction the table exists to carry: `owed` is work, anything else is a decision. A blank
    // reads as the first and may be the second, and three of these are decisions.
    assert.ok(entry.because === "owed" || entry.because.length > 40,
      `${condition} gives neither a debt nor an argument. A condition that will never have a resolver `
      + "has to say why, or the next person counting them reports a decision as a gap");
  }
});

test("the conditions carrying the most declarations are the ones that are answered", () => {
  // The finding that produced the table, kept as a property rather than a sentence: a condition a
  // consumer can ask about is the one consumers read. If this ever inverts — most declarations
  // hanging off conditions nothing decides — the contract has grown in the direction that produced
  // the divergences, and somebody should know before it is measured again by accident.
  // Counted per node per kind, which is what a renderer faces: the same part in seventeen kinds is
  // seventeen decisions somebody has to make, and the per-part table collapses them to one.
  const weight = new Map();
  for (const kind of MDY_WIDGET_KINDS) {
    for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
      if (node.presentWhen === undefined) continue;
      weight.set(node.presentWhen, (weight.get(node.presentWhen) ?? 0) + 1);
    }
  }
  const carried = (answered) => [...weight.entries()]
    .filter(([condition]) => (MDY_PRESENCE_RESOLUTION[condition]?.resolver !== null) === answered)
    .reduce((total, [, count]) => total + count, 0);

  assert.ok(carried(true) > 0 && carried(false) > 0,
    "every condition is on the same side, so this comparison says nothing");
  assert.ok(carried(true) >= carried(false) * 0.7,
    `conditions nothing decides now carry ${carried(false)} declarations against ${carried(true)} that `
    + "are answered. The contract is growing in the direction that made two renderers disagree");
});
