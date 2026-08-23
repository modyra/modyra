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
 * **This does not say which answer is right, and it no longer has to.** A radio group has a strong
 * case for being outside a text shell and a strong case for being inside it — and the answer is not a
 * list of kinds anybody maintains. **A kind is in the row system when its height comes from the
 * control scale's default step.** Membership stops being a judgement about a kind and becomes a
 * consequence of where its height is stated, which is checkable and which nobody has to remember.
 *
 * That is why this file is pinned rather than repaired. The three renderers disagree today because
 * each states its own heights; they stop disagreeing when the heights come from one place, and this
 * becomes green as a consequence of the scale migration rather than of anyone editing a list.
 * `an-alphabet-larger-than-its-vocabulary` reporting three distinct control heights is the signal
 * that the question has resolved itself — before that, deciding here would be deciding twice.
 *
 * What it refuses in the meantime is unchanged: three renderers choosing differently.
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

/**
 * The other half of the same question, and the half a person sees.
 *
 * The check above asks about the shell — an anatomy question, answered by class names. This one asks
 * what a form **looks like**: measured across every kind, in one form, at one width.
 *
 *     kind        plain    lit / angular
 *     textarea      104      128
 *     checkbox       68       40
 *     toggle         80       52
 *     file          173      165
 *     everything else 96      96
 *
 * Two facts sit in that table and they pull in opposite directions. **The equal-height rule is
 * already broken by four kinds in every renderer** — a textarea is taller than one line and a file
 * picker taller still, and neither is a defect. And **those four disagree across renderers**, by as
 * much as twenty-eight pixels, which cannot be anything but a defect: one document, one width, three
 * different forms.
 *
 * So this asserts the second and not the first. **A height this file could pick would be legislating**
 * — whether a toggle is 52 or 80 tall is a design decision and belongs in `DESIGN.md`, not in a
 * battle. What a battle can say is that the answer is the same everywhere.
 *
 * Labels are measured beside it because they are the other thing an eye follows down a form, and
 * they agree today: every kind's label starts at the same left edge in all three. That agreement is
 * worth holding.
 */
for (const _ of [0]) {
  test("a kind is the same height in every renderer", async ({ page }) => {
    test.setTimeout(300_000);

    /** kind → renderer → the rendered height of its root. */
    const seen = new Map<string, Record<string, number | null>>();
    const labelLefts = new Map<string, Record<string, number | null>>();

    for (const host of HOSTS) {
      await page.setViewportSize({ width: 1100, height: 900 });
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      await page.evaluate(({ api, kinds }) => {
        (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
          .mountFields("rhythm", kinds.map((k, i) => ({
            name: `f${i}`, kind: k, label: `Label ${k}`,
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          })) as never);
      }, { api: host.api, kinds: [...MDY_WIDGET_KINDS] });
      await page.waitForTimeout(600);

      const rows = await page.evaluate(({ kinds }) => {
        const root = document.querySelector('[data-form="rhythm"]');
        if (root === null) return [];
        return kinds.map((kind) => {
          const element = root.querySelector(`.mdy-renderer--${kind}`) as HTMLElement | null;
          if (element === null) return { kind, height: null, labelLeft: null };
          // A toggle wears its own label class rather than the shared one; asking for both keeps
          // this about where a label sits rather than about which anatomy drew it.
          const label = element.querySelector("label, .mdy-label, .mdy-toggle__label") as HTMLElement | null;
          return {
            kind,
            height: Math.round(element.getBoundingClientRect().height),
            labelLeft: label === null ? null : Math.round(label.getBoundingClientRect().left),
          };
        });
      }, { kinds: [...MDY_WIDGET_KINDS] });

      for (const { kind, height, labelLeft } of rows) {
        if (!seen.has(kind)) { seen.set(kind, {}); labelLefts.set(kind, {}); }
        seen.get(kind)![host.name] = height;
        labelLefts.get(kind)![host.name] = labelLeft;
      }
    }

    // The premise: the kinds were drawn somewhere. Three renderers agreeing on `null` would satisfy
    // every comparison below while describing three empty pages.
    const drawn = [...seen.values()].filter((byHost) => Object.values(byHost).some((h) => h !== null));
    expect(drawn.length, "no renderer drew any kind, so this battle is comparing nothing").toBeGreaterThan(10);

    const differs = [...seen.entries()]
      .filter(([, byHost]) => Object.values(byHost).every((h) => h !== null))
      .filter(([, byHost]) => new Set(Object.values(byHost)).size > 1)
      .map(([kind, byHost]) => ({ kind, ...byHost }));

    expect(
      differs,
      `${differs.length} kind(s) are a different height in different renderers:\n` +
        `${JSON.stringify(differs, null, 1)}\n\n` +
        "One document, one width, three forms. Which height is right is a design decision and this " +
        "file does not take it — that a textarea is taller than one line is not a defect. That it is " +
        "taller by different amounts depending on the adapter is.",
    ).toEqual([]);

    const labelsDiffer = [...labelLefts.entries()]
      .filter(([, byHost]) => Object.values(byHost).every((l) => l !== null))
      .filter(([, byHost]) => new Set(Object.values(byHost)).size > 1)
      .map(([kind, byHost]) => ({ kind, ...byHost }));

    expect(
      labelsDiffer,
      `${labelsDiffer.length} kind(s) start their label at a different left edge in different ` +
        `renderers:\n${JSON.stringify(labelsDiffer, null, 1)}\n\nThe left edge is what an eye ` +
        "follows down a form, and it agrees today. This holds that.",
    ).toEqual([]);
  });
}
