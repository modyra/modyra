import { expect, test } from "@playwright/test";

/**
 * What the widgets look like, pinned as images — the shared half, so each renderer states only what
 * differs about it.
 *
 * Geometry is measured everywhere else in this suite: heights, insets, angles and icon sizes all
 * have assertions. What none of them can answer is *did this change something it should not have*,
 * which is the question a stylesheet edit actually raises. A baseline turns it into a failing test
 * naming the widget and the theme.
 *
 * `DESIGN.md` answers the other question, a genuinely new decision. These answer regressions.
 *
 * ## Per engine and per platform, not per repository
 *
 * Each project keeps its own baselines, because engines rasterise differently — text especially —
 * and one shared set would fail everywhere for reasons unrelated to any change. So these catch a
 * regression *within* an engine; they do not compare engines to each other, and nothing here should
 * be read as evidence that two engines look alike.
 *
 * Playwright names snapshots by platform for the same reason, so a run on another operating system
 * finds no baseline rather than a wrong one — which fails loudly, as it should.
 *
 * ## Why the tolerance is zero
 *
 * Measured, not chosen: with animations disabled and the clock pinned, repeated runs are
 * pixel-identical, so zero costs nothing in flake and gives the most discrimination available. A
 * threshold generous enough to absorb flake is generous enough to absorb a regression — the answer
 * to a flapping baseline is to find the input that moves, never to widen the tolerance.
 *
 * That is not theoretical here. At a 0.2% tolerance, growing every icon by 2px passed all ten
 * baselines: the suite looked like coverage and was not.
 */

/** The shipped themes, each a separate stylesheet the demo can swap to. */
export const THEMES = ["modyra", "modyra-modern", "modyra-material", "modyra-ios"] as const;

/**
 * The kinds whose geometry has been contested, shot on their own.
 *
 * A full-page diff says something moved; a per-widget diff says what. These are the ones whose
 * spacing, affordance column or icon size has been argued about, so they are where a regression is
 * both most likely and hardest to spot in a full page.
 */
export const WIDGETS = [
  "select",
  "multiselect",
  "datepicker",
  "timepicker",
  "colors",
  "number",
] as const;

/**
 * A fixed instant, because the datepicker renders *today*.
 *
 * Without it every calendar baseline expires at midnight and the suite fails on a day nobody
 * changed anything — the exact failure that teaches a team to re-record without reading.
 */
const PINNED = new Date("2026-06-15T09:00:00Z");

export interface MdyVisualFixture {
  /** What the renderer calls the stylesheet link its themes are swapped on. */
  readonly themeLinkId: string;
  /** Something the renderer has certainly drawn, waited for before anything is shot. */
  readonly ready: string;
}

/**
 * Declare the baseline suite for one renderer.
 *
 * The name of every snapshot is `<subject>-<theme>.png`; Playwright appends the project and the
 * platform, so one call here produces a set per engine without the caller naming any of them.
 */
export function declareVisualBaselines(fixture: MdyVisualFixture): void {
  const settle = async (page: import("@playwright/test").Page, theme: string): Promise<void> => {
    await page.evaluate(
      async ([id, name]) => {
        const link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) throw new Error(`the demo has no #${id} to swap`);
        const href = `./themes/${name}.css`;
        // A link already pointing where it is being sent fires no `load`, so waiting for one waits
        // for ever. A demo starts on one of these themes, which makes that the common case rather
        // than the edge one.
        if (link.getAttribute("href") !== href) {
          await new Promise<void>((resolve) => {
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener("error", () => resolve(), { once: true });
            link.setAttribute("href", href);
          });
        }
        // Text metrics decide almost every pixel in these images, so a shot taken while a face is
        // still resolving is a shot of a different font.
        await document.fonts.ready;
      },
      [fixture.themeLinkId, theme] as const,
    );
    await page.waitForTimeout(150);
  };

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(PINNED);
    await page.goto("/");
    await expect(page.locator(fixture.ready).first()).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`${theme} renders every kind as it did`, async ({ page }) => {
      await settle(page, theme);
      await expect(page).toHaveScreenshot(`page-${theme}.png`, { fullPage: true });
    });
  }

  // One test per pair, not one test looping themes. A test that shoots four themes stops at the
  // first that differs, so its name says which widget moved and never which theme — half the answer,
  // and the half a per-widget baseline exists to supply.
  for (const kind of WIDGETS) {
    for (const theme of THEMES) {
      test(`${kind} renders as it did under ${theme}`, async ({ page }) => {
        await settle(page, theme);
        const widget = page.locator(`.mdy-renderer--${kind}`).first();
        await expect(widget).toBeVisible();
        await expect(widget).toHaveScreenshot(`${kind}-${theme}.png`);
      });
    }
  }
}
