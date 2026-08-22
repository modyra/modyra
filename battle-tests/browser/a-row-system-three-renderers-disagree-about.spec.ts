/**
 * A kind is in the row system, or it is not, and the three renderers say the same thing about it.
 *
 * Every field that draws a text-shaped control sits in one shell — `mdy-input-wrapper` — and that
 * shell is what makes a form read as a column of peers. The rule that every control occupies the
 * same height is stated over that shell, and it is enforced by
 * `a-control-taller-than-the-row-it-sits-in`.
 *
 * **That check reads four kinds of seventeen**, and it is green. Widening it to all seventeen does
 * not simply find taller boxes: it finds that the shell holds a *different set of kinds in each
 * renderer*, so the height rule is being asked of a different population three times and agreeing
 * with itself each time.
 *
 * Measured:
 *
 *     kind        plain      lit         angular
 *     textarea    64         88          88
 *     radio       60         no shell    no shell
 *     segmented   56         no shell    no shell
 *     slider      56         56          no shell
 *     everything else in the shell        56 everywhere
 *
 * Two different questions, and this file asks the first because the second cannot be asked until it
 * is settled: **whether a kind is in the row system at all.** A kind inside the shell in one renderer
 * and outside it in another is not a height disagreement — it is two anatomies wearing one contract,
 * and every check written over the shell silently covers less in one adapter than in another.
 *
 * The heights are asserted too, but only for the kinds all three agree are in. `textarea` is
 * legitimately taller than one line; what it may not be is 64 in one renderer and 88 in two.
 *
 * **This does not say which answer is right.** A radio group has a strong case for being outside a
 * text shell and a strong case for being inside it, and choosing is a contract decision. What it
 * refuses is three renderers choosing differently.
 *
 * Claims under attack: ADP-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

const SHELL = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
  .text.parts.inputWrapper.classes[0];

test("a kind is inside the row system in every renderer, or outside it in every renderer", async ({ page }) => {
  test.setTimeout(300_000);

  /** kind → renderer → the shell's height, or null where the kind draws no shell. */
  const seen = new Map<string, Record<string, number | null>>();

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `row-${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{
            name: "f", kind: k, label: "L",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.waitForTimeout(180);

      const height = await page.evaluate(({ mountId, shell }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        if (root === null) return null;
        const element = root.querySelector(`.${shell}`) as HTMLElement | null;
        return element === null ? null : Math.round(element.getBoundingClientRect().height);
      }, { mountId: id, shell: SHELL });

      if (!seen.has(kind)) seen.set(kind, {});
      seen.get(kind)![host.name] = height;
    }
  }

  // The premise: the shell was found somewhere. A renaming that made every lookup miss would make
  // every kind agree on "no shell" and pass this while measuring nothing.
  const anyShell = [...seen.values()].some((byHost) => Object.values(byHost).some((h) => h !== null));
  expect(anyShell, `no renderer drew a .${SHELL} for any kind, so this battle is comparing nothing`).toBe(true);

  const membershipDiffers = [...seen.entries()]
    .filter(([, byHost]) => new Set(Object.values(byHost).map((h) => h !== null)).size > 1)
    .map(([kind, byHost]) => ({ kind, ...byHost }));

  expect(
    membershipDiffers,
    `${membershipDiffers.length} kind(s) are inside the row system in one renderer and outside it in ` +
      `another:\n${JSON.stringify(membershipDiffers, null, 1)}\n\n` +
      "That is not a height disagreement — it is two anatomies wearing one contract, and every check " +
      `written over .${SHELL} covers fewer kinds in one adapter than in another without saying so.`,
  ).toEqual([]);

  // Only where all three agree the kind is in: a height cannot be compared across an anatomy that
  // differs, and reporting it as one would name the wrong defect.
  const heightDiffers = [...seen.entries()]
    .filter(([, byHost]) => Object.values(byHost).every((h) => h !== null))
    .filter(([, byHost]) => new Set(Object.values(byHost)).size > 1)
    .map(([kind, byHost]) => ({ kind, ...byHost }));

  expect(
    heightDiffers,
    `${heightDiffers.length} kind(s) draw the same shell at different heights:\n` +
      `${JSON.stringify(heightDiffers, null, 1)}\n\n` +
      "A form is a column of peers or it is not, and a kind that is one height here and another " +
      "there breaks the rhythm of every form it appears in.",
  ).toEqual([]);
});
