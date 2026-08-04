import { expect, test } from "@playwright/test";

/**
 * The select, driven by real keys in a real browser.
 *
 * Milestone D's whole point: `role="listbox"` in the DOM says nothing about whether the arrow keys
 * move through it. This is the half jsdom cannot answer — focus, native key defaults, and what the
 * browser does with Tab are not simulable, and asserting them there produces a green that means
 * nothing.
 *
 * The policy is `selectKeyboardAction` in `@modyra/widgets`, asserted as a pure function in that
 * package's own suite. What is asserted here is that pressing the key actually does it.
 *
 * Every assertion below auto-retries. A key press and the frame that renders its result are two
 * different moments, and reading the DOM in between reports the state before the key — which looks
 * exactly like a widget that ignored it.
 */

const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

/** `aria-expanded` on the opener is the contract's own statement of open-ness. */
const expectOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", String(open));

/** Which part of the widget holds focus, or `null` when focus has left it entirely. */
const focusedPart = (page: import("@playwright/test").Page) =>
  page.evaluate((sel) => {
    const active = document.activeElement;
    if (!active || !active.closest(sel)) return null;
    return (active.className as string).split(" ").find((c) => c.startsWith("mdy-")) ?? "unknown";
  }, SELECT);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
  await page.locator(TRIGGER).first().focus();
  // Asserted, not assumed. A key pressed with focus elsewhere reaches nothing, and every test below
  // then passes by asserting that nothing happened — which is how a test that contradicted the
  // contract outright still went green about half the time.
  await expect(page.locator(TRIGGER).first()).toBeFocused();
});

test("ArrowDown opens a closed list", async ({ page }) => {
  await expectOpen(page, false);
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);
});

test("ArrowUp opens a closed list, the same as ArrowDown", async ({ page }) => {
  // Both directions reach for the list. This test used to assert the opposite, describing an
  // asymmetry the contract removed — `MDY_WIDGET_KEYBOARD` answers `ArrowUp@closed` with `open`, and
  // has since finding G2 closed. The test was not updated, and stayed green whenever the focus it
  // depends on failed to take.
  await expectOpen(page, false);
  await page.keyboard.press("ArrowUp");
  await expectOpen(page, true);
});

test("Enter opens a closed list, and Escape closes it again", async ({ page }) => {
  await page.keyboard.press("Enter");
  await expectOpen(page, true);
  await page.keyboard.press("Escape");
  await expectOpen(page, false);
});

test("opening from the keyboard puts focus where the user will type", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);
  // A searchable list that opens without focus asks for a second gesture before a keystroke does
  // anything, and gives a keyboard user no way in at all.
  await expect.poll(() => focusedPart(page)).not.toBeNull();
});

test("Escape closes and leaves focus inside the widget", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);

  await page.keyboard.press("Escape");
  await expectOpen(page, false);

  // The half only a browser can answer: where focus actually ended up. Landing on the document body
  // strands the user at the top of the page with no way back to the field they were in.
  await expect.poll(() => focusedPart(page), {
    message: "Escape must not leave the user on the document body",
  }).not.toBeNull();
});

test("Tab closes the list and lets focus carry on", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);

  await page.keyboard.press("Tab");
  await expectOpen(page, false);

  // Tab keeps its native meaning. A list left open follows the user to the next field, and focus
  // pulled back to the control they just left traps them in it.
  await expect.poll(() => focusedPart(page), {
    message: "Tab must not restore focus to the field being left",
  }).toBeNull();
});

/**
 * The multiselect, held to the same two rules.
 *
 * A separate widget with its own policy function — one commits and closes, the other keeps choosing
 * — but a closed list has nothing to move through in either, and Tab means the same thing in both.
 * Asserting them separately is what stops the two policies drifting into different keyboards.
 */
const MULTI = ".mdy-renderer--multiselect";
const MULTI_OPENER = `${MULTI} .mdy-multiselect__search-btn`;

const expectMultiOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(MULTI_OPENER).first()).toHaveAttribute("aria-expanded", String(open));

const multiFocusedPart = (page: import("@playwright/test").Page) =>
  page.evaluate((sel) => {
    const active = document.activeElement;
    if (!active || !active.closest(sel)) return null;
    return (active.className as string).split(" ").find((c) => c.startsWith("mdy-")) ?? "unknown";
  }, MULTI);

