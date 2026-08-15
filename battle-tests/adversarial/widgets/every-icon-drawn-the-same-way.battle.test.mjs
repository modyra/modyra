/**
 * Fifteen icons that have to look like each other.
 *
 * `MDY_ICONS` publishes the drawings a form uses — a calendar, a clock, the chevrons, the spinner —
 * and three constants say how they are drawn: `MDY_ICON_GRID` is the square they live in,
 * `MDY_ICON_STROKE` is the weight of every line, and `MDY_ICON_SPANS` names how much of the square
 * each family fills.
 *
 * An icon that breaks any of the three does not fail: it looks slightly wrong next to the others, in
 * a way a reviewer sees and cannot name. A chevron drawn at stroke 1.5 beside a calendar drawn at 2
 * is the kind of thing that ships and stays.
 *
 * So the three are held over every icon rather than spot-checked: same square, same weight, and a
 * span that is one the contract names. Nothing here asserts what a drawing should *contain* — that is
 * a design decision with a screenshot baseline behind it, not a contract.
 *
 * The extent of each drawing is deliberately not asserted. Path data mixes absolute coordinates with
 * relative offsets, so a `-6` in a lowercase command is a step and not a place, and a check that
 * cannot tell them apart reports five icons drawn outside their own square when none of them is. It
 * was written, it said exactly that, and it is not here.
 */

import { MDY_ICONS, MDY_ICON_GRID, MDY_ICON_SPANS, MDY_ICON_STROKE } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["UI-003", "STY-001"],
    title: "every icon is drawn in the same square, at the same weight",
    environments: ["node"],
  },
  async (ctx) => {
    const names = Object.keys(MDY_ICONS);
    ctx.log.note("what the contract says about drawing them", {
      icons: names.length,
      grid: MDY_ICON_GRID,
      stroke: MDY_ICON_STROKE,
      spans: MDY_ICON_SPANS,
    });

    // The premise: there are icons, and the numbers describing them are numbers.
    expectClaim(names.length > 0 && Number.isFinite(MDY_ICON_GRID) && Number.isFinite(MDY_ICON_STROKE), {
      claimIds: ["UI-003"],
      what: "the icon contract is empty or its measurements are not numbers",
      detail: JSON.stringify({ icons: names.length, grid: MDY_ICON_GRID, stroke: MDY_ICON_STROKE }),
    });

    const expectedViewBox = `0 0 ${MDY_ICON_GRID} ${MDY_ICON_GRID}`;
    const declaredSpans = Object.keys(MDY_ICON_SPANS);

    const wrongSquare = [];
    const wrongWeight = [];
    const unknownSpan = [];

    for (const [name, icon] of Object.entries(MDY_ICONS)) {
      if (icon.viewBox !== expectedViewBox) wrongSquare.push(`${name}: ${icon.viewBox}`);
      if (!declaredSpans.includes(icon.span)) unknownSpan.push(`${name}: ${String(icon.span)}`);

      const weights = [...new Set([...String(icon.content).matchAll(/stroke-width="([\d.]+)"/g)].map((each) => Number(each[1])))];
      if (weights.some((each) => each !== MDY_ICON_STROKE)) wrongWeight.push(`${name}: ${JSON.stringify(weights)}`);
    }

    ctx.log.note("what every icon says about itself", {
      squares: [...new Set(Object.values(MDY_ICONS).map((each) => each.viewBox))],
      spans: [...new Set(Object.values(MDY_ICONS).map((each) => each.span))],
    });

    expectEqual({ wrongSquare, wrongWeight, unknownSpan }, { wrongSquare: [], wrongWeight: [], unknownSpan: [] }, {
      claimIds: ["UI-003", "STY-001"],
      what: "an icon is drawn in a different square, at a different weight, or claims a span the contract does not name",
    });

    // The control: the drawings carry strokes at all. An icon set that had stopped declaring them
    // would pass the weight check by having nothing to weigh.
    const withStrokes = Object.values(MDY_ICONS).filter((each) => /stroke-width="/.test(String(each.content))).length;
    expectClaim(withStrokes === names.length, {
      claimIds: ["UI-003"],
      what: "an icon carries no stroke weight at all, so the check above passed it by having nothing to check",
      detail: JSON.stringify({ withStrokes, icons: names.length }),
    });
  },
);
