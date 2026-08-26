/**
 * Three controls in a row, one of which destroys everything the field holds.
 *
 * At a filled multiselect's trailing edge sit a way back, a clear-all and the opener. Two are
 * recoverable and one is not: clear-all discards every value at once. They are drawn the same size,
 * in the same colour, a few pixels apart, and the only thing separating *restore one* from *destroy
 * all* is which of two adjacent boxes a thumb lands in.
 *
 * **The adjacency cannot be arranged away.** The opener is pinned last — it is the only one of the
 * three that is always present and never destructive, and it is the field's primary affordance, so it
 * anchors the trailing edge. With the last position fixed, the way back borders clear-all in both
 * remaining arrangements. The hazard is structural, so the mitigation has to be structural too.
 *
 * The decision this asserts, taken by the accessibility specification rather than here:
 *
 *     [ (Alfa 3 ✕) (Beta 2 ✕)   trigger …        ]  ↶  ┊  ✕   ⌄
 *                                                       └ a rendered gap, not 24px of nothing
 *
 * **A clear zone satisfies the target-size criterion and is invisible.** 24 pixels of margin is
 * measurable and it is not *perceivable*: a pointer user gets no cue that they have crossed from one
 * kind of control to the other. So the separation between the way back and clear-all must be visibly
 * wider than the separation between clear-all and the opener — a landmark rather than a margin. That
 * is what the last assertion measures, and it is the one that does not follow from any accessibility
 * checker: a page can pass every automated target-size rule and still put a destroy beside a restore
 * with nothing between them.
 *
 * **What is not asserted here, and why.** The mark's contrast against its background is part of the
 * same decision and this file does not check it. The harness measures contrast by sampling painted
 * pixels, which is sound for a filled region and unvalidated for a thin stroke — and an icon drawn as
 * a stroked path is exactly the case it has never been checked against. Reporting a ratio from it
 * would be inventing a measurement. It needs an instrument this suite does not have.
 *
 * Measured, identically in all three renderers:
 *
 *     way back    31×17    x=93..124      on its own row, a thousand pixels from the others
 *     opener     818×56    x=342..1160    the space the chips do not take
 *     clear all   28×56    x=1160..1188   flush against the opener — 0px between them
 *     (glyph)     16×16    x=1144..1160   decoration inside the opener, not a target
 *
 * So the three are not a cluster: the way back is on a separate row beneath the field, and the gap
 * between the opener and the control that discards every value in the field is **zero**. The order is
 * way back, open, clear all — the destructive one at the outer edge, where a thumb reaching for the
 * end of the field arrives first, and a press two pixels to either side of x=1160 either opens the
 * list or throws every value away.
 *
 * **The opener is the wide area, and that is what the drawing above does not settle.** The mark at the
 * trailing edge is a glyph inside the command; the command is the whole space the chips leave, which
 * sits *before* clear-all and is 818 pixels wide. A sequence that ends with the opener therefore costs
 * something whichever way it is reached: either the wide area moves to the outer edge and clear-all
 * ends up inside the field rather than at its border, or the wide area stops being wide and the empty
 * space beside the chips stops opening anything. The specification drew three marks without saying
 * which of the three is the wide one, so this file asserts the sequence it drew and the record owes an
 * amendment naming the cost it chose.
 *
 * **A correction, recorded because the retracted half is instructive.** An earlier reading of this
 * file reported the opener as 16×16 — two thirds of the minimum target — and that was the glyph. The
 * part whose *name* reads like an opener is decoration; the part the catalogue *declares* as the
 * opener is the one a person presses. Reading the name instead of the declaration reports a picture's
 * size as a target's, and it reports it in the direction that manufactures a defect.
 *
 * **The assertions are ordered, and the order is load-bearing.** Siblinghood, then sequence, then
 * size, then the two gaps. A gap measured across an arrangement that is not a cluster is a distance
 * between unrelated boxes: with the way back on its own row, `clear.x - back.right` is over a
 * thousand pixels and clears every threshold this file states. Removing the earlier assertions to
 * "see the real ones run" would produce exactly that false pass.
 *
 * **This contradicts a standing decision record and does so deliberately.** The way back ships on its
 * own row beneath the field, which is what ADR 0144 accepted. The accessibility specification has
 * since replaced that with an inline button in the trailing cluster, on the ground that a row
 * appearing below the field reflows everything under it. This file holds the newer decision, so it is
 * red until the record is superseded and the renderers follow. A reader meeting the contradiction
 * should read the record as the older of the two, not this file as wrong.
 *
 * Read along the inline axis in a left-to-right document. A mirrored document reverses the visual
 * order and not the DOM order; that is a second reading this file does not take.
 *
 * Claims under attack: A11Y-004, UI-007.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/**
 * The part that opens the popup, as the catalogue declares it.
 *
 * Not the part whose name reads like an opener. The glyph at the trailing edge is decoration inside
 * the command — it is hidden from assistive technology and takes no pointer events — so measuring it
 * reports the size of a picture where the question is about the size of a target. The catalogue names
 * the responsible element for exactly this reason, and reading the declaration is the only way to
 * measure the thing a person presses.
 */
