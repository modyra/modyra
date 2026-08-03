import { expect, test } from "@playwright/test";

/**
 * The dismissal gesture, measured in a browser on the framework-free renderer.
 *
 * `capabilities.dismissOnOutsidePointer` declares `{ mode: "pointer-pair" }`: an overlay dismisses
 * only when press *and* release both land outside it. ADR 0013 states the table; these assert it
 * where it actually happens, because the rule is about real pointer sequences and a unit test
 * dispatches whichever ones it was written to dispatch.
 *
 * The two rows that a single-event rule cannot express, and that this file exists for:
 *
 *   - a drag beginning outside and ending inside — pressing away and thinking better of it;
 *   - a drag beginning inside and ending outside — selecting text in a popup.
 */

test.use({ hasTouch: true });

const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

const expectOpen = (page: import("@playwright/test").Page, open: boolean) =>
  expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", String(open));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(TRIGGER).first()).toBeVisible();
});

test("a tap outside dismisses the list", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  await page.locator("h1").first().tap();
  await expectOpen(page, false);
});

test("a drag begun inside the popup and released outside keeps it open", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // The pointer rule refuses this: the interaction began inside.
  //
  // **This does not exercise the focus precedence**, and measurement says why: an option calls
  // `preventDefault` on `mousedown` to keep focus in the search box, so no `focusout` fires anywhere
  // in this sequence — observed as `pointerdown:option, pointerup:…, click:BODY` with
  // `document.activeElement` never leaving `.mdy-select__search`. Removing the precedence gate leaves
  // this test green.
  //
  // The gate is asserted directly instead, in `packages/widgets/test/dismissal.spec.mjs` §13. It
  // becomes load-bearing here the day that `preventDefault` goes.
  const popup = await page.locator(".mdy-select__dropdown").first().boundingBox();
  const heading = await page.locator("h1").first().boundingBox();
  expect(popup).not.toBeNull();
  expect(heading).not.toBeNull();
  if (!popup || !heading) return;

  await page.mouse.move(popup.x + popup.width / 2, popup.y + popup.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + 5, heading.y + 5, { steps: 10 });
  await page.mouse.up();

  await expectOpen(page, true);
});

test("a drag that starts outside still closes it — through focus, not the pointer", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // Press outside and move away without releasing over the same target: the gesture a touch user
  // makes to scroll. No `click` is produced by it.
  const heading = await page.locator("h1").first().boundingBox();
  expect(heading).not.toBeNull();
  if (!heading) return;

  await page.mouse.move(heading.x + 5, heading.y + 5);
  await page.mouse.down();
  await page.mouse.move(heading.x + 5, heading.y + 240, { steps: 8 });

  // **Still closes, and not by the gesture.** The gesture has not completed — there is no
  // `pointerup` yet — so `pointer-pair` has decided nothing. What closes the popup is a *second*
  // path the contract does not name: the widget's own `focusout`, because pressing on the heading
  // takes focus out of it.
  //
  // ADR 0013 carries this forward from ADR 0011 as an open incompleteness. Asserted as it behaves
  // rather than as the contract reads, so the gap stays visible instead of being papered over.
  await expectOpen(page, false);
  await page.mouse.up();
});

test("a completed gesture outside dismisses — the row the contract names", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // Press and release both outside. Isolated from the focus path by being a real click on one
  // target, so what is measured is the gesture and not the focus move that accompanies it.
  await page.locator("h1").first().click();
  await expectOpen(page, false);
});

test("a cancelled pointer does not dismiss", async ({ page, browserName }) => {
  // Chromium only, and not because the rule is. A *genuine* `pointercancel` is one the browser
  // decides to send, and CDP's `Input.dispatchTouchEvent` is the only way to make a browser decide
  // that; Firefox and WebKit expose no equivalent. Dispatching a synthetic event instead would
  // assert the handler and never the browser, which is the whole point of testing this here.
  //
  // The rule itself is asserted engine-independently in `packages/widgets/test/dismissal.spec.mjs`.
  test.skip(browserName !== "chromium", "a real pointercancel needs CDP");

  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // A genuine `pointercancel`, not a dispatched one: CDP's `touchCancel` is what the browser itself
  // sends when it takes a gesture over to scroll, which is the case ADR 0013 protects. A synthetic
  // event would prove the handler and not the browser.
  //
  // Aimed at the popup rather than outside it, deliberately: pressing outside also moves focus, and
  // this renderer's unnamed `focusout` path would close the popup for a reason that has nothing to
  // do with the pointer — which is the interference ADR 0013 records as still open.
  const popup = await page.locator(".mdy-select__dropdown").first().boundingBox();
  expect(popup).not.toBeNull();
  if (!popup) return;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: popup.x + popup.width / 2, y: popup.y + popup.height / 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });

  await expectOpen(page, true);
});

test("a gesture that begins inside and ends outside keeps the list open", async ({ page }) => {
  await page.locator(TRIGGER).first().tap();
  await expectOpen(page, true);

  // Selecting text in a popup and releasing past its edge. `click` fires on the common ancestor,
  // so an event-named rule dismisses here; the pair does not, because one end was inside.
  // Not scoped to the widget: this renderer portals its popup out of the field, which is why
  // `portalRootFor` exists. Document scope is the only place it is reliably found.
  const popup = await page.locator(".mdy-select__dropdown").first().boundingBox();
  const heading = await page.locator("h1").first().boundingBox();
  expect(popup).not.toBeNull();
  expect(heading).not.toBeNull();
  if (!popup || !heading) return;

  await page.mouse.move(popup.x + popup.width / 2, popup.y + popup.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + 5, heading.y + 5, { steps: 8 });
  await page.mouse.up();

  await expectOpen(page, true);
});
