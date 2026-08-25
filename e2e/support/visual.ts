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
  // Both choosers, because their anatomy changed once already: a segmented option became a label
  // around its own radio, and only the full-page shot noticed. A kind whose markup has moved is a
  // kind whose next move should be named.
  "segmented",
  "radio-group",
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
  /**
   * How this renderer is told to take the modal placement, when it can be told at all.
   *
   * A popup that covers the viewport is reached by running out of room, which a desktop shot never
   * does — so without a way to ask for it, the placement had no baseline and a change to it was
   * invisible here. A renderer with no such door leaves this out and the modal shot is skipped
   * rather than faked.
   */
  readonly forceModal?: (page: import("@playwright/test").Page) => Promise<void>;
}

/**
 * Declare the baseline suite for one renderer.
 *
 * The name of every snapshot is `<subject>-<theme>.png`; Playwright appends the project and the
 * platform, so one call here produces a set per engine without the caller naming any of them.
 */
/** The popup every renderer puts its calendar in, named by the catalogue rather than by a guess. */
const POPUP = ".mdy-datepicker__popup";

/** The affordance that opens it, which all three renderers draw with the same class. */
const CALENDAR_TOGGLE = ".mdy-renderer--datepicker:not(.mdy-renderer--daterange) .mdy-datepicker__toggle";

/**
 * Takes one full-page shot and throws it away, because the first one moves the page.
 *
 * Capturing beyond the viewport makes the engine lay the document out at its whole height, and the
 * rounding of `line-height: normal` lands differently there: a `th` gained a pixel, an `h2` lost one,
 * and the document went from 4371 to 4366 **inside the capture**. Font size, family and line-height
 * are identical before and after — measured — so nothing about the page changed except where the
 * sub-pixel boundaries fell.
 *
 * A second shot leaves it at 4366, and a third. So the state after one capture is the stable one, and
 * this is how the comparison gets to start from it. Waiting cannot substitute: the page is already
 * still, and it moves only when something asks it to be painted whole.
 *
 * The cost is one discarded capture per shot, which is the price of a baseline that means the same
 * thing twice.
 */
async function theCaptureHasHappenedOnce(page: import("@playwright/test").Page): Promise<void> {
  await page.screenshot({ fullPage: true });
}

/**
 * Waits until the page stops changing height, and fails rather than shooting if it never does.
 *
 * A full-page screenshot is the height of the document, so a page that settles at two heights
 * produces two images and the baseline is whichever one won the day it was recorded. One did: the
 * same shot alternated between 4707 and 4714 pixels, four times each over eight runs, and had been
 * failing half the time since the commit that wrote it — including at that commit.
 *
 * A fixed pause cannot express this. The theme swap above waits for the stylesheet to load, but the
 * theme a demo *starts* on fires no load event, so for that one theme nothing was waited for at all —
 * and that is the theme whose baseline was unstable.
 *
 * Two identical readings a frame apart, rather than a longer pause: a pause long enough to be safe
 * on a slow machine is a pause paid on every shot, and one short enough not to be is this defect
 * again with a bigger number.
 */
async function heightHasStopped(page: import("@playwright/test").Page): Promise<void> {
  const height = async (): Promise<number> => page.evaluate(() => document.documentElement.scrollHeight);
  let previous = await height();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(50);
    const current = await height();
    if (current === previous) return;
    previous = current;
  }
  throw new Error(`the page never stopped changing height — last reading ${previous}px, so any screenshot of it is one of several`);
}

export function declareVisualBaselines(fixture: MdyVisualFixture): void {
  const openCalendar = async (page: import("@playwright/test").Page): Promise<void> => {
    await page.locator(CALENDAR_TOGGLE).first().click();
    // The popup measures itself and is placed on the next frame; a shot taken before that is a shot
    // of a popup at the origin.
    await page.waitForTimeout(200);
  };

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
    await theCaptureHasHappenedOnce(page);
    await heightHasStopped(page);
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
  /**
   * The popup, which nothing photographed.
   *
   * Every shot above is at rest, and a resting overlay widget draws none of its popup: the calendar
   * grid, the month and year views, the modal header and the surface they sit on had no baseline at
   * all. A change to any of them was invisible to this suite — which is how a confirmation row could
   * be removed from two renderers without a single image moving.
   */
  test.describe("with the calendar open", () => {
    for (const theme of THEMES) {
      test(`the docked calendar renders as it did under ${theme}`, async ({ page }) => {
        await settle(page, theme);
        await openCalendar(page);
        await expect(page.locator(POPUP).first()).toBeVisible();
        await expect(page.locator(POPUP).first()).toHaveScreenshot(`calendar-open-${theme}.png`);
      });
    }

    if (fixture.forceModal) {
      for (const theme of THEMES) {
        test(`the modal calendar renders as it did under ${theme}`, async ({ page }) => {
          await settle(page, theme);
          await fixture.forceModal!(page);
          await openCalendar(page);
          const popup = page.locator(POPUP).first();
          await expect(popup).toBeVisible();
          // The whole page: a modal is defined by covering what is behind it, so a shot cropped to
          // the popup would photograph everything except the thing that makes it modal.
          await expect(page).toHaveScreenshot(`calendar-modal-${theme}.png`, { fullPage: false });
        });
      }
    }
  });

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
