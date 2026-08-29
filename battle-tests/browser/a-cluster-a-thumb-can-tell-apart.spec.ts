/**
 * Two commands in a row, one of which destroys everything the field holds.
 *
 * At a filled multiselect's trailing edge sit a way back and a clear-all. One is recoverable and one
 * is not: clear-all discards every value at once. They are drawn the same size, in the same colour, a
 * few pixels apart, and the only thing separating *restore one* from *destroy all* is which of two
 * adjacent boxes a thumb lands in.
 *
 * **Two, not three.** A mark is drawn beside them that opens the list, and it is not a third member:
 * it is hidden from assistive technology and takes no pointer events, because the command that opens
 * is the field itself. Only commands have an order and only commands have a minimum size — asking a
 * drawing for either measures the wrong object, and an earlier version of this file did exactly that
 * and reported a defect that did not exist. The catalogue declares which part is the opener; that
 * declaration is read here rather than guessed from a part's name.
 *
 * The properties, and where each comes from:
 *
 *   1. **the two are siblings** — otherwise nothing holds them in one order or keeps the space between
 *      them under one rule, and each moves for reasons the other knows nothing about;
 *   2. **the way back comes first**, so the destructive one is not what a thumb reaching for the end
 *      of the field arrives at first;
 *   3. **each is at least 24x24**, which is the published target-size minimum;
 *   4. **the gap before the destroy is wider than the gap after it.**
 *
 * **The fourth is not a conformance rule and must not be recorded as one.** No published criterion
 * asks for a wider gap on one side of a control than the other; a page can pass every automated
 * target-size check with a destroy flush against a restore. The reason is narrower and better: the way
 * back is the *remedy* for clear-all — it is what makes discarding everything safe to offer without a
 * confirmation — so the two have to be near enough to find together and far enough not to press by
 * mistake. Evenly spaced, they read as one group of interchangeable buttons and nothing says that the
 * boundary between restoring one value and destroying all of them falls between these two.
 *
 * **What is not asserted here, and why.** The mark's contrast against its background is part of the
 * same decision and this file does not check it. The harness measures contrast by sampling painted
 * pixels, which is sound for a filled region and unvalidated for a thin stroke — and an icon drawn as
 * a stroked path is exactly the case it has never been checked against. Reporting a ratio from it
 * would be inventing a measurement. It needs an instrument this suite does not have.
 *
 * **The assertions are ordered, and the order is load-bearing.** Siblinghood, then sequence, then
 * size, then the two gaps. A gap measured across an arrangement that is not a cluster is a distance
 * between unrelated boxes: while the way back shipped on its own row beneath the field, the space
 * between it and clear-all was over a thousand pixels and cleared every threshold this file states.
 * Removing the earlier assertions to "see the real ones run" would produce exactly that false pass.
 *
 * The separation is carried by the way back's own trailing margin rather than by a gap on the row,
 * so it is a property of the remedy and travels with it wherever the cluster is drawn.
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

/**
 * The smallest a control may be, and the smallest gap that counts as a clear zone.
 *
 * A fallback, not the number: the page declares it as `--mdy-affordance-target-stacked` and the run
 * reads it there, so a design that raises the distance raises what this demands. Written here alone
 * it would be a copy of a decision, green at whatever the page did.
 */
const TARGET = 24;

/** Every length in a token, in pixels — the value is a `max()` of two units, which no single parse reads. */
const largestLength = (token: string): number => {
  const lengths = [...token.matchAll(/([\d.]+)(rem|px)/g)]
    .map(([, size, unit]) => (unit === "rem" ? Number(size) * 16 : Number(size)))
    .filter((one) => Number.isFinite(one));
  return lengths.length > 0 ? Math.round(Math.max(...lengths)) : TARGET;
};

/**
 * The remedy arrives without moving anything else.
 *
 * The offer is not there until something has been taken, and the arrangement it arrives into is one a
 * thumb has already aimed at. If its arrival pushed the other two along, a press begun before it
 * appeared would land on a different control than the one it was aimed at — and the control it would
 * land on is the one that discards everything. That is the reason the decision reserves the slot, and
 * it is a property of the *arrangement* rather than of the remedy, so nothing about the remedy itself
 * can stand in for it.
 *
 * The premise is that the offer really did arrive: a remedy that never appears moves nothing, and
 * would satisfy this by never being drawn at all.
 */