const OPENER_PART = MDY_POPUP_OPENERS.multiselect?.opener ?? "";

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  const declared = parts[part]?.classes ?? [];
  return declared[0] ?? "";
};

/** The smallest a control may be, and the smallest gap that counts as a clear zone. */
const TARGET = 24;

for (const host of HOSTS) {
  test(`a destroy and a restore are told apart by more than a margin, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("cluster", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
        options: [
          { value: "a", label: "Alfa" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" },
        ],
        initialValue: ["a", "b", "c"],
      }] as never);
    }, { api: host.api });

    const form = '[data-form="cluster"]';
    await page.locator(form).waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);

    // The way back is offered after something has been removed, so removing is the precondition for
    // the cluster this file is about existing at all.
    await page.locator(`${form} .mdy-chip__remove`).first().click({ force: true, timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(400);

    const wayBack = classOf("wayBackAction");
    const clearAll = classOf("clearAll");
    const opener = classOf(OPENER_PART);

    // A part with no declared class cannot be found, and a selector built from an empty string
    // matches the whole document. Say so rather than measure the wrong elements.
    expect(
      OPENER_PART,
      "the catalogue names no opener for this kind, so this file has nothing to measure as the "
      + "command and would otherwise fall back to guessing which part opens the popup",
    ).not.toBe("");

    expect(
      [wayBack, clearAll, opener].filter((one) => one === ""),
      "the contract declares no class for one of the three trailing parts, so this file cannot "
      + "locate them and would otherwise measure whatever the empty selector matched",
    ).toEqual([]);

    const reading = await page.evaluate(({ root, names }) => {
      const found: Record<string, { x: number; right: number; w: number; h: number; parent: string } | null> = {};
      for (const [role, className] of Object.entries(names)) {
        const element = document.querySelector(`${root} .${className}`) as HTMLElement | null;
        if (element === null) { found[role] = null; continue; }
        const box = element.getBoundingClientRect();
        const parent = element.parentElement;
        found[role] = {
          x: Math.round(box.left), right: Math.round(box.right),
          w: Math.round(box.width), h: Math.round(box.height),
          parent: parent === null ? "(detached)"
            : Array.from(parent.classList).find((one) => one.startsWith("mdy-")) ?? parent.tagName.toLowerCase(),
        };
      }
      return found;
    }, { root: form, names: { wayBack, clearAll, opener } });

    const missing = Object.entries(reading).filter(([, box]) => box === null).map(([role]) => role);
    expect(
      missing,
      `${host.name} draws no ${missing.join(", ")} after a value was removed. A way back that is not `
      + "on the page is not a way back, and the rest of this file would pass by measuring nothing.",
    ).toEqual([]);

    const back = reading.wayBack!;
    const clear = reading.clearAll!;
    const open = reading.opener!;

    // One cluster, or three controls that merely end up near each other. Siblings are what make the
    // gaps below a property of the design rather than of where three separate boxes happened to land.
    expect(
      [back.parent, clear.parent, open.parent],
      `the three trailing controls hang from ${back.parent}, ${clear.parent} and ${open.parent}. `
      + "They are not siblings, so nothing holds them in one order or keeps the space between them "
      + "under one rule — each moves for reasons the other two know nothing about.",
    ).toEqual([back.parent, back.parent, back.parent]);

    expect(
      [back.x < clear.x, clear.x < open.x],
      `left to right the cluster reads ${[["way back", back.x], ["clear all", clear.x], ["open", open.x]]
        .sort((left, right) => (left[1] as number) - (right[1] as number)).map(([name]) => name).join(", ")}. `
      + "The opener is pinned last: it is the only one always present and never destructive, and it is "
      + "where the eye looks for a field's primary affordance.",
    ).toEqual([true, true]);

    const small = [["way back", back], ["clear all", clear], ["open", open]] as const;
    expect(
      small.filter(([, box]) => box.w < TARGET || box.h < TARGET).map(([name, box]) => `${name} ${box.w}×${box.h}`),
      `a control smaller than ${TARGET}×${TARGET} cannot be hit reliably, and these sit beside one that `
      + "discards every value in the field.",
    ).toEqual([]);

    const betweenDestructive = clear.x - back.right;
    const betweenSafe = open.x - clear.right;

    expect(
      betweenDestructive,
      `${betweenDestructive}px separates the way back from clear-all, which is less than the ${TARGET}px `
      + "a clear zone needs. A thumb aimed at restoring one value lands on discarding all of them.",
    ).toBeGreaterThanOrEqual(TARGET);

    // The perceivable half, and the half no target-size rule asks for.
    expect(
      betweenDestructive,
      `the gap before clear-all is ${betweenDestructive}px and the gap after it is ${betweenSafe}px. `
      + "Evenly spaced, the three read as one group of three buttons and nothing tells a person that "
      + "the boundary between restoring one value and destroying all of them falls between the first "
      + "two. A clear zone is measurable; it is not visible. This asks for a landmark.",
    ).toBeGreaterThan(betweenSafe);
  });
}