test.describe("multiselect", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(MULTI_OPENER).first()).toBeVisible();
    await page.locator(MULTI_OPENER).first().focus();
  });

  test("ArrowDown opens a closed list", async ({ page }) => {
    await expectMultiOpen(page, false);
    await page.keyboard.press("ArrowDown");
    await expectMultiOpen(page, true);
  });

  test("ArrowUp does not open a closed list", async ({ page }) => {
    await page.keyboard.press("ArrowUp");
    await expectMultiOpen(page, false);
  });

  test("Escape closes and leaves focus inside the widget", async ({ page }) => {
    await page.keyboard.press("ArrowDown");
    await expectMultiOpen(page, true);

    await page.keyboard.press("Escape");
    await expectMultiOpen(page, false);
    await expect.poll(() => multiFocusedPart(page), {
      message: "Escape must not leave the user on the document body",
    }).not.toBeNull();
  });

  test("Tab closes the list and lets focus carry on", async ({ page }) => {
    await page.keyboard.press("ArrowDown");
    await expectMultiOpen(page, true);

    await page.keyboard.press("Tab");
    await expectMultiOpen(page, false);

    // Not "focus left the widget": a multiselect's chips are tabbable and are legitimately the next
    // thing after its opener, so leaving is the wrong bar. What Tab must not do is *pull focus
    // back* to the control the user was leaving — which is what cancelling the key would cause.
    const onOpener = await page.evaluate(
      (sel) => document.activeElement?.matches(sel) ?? false,
      MULTI_OPENER,
    );
    expect(onOpener, "Tab must not restore focus to the opener it was leaving").toBe(false);
  });
});

/**
 * The datepicker, asked the same two questions.
 *
 * Its grid navigation already lives in the contract (`calendarKeyboardTarget`), which is why this
 * batch asks only what the other two batches found missing: whether the overlay can be reached from
 * the keyboard at all, and whether leaving it behaves.
 */
const DATE = ".mdy-renderer--datepicker";
const DATE_TOGGLE = `${DATE} .mdy-datepicker__toggle`;

const expectDateOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(DATE_TOGGLE).first()).toHaveAttribute("aria-expanded", String(open));

const dateFocusedPart = (page: import("@playwright/test").Page) =>
  page.evaluate((sel) => {
    const active = document.activeElement;
    if (!active || !active.closest(sel)) return null;
    return (active.className as string).split(" ").find((c) => c.startsWith("mdy-")) ?? "unknown";
  }, DATE);

test.describe("datepicker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(DATE_TOGGLE).first()).toBeVisible();
  });

  test("the calendar can be opened from the keyboard", async ({ page }) => {
    await page.locator(DATE_TOGGLE).first().focus();
    await expectDateOpen(page, false);
    await page.keyboard.press("Enter");
    await expectDateOpen(page, true);
  });

  test("Escape closes the calendar and leaves focus inside the widget", async ({ page }) => {
    await page.locator(DATE_TOGGLE).first().focus();
    await page.keyboard.press("Enter");
    await expectDateOpen(page, true);

    await page.keyboard.press("Escape");
    await expectDateOpen(page, false);
    await expect.poll(() => dateFocusedPart(page), {
      message: "Escape must not leave the user on the document body",
    }).not.toBeNull();
  });

  test("the arrows move through the grid once it is open", async ({ page }) => {
    await page.locator(DATE_TOGGLE).first().focus();
    await page.keyboard.press("Enter");
    await expectDateOpen(page, true);

    const focusedDay = () => page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? null);
    const before = await focusedDay();
    await page.keyboard.press("ArrowRight");
    // `role="grid"` says nothing about whether the arrows move through it. This is the difference.
    await expect.poll(focusedDay).not.toBe(before);
  });
});

/**
 * The date range: the same calendar, opened from a second endpoint.
 */
const RANGE = ".mdy-renderer--daterange";
const RANGE_TOGGLE = `${RANGE} .mdy-datepicker__toggle`;

test.describe("daterange", () => {
  const expectOpenRange = (page: import("@playwright/test").Page, open: boolean) =>
    expect(page.locator(RANGE_TOGGLE).first()).toHaveAttribute("aria-expanded", String(open));

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(RANGE_TOGGLE).first()).toBeVisible();
    await page.locator(RANGE_TOGGLE).first().focus();
  });

  test("the calendar can be opened from the keyboard", async ({ page }) => {
    await expectOpenRange(page, false);
    await page.keyboard.press("Enter");
    await expectOpenRange(page, true);
  });

  test("Escape closes it and leaves focus inside the widget", async ({ page }) => {
    await page.keyboard.press("Enter");
    await expectOpenRange(page, true);
    await page.keyboard.press("Escape");
    await expectOpenRange(page, false);

    const inside = await page.evaluate(
      (sel) => document.activeElement?.closest(sel) !== null,
      RANGE,
    );
    expect(inside, "Escape must not leave the user on the document body").toBe(true);
  });
});

/**
 * The segmented control: a radiogroup, where the arrows are the whole interaction.
 *
 * It has no overlay, so the questions are different — there is nothing to open or dismiss. What
 * matters is that `role="radiogroup"` is not just an attribute: the arrows must actually move the
 * selection, which is precisely the gap this milestone exists to close.
 */
const SEGMENTED = ".mdy-renderer--segmented";

