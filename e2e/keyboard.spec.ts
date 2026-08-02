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
});

test("ArrowDown opens a closed list", async ({ page }) => {
  await expectOpen(page, false);
  await page.keyboard.press("ArrowDown");
  await expectOpen(page, true);
});

test("ArrowUp does not open a closed list", async ({ page }) => {
  // The asymmetry is deliberate: down reaches for the list, up has nothing above the trigger.
  await page.keyboard.press("ArrowUp");
  await expectOpen(page, false);
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
const DATE_INPUT = `${DATE} .mdy-datepicker__input`;
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
    const option = page.locator(`${SEGMENTED} .mdy-segmented__button:visible`).first();
    await expect(option).toBeVisible();
    await option.focus();

    // If focus did not take, everything after this asserts about a keystroke the widget never saw.
    await expect(option).toBeFocused();

    const checkedInFocusedHost = () => page.evaluate(() => {
      const host = document.activeElement?.closest(".mdy-renderer--segmented");
      const marked = host?.querySelector('[aria-checked="true"], [aria-pressed="true"]');
      return marked?.textContent?.trim() ?? null;
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