for (const host of HOSTS) {
  test(`the remedy arrives without moving what is already there, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("arrive", [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true,
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "b"],
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="arrive"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(350);

    const edges = () => page.evaluate(({ clear, mark }) => {
      const at = (one: string) => {
        const element = document.querySelector(`[data-form="arrive"] .${one}`);
        return element === null ? null : Math.round(element.getBoundingClientRect().left);
      };
      return { clearAll: at(clear), mark: at(mark) };
    }, { clear: classOf("clearAll"), mark: classOf("arrow") });

    const before = await edges();
    await page.locator(`[data-form="arrive"] .${classOf("chipRemove")}`).first().click({ timeout: 5_000 });
    await page.waitForTimeout(600);
    const after = await edges();

    const offer = await page.locator(`[data-form="arrive"] .${classOf("wayBackAction")}`).first()
      .boundingBox().catch(() => null);
    expect(
      offer !== null && offer.width >= 1,
      `${host.name}: nothing arrived after a value was removed, so this measured an arrangement that `
      + "never changed and would agree with any arrangement at all",
    ).toBe(true);

    const shifted = (["clearAll", "mark"] as const)
      .filter((one) => before[one] !== after[one])
      .map((one) => `${one} ${before[one]} → ${after[one]}`);
    expect(
      shifted,
      `${host.name}: the remedy's arrival moved ${shifted.join(", ")}. A thumb aimed at one of them `
      + "before the offer appeared now lands somewhere else, and the somewhere else is the control "
      + "that discards every value in the field.",
    ).toEqual([]);
  });
}

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
    // Not a member of the cluster: what sits after the destroy, so the two gaps can be compared.
    const neighbour = classOf("arrow");

    // A part with no declared class cannot be found, and a selector built from an empty string
    // matches the whole document. Say so rather than measure the wrong elements.
    expect(
      OPENER_PART,
      "the catalogue names no opener for this kind, so nothing here can tell the command that opens "
      + "the list from the drawing beside it, which is the distinction this file is built on",
    ).not.toBe("");

    expect(
      [wayBack, clearAll, neighbour].filter((one) => one === ""),
      "the contract declares no class for one of the trailing parts, so this file cannot locate it "
      + "and would otherwise measure whatever the empty selector matched",
    ).toEqual([]);

    const reading = await page.evaluate(({ root, names }) => {
      const found: Record<string, {
        x: number; right: number; w: number; h: number; parent: string; label: string | null;
      } | null> = {};
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
          // The name assistive technology announces, which for a remedy has to carry what it restores.
          label: element.getAttribute("aria-label") ?? (element.textContent ?? "").trim() ?? null,
        };
      }
      return found;
    }, { root: form, names: { wayBack, clearAll, neighbour } });

    const missing = Object.entries(reading).filter(([, box]) => box === null).map(([role]) => role);
    expect(
      missing,
      `${host.name} draws no ${missing.join(", ")} after a value was removed. A way back that is not `
      + "on the page is not a way back, and the rest of this file would pass by measuring nothing.",
    ).toEqual([]);

    const back = reading.wayBack!;
    const clear = reading.clearAll!;
    const after = reading.neighbour!;

    // One cluster, or two commands that merely end up near each other. Siblinghood is what makes the
    // gaps below a property of the design rather than of where two separate boxes happened to land.
    expect(
      [back.parent, clear.parent],
      `the two trailing commands hang from ${back.parent} and ${clear.parent}. They are not siblings, `
      + "so nothing holds them in one order or keeps the space between them under one rule — each "
      + "moves for reasons the other knows nothing about.",
    ).toEqual([back.parent, back.parent]);

    expect(
      back.x < clear.x,
      `left to right the two commands read ${back.x < clear.x ? "way back, clear all" : "clear all, way back"}. `
      + "The destructive one must not be what a thumb reaching for the end of the field arrives at "
      + "first, with the remedy for it further in.",
    ).toBe(true);

    const commands = [["way back", back], ["clear all", clear]] as const;
    expect(
      commands.filter(([, box]) => box.w < TARGET || box.h < TARGET).map(([name, box]) => `${name} ${box.w}×${box.h}`),
      `a command smaller than ${TARGET}×${TARGET} cannot be hit reliably, and these sit beside one `
      + "another where one of them discards every value in the field.",
    ).toEqual([]);

    const beforeDestroy = clear.x - back.right;
    const afterDestroy = after.x - clear.right;

    // What the page says a stacked control's clear zone is, rather than what this file guesses.
    const declaredToken = await page.evaluate((selector) => {
      const field = document.querySelector(selector);
      return field === null ? "" : getComputedStyle(field).getPropertyValue("--mdy-affordance-target-stacked").trim();
    }, form);
    // A token the page does not carry would leave the demand below equal to a number written here,
    // and the run would hold whatever the design did.
    expect(declaredToken, "the page declares no clear zone for a stacked control, so this would be "
      + "asserting a number of its own").not.toBe("");
    const declaredTarget = largestLength(declaredToken);

    // **The gap is a target, not a margin.** Neither command carries a target overlay, so the box a
    // finger hits is the box that is drawn and the space between the two boxes is the whole of what
    // separates restoring one value from discarding every one of them. A finger that pressed the way
    // back and presses again a moment later must not land on the destroy.
    expect(
      beforeDestroy,
      `${beforeDestroy}px separates the way back from clear-all, and a stacked control's clear zone `
      + `is declared as ${declaredTarget}px. These two carry no target overlay, so this gap is the `
      + "distance between hit areas — a finger that pressed the remedy and presses again lands on the "
      + "control that discards every value in the field.",
    ).toBeGreaterThanOrEqual(declaredTarget);

    // Not a conformance threshold — no published criterion asks for this, and recording it as one
    // would record something false. The way back is the remedy for clear-all, which is what makes
    // discarding everything safe to offer without a confirmation, so the two have to be near enough
    // to find together and far enough not to press by mistake. Evenly spaced, they read as one group
    // of interchangeable buttons and nothing marks the boundary that falls between them.
    expect(
      beforeDestroy,
      `the gap before clear-all is ${beforeDestroy}px and the gap after it is ${afterDestroy}px. `
      + "Spaced the same on both sides, the destroy reads as one more button in a row of them, and "
      + "nothing tells a person that the boundary between restoring one value and destroying all of "
      + "them falls where it does.",
    ).toBeGreaterThan(afterDestroy);

    // The way back says what it undoes. A remedy named only "undo" leaves a person to remember what
    // they did, which is the thing they are reaching for it because they did not.
    expect(
      back.label,
      "the way back is named without saying what it restores, so a person meets a remedy for an act "
      + "they have to remember unaided",
    ).not.toBe(null);
    expect(
      (back.label ?? "").trim().length,
      "the way back's name is empty, so assistive technology announces a button with nothing to say "
      + "about it beside the control that discards everything",
    ).toBeGreaterThan("undo".length);
  });
}
