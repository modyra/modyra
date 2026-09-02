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
  // The range, added after its inner inset was found wrong in two renderers and corrected. It had no
  // image of its own, so the only thing that could see it was the full-page shot — where an eight
  // pixel move arrives as a few hundred changed pixels among a few hundred thousand, indistinguishable
  // from the page having been edited. A kind that has already been argued about is a kind that earns
  // its own frame.
  "daterange",
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
   * The page these images are taken on, defaulting to the renderer's front door.
   *
   * A per-widget baseline is sensitive to fractional layout *above* the widget: the box itself is a
   * whole number of pixels, its position is not, and a capture at a fractional offset rounds one way
   * or the other. Measured on the demo page: 72 elements carry a fractional height — every heading,
   * every line of prose — so a widget below them lands on a half pixel and a sentence rewritten
   * anywhere above it moves fourteen images.
   *
   * That is the failure a baseline suite must not have. Not because re-recording costs anything, but
   * because a prose edit then presents as fourteen widget regressions, and the habit that teaches is
   * re-recording without looking. So a renderer with a bench points its images there: the bench holds
   * every kind and nothing else, which makes an image move when the widget moves and not before.
   */
  readonly at?: string;
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

/**
 * The kinds that open a calendar, and the affordance that opens each — which all three renderers
 * draw with the same class.
 *
 * `datepicker` excludes `daterange` because a daterange *is* a datepicker by class, so the bare
 * selector would resolve to whichever came first in the document.
 *
 * **`daterange` is here because it was silently absent.** The exclusion above used to be the whole
 * story: nothing ever opened a daterange calendar, so a plant that broke its day cells passed with
 * every baseline green and was caught only by the adapter suites. An exemption living inside a
 * selector is a decision nobody can read — and this one was not even a decision, since the calendar
 * opens perfectly well when asked. Measured before writing this: both kinds expose one toggle, and
 * both open on a click.
 */
const CALENDAR_KINDS = ["datepicker", "daterange"] as const;
const calendarToggle = (kind: string): string =>
  `.mdy-renderer--${kind}${kind === "datepicker" ? ":not(.mdy-renderer--daterange)" : ""} .mdy-datepicker__toggle`;
const calendarPopup = (kind: string): string => `.mdy-renderer--${kind} ${POPUP}`;

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
  const openCalendar = async (page: import("@playwright/test").Page, kind = "datepicker"): Promise<void> => {
    await page.locator(calendarToggle(kind)).first().click();
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
    await page.goto(fixture.at ?? "/");
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
    for (const kind of CALENDAR_KINDS) {
      for (const theme of THEMES) {
        // The datepicker's images keep their original names so its baselines are not renamed into
        // new files; the daterange's carry the kind, because they are new.
        const shot = kind === "datepicker" ? `calendar-open-${theme}.png` : `calendar-open-${kind}-${theme}.png`;
        test(`the ${kind} docked calendar renders as it did under ${theme}`, async ({ page }) => {
          await settle(page, theme);
          await openCalendar(page, kind);
          const popup = page.locator(calendarPopup(kind)).first();
          // Asserted before the shot: an unopened popup screenshots as an empty box, and a baseline
          // recorded from one compares clean forever after.
          await expect(popup).toBeVisible();
          await expect(popup).toHaveScreenshot(shot);
        });
      }
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