test.describe("segmented", () => {
  /**
   * The host is identified by **where focus actually is**, not by guessing which instance is on
   * screen.
   *
   * The demo renders more than one segmented control, and every earlier attempt here picked the
   * host one way and read the selection another — focusing one instance and asserting about a
   * different one, which reports a working widget as broken. Letting the browser tell us which host
   * holds focus removes the guess.
   */
  test("the arrows move the selection", async ({ page }) => {
    await page.goto("/");
    // The segment is the label; the thing that takes focus is the radio inside it. Focusing the
    // label instead is not a smaller version of the same act — a label is not focusable, and asking
    // for it silently focuses nothing on the engines that say so.
    const option = page.locator(`${SEGMENTED} .mdy-segmented__button:visible`).first();
    await expect(option).toBeVisible();
    const control = option.locator(".mdy-segmented__control");
    // Focused in the page rather than through the driver: the control is visually hidden, and asking
    // a driver to focus something it cannot see is a different request from the one under test.
    await control.evaluate((el: HTMLElement) => el.focus());

    // If focus did not take, everything after this asserts about a keystroke the widget never saw.
    await expect(control).toBeFocused();

    const checkedInFocusedHost = () => page.evaluate(() => {
      const host = document.activeElement?.closest(".mdy-renderer--segmented");
      const marked = host?.querySelector('[aria-checked="true"], [aria-pressed="true"]');
      // The element carrying the state is not always the one carrying the text: a choice is a label
      // around its own radio, and the radio has no text of its own. Read the segment it sits in.
      const segment = marked?.closest(".mdy-segmented__button") ?? marked;
      return segment?.textContent?.trim() ?? null;
    });

    const before = await checkedInFocusedHost();
    expect(before, "the control starts with something selected").not.toBeNull();

    await page.keyboard.press("ArrowRight");
    // `role="radiogroup"` says nothing about whether the arrows move the selection. This does.
    await expect.poll(checkedInFocusedHost, {
      message: 'role="radiogroup" is not a keyboard: the arrows must move the selection',
    }).not.toBe(before);
  });
});

/**
 * The file field, and the honest limit of what a browser test can ask of it.
 *
 * Opening the picker ends in a native OS dialog that Playwright cannot see, so "Enter opens the file
 * chooser" is not assertable here and pretending otherwise would be a green that means nothing.
 * What *is* assertable is everything up to that boundary: the affordance is reachable by keyboard,
 * it is a real control rather than a decorated `div`, and the input it forwards to is not itself a
 * tab stop competing with it.
 */
const FILE = ".mdy-renderer--file";

test.describe("file", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(FILE).first()).toBeVisible();
  });

  test("the browse affordance is reachable from the keyboard", async ({ page }) => {
    const browse = page.locator(`${FILE} button:visible`).first();
    await expect(browse).toBeVisible();
    await browse.focus();
    await expect(browse, "a dropzone nobody can tab to is a mouse-only control").toBeFocused();
  });

  test("the affordance is a real button, not a styled div", async ({ page }) => {
    // The difference matters to a screen reader and to the keyboard: a `div` with a click handler
    // announces nothing and receives no Enter.
    const tag = await page.evaluate((sel) => {
      const host = document.querySelector(sel);
      const el = [...(host?.querySelectorAll("button") ?? [])].find((b) => (b as HTMLElement).offsetParent !== null);
      return el?.tagName ?? null;
    }, FILE);
    expect(tag).toBe("BUTTON");
  });

  test("one affordance, and a recorded question about which element owns it", async ({ page }) => {
    const stops = await page.evaluate((sel) => {
      const host = document.querySelector(sel)!;
      const input = host.querySelector<HTMLInputElement>('input[type="file"]');
      const button = [...host.querySelectorAll("button")].find((b) => (b as HTMLElement).offsetParent !== null);
      const tabbable = (el: HTMLElement | null | undefined) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        return !el.hidden && cs.display !== "none" && cs.visibility !== "hidden" && el.tabIndex >= 0;
      };
      return { input: tabbable(input), button: tabbable(button) };
    }, FILE);

    // **Measured: both are tab stops.** The input is visually hidden by the clip technique, which
    // deliberately keeps it focusable, and the button beside it forwards clicks to it. So a keyboard
    // user meets the same affordance twice — once announced as "choose file", once as "Browse".
    //
    // Which one should own it is a decision, not a defect, and the two answers are both defensible:
    // the contract's `label[for]` names the *input*, which argues the button should leave the tab
    // order; but the button is the visible affordance and the only one a sighted keyboard user can
    // see themselves land on. Recorded here with the measurement rather than settled unilaterally.
    expect(
      `input:${stops.input} button:${stops.button}`,
      "if this changed, the duplicate tab stop was resolved — update the note above",
    ).toBe("input:true button:true");
  });
});
