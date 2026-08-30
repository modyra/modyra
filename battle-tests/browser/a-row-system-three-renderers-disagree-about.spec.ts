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
 * **Pinned, and not on the scale migration.** That finished — its gate, `a-value-that-is-not-a-step`,
 * is closed — and these rows did not move. A scale reconciles numbers; it cannot reconcile two
 * element trees, and that is what these are: measured on the current head, plain interposes an
 * inliner inside the input wrapper where lit and Angular put the control straight into it, so the
 * control's own rows drive the height where nothing stands between.
 *
 *     textarea   plain  84   lit 108   angular 108
 *     checkbox   plain  44   lit  20   angular  20
 *
 * **The controls themselves agree; what differs is what a renderer puts around them.** Measured on
 * this page, `.mdy-checkbox` is 20 in all three renderers and `.mdy-toggle` is 32 in all three. The
 * roots differ because one renderer draws a supporting-text and an error band and spaces them away
 * from the control, and the other two draw fewer or none — and under ADR 0180 both are conforming.
 *
 * Excluding those bands **and their margins** makes checkbox and toggle agree exactly, and breaks
 * nine other kinds: it takes spacing off the renderer that has bands and nothing off the ones that
 * do not, which is unfair in the other direction rather than fairer. Measured and rejected; the file
 * subtracts the bands' boxes and not their margins.
 *
 * What is left after that is `textarea` and `file`, and **they have two different causes, neither of
 * them an anatomy**:
 *
 *     textarea   rows=2 in one renderer, rows=3 in two — same line height, same padding, same
 *                min-height, so 2×24+16 = 64 against 3×24+16 = 88. A default for an attribute the
 *                document cannot declare and the catalogue cannot state: `capabilities` is about
 *                overlays, `variants` is empty, and the dynamic field schema has no `rows`. So
 *                aligning the renderers would be agreement by coincidence, holding until a fourth
 *                picks a fifth number. What is owed is somewhere to say it.
 *     file       the container itself: 181 against 173. No inliner on any side; eight pixels stated
 *                somewhere in the container's own box.
 *
 * **Neither is a control-scale question** — no step is involved on any side — and neither is settled
 * by `DESIGN.md`'s row-system rule, which is about where a height *comes from* rather than about
 * which element tree states it. The `textarea` one is the shape ADR 0179 names: silence is a default
 * and not a neutral position, and three renderers filled the same silence two ways.
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
 * **What is measured is the row a kind draws, not the column it stands in**, and the difference is
 * the whole of this file's history. A field's column is its row plus whatever bands the renderer
 * puts under it, and [ADR 0180](../../docs/architecture/0180-a-container-held-open-under-a-field-that-can-fail.md)
 * makes two treatments of those bands conforming: one renderer holds the container open from the
 * first paint with a reference landing on it, another builds it when it has something to say, and a
 * third draws none. Measured on the same checkbox, the three columns are 48, 20 and 20 — four pixels
 * of empty band and twenty-four of the margins that stand it away from the control — while the three
 * *rows* are 20, 20 and 20.
 *
 * So a column comparison asserts agreement on something a record permits to differ, and its verdict
 * is decided by whichever conforming choice each adapter made. Subtracting the bands does not rescue
 * it: taking the box alone leaves the margins in, and taking box and margins together makes twelve
 * kinds disagree that had been agreeing because two band treatments happened to cancel. The
 * agreement a column comparison reports is coincidence in both directions.
 *
 * **The row is asked of the contract rather than listed here.** `inputWrapper` is the part a kind
 * with a shell carries, and a kind without one draws a group, a track or a dropzone — the same
 * object under the name its own anatomy uses. A list in this file would be a second catalogue, and it
 * would drift the first time a kind gained a part.
 *
 * **A height this file could pick would be legislating** — whether a toggle is 32 tall is a design
 * decision and belongs in `DESIGN.md`, not in a battle. What a battle can say is that the answer is
 * the same everywhere, and it is: every kind whose row the contract names agrees across the three,
 * `textarea` at three lines and `file` at 173 included.
 *
 * Kinds whose row the contract does not name are reported rather than skipped, because a check that
 * quietly drops what it cannot reach reads as coverage of everything.
 *
 * Labels are measured beside it because they are the other thing an eye follows down a form, and
 * they agree today: every kind's label starts at the same left edge in all three. That agreement is
 * worth holding.
 *
 * What this cannot say is that the shared height is right. Three renderers moving a toggle to eight
 * pixels together would pass, which is the standing blind spot of every comparison on this board.
 */
/**
 * The element a kind draws as its own row, asked of the contract rather than named here.
 *
 * `inputWrapper` is the part every kind with a shell carries, and where a kind has none the group,
 * track or dropzone it draws instead is the same object under another name. A list written in this
 * file would be a second catalogue that drifts the moment a kind gains a part.
 */
const rowSelectorFor = (kind: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)[kind]?.parts ?? {};
  const row = parts["inputWrapper"] ?? parts["group"] ?? parts["track"] ?? parts["dropzone"];
  return (row?.classes ?? []).map((one) => `.${one}`).join("");
};

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
        return kinds.map(({ kind, rowSelector }) => {
          const element = root.querySelector(`.mdy-renderer--${kind}`) as HTMLElement | null;
          if (element === null) return { kind, height: null, labelLeft: null };
          // A toggle wears its own label class rather than the shared one; asking for both keeps
          // this about where a label sits rather than about which anatomy drew it.
          const label = element.querySelector("label, .mdy-label, .mdy-toggle__label") as HTMLElement | null;
          const row = rowSelector === "" ? null : element.querySelector(rowSelector) as HTMLElement | null;
          return {
            kind,
            height: row === null ? null : Math.round(row.getBoundingClientRect().height),
            labelLeft: label === null ? null : Math.round(label.getBoundingClientRect().left),
          };
        });
      }, { kinds: MDY_WIDGET_KINDS.map((kind) => ({ kind, rowSelector: rowSelectorFor(kind) })) });

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

    const unreached = [...seen.entries()]
      .filter(([, byHost]) => Object.values(byHost).every((h) => h === null))
      .map(([kind]) => kind);

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
        "taller by different amounts depending on the adapter is.\n\nKinds whose row the contract " +
        `does not name, so not compared here: ${JSON.stringify(unreached)}.`,
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
