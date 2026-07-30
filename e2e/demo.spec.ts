import { expect, test } from "@playwright/test";

/**
 * Smoke test: the packaged demo boots, a text control accepts input and
 * required validation surfaces an error while blocking submit.
 */
test("demo boots, accepts input and enforces required fields", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "modyra Demo" }),
  ).toBeVisible();

  // Scope to the declarative contact form (other sections have their own
  // forms and submit buttons).
  const contactForm = page.locator("mdy-form", {
    has: page.getByLabel("First Name", { exact: true }),
  });

  // A text control accepts input.
  const firstName = contactForm.getByLabel("First Name", { exact: true });
  await firstName.fill("Ada");
  await expect(firstName).toHaveValue("Ada");

  // Required validation: blur an empty required field, the field is flagged
  // invalid with a visible error indicator and submit stays disabled.
  await firstName.fill("");
  await firstName.blur();
  await expect(firstName).toHaveAttribute("aria-invalid", "true");
  await expect(
    contactForm.getByRole("img", { name: /This field is required/ }),
  ).toBeVisible();
  await expect(
    contactForm.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();
});

/**
 * The typed-form section runs a debounced, cancellable serverValidator on
 * the username: a pending indicator appears while the mock endpoint runs,
 * then the "taken" error surfaces on blur.
 */
test("typed form validates the username against the server", async ({
  page,
}) => {
  await page.goto("/");
  // Scope to the typed-form section (the Zod wizard has a Username too).
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: /Typed form/ }),
  });
  const username = section.getByLabel("Username", { exact: true });

  await username.fill("admin");
  await expect(
    section.getByRole("status").filter({ hasText: "checking…" }),
  ).toBeVisible();

  await username.blur();
  await expect(
    section.getByText("Username is already taken"),
  ).toBeVisible();
});

test("an overlay draws one surface, not a wrapper's as well", async ({ page }) => {
  // `<mdy-overlay-panel>` carries `popover`, so it inherited the UA popover styles — `background:
  // canvas` and `padding: 0.25em`. Its only child is `position: fixed` and therefore out of flow, so
  // the wrapper collapsed to exactly its own padding: an opaque bar the popup's full width and 8px
  // tall, painted at the popup's own origin. Behind a popup with 10px corners it showed through the
  // cutouts — a white notch at each top corner, and worse the darker the theme.
  await page.goto("/");
  await page.waitForSelector("mdy-control-select", { state: "attached", timeout: 15000 });
  const trigger = page.locator(".mdy-select__trigger").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ force: true });
  // Wait for the popup to actually be laid out — clicking only asks for it, and this measures boxes.
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".mdy-select__dropdown")].some((el) => el.getBoundingClientRect().height > 0),
  );

  const surfaces = await page.evaluate(() => {
    const popup = [...document.querySelectorAll(".mdy-select__dropdown")]
      .find((el) => (el as HTMLElement).getBoundingClientRect().height > 0) as HTMLElement;
    const panel = popup.closest(".mdy-overlay-panel") as HTMLElement;
    const ps = getComputedStyle(panel);
    const popupBox = popup.getBoundingClientRect();
    const anchor = document.querySelector(".mdy-select__trigger") as HTMLElement;
    return {
      panelBackground: ps.backgroundColor,
      panelPadding: ps.paddingTop,
      panelBorder: ps.borderTopWidth,
      panelHeight: Math.round(panel.getBoundingClientRect().height),
      popupHeight: Math.round(popupBox.height),
      // The popup must still be the thing with a surface, and still on its control.
      popupHasSurface: ps.backgroundColor !== getComputedStyle(popup).backgroundColor,
      belowAnchor: Math.round(popupBox.top - anchor.getBoundingClientRect().bottom),
    };
  });

  // The wrapper paints nothing at all.
  expect(surfaces.panelBackground).toBe("rgba(0, 0, 0, 0)");
  expect(surfaces.panelPadding).toBe("0px");
  expect(surfaces.panelBorder).toBe("0px");
  expect(surfaces.panelHeight).toBe(0);
  // The popup still does, and is still on its control.
  expect(surfaces.popupHasSurface).toBe(true);
  expect(surfaces.popupHeight).toBeGreaterThan(0);
  expect(surfaces.belowAnchor).toBeGreaterThanOrEqual(0);
  expect(surfaces.belowAnchor).toBeLessThanOrEqual(12);
});

test("an overlay is positioned once, by the box that draws it", async ({ page }) => {
  // `<mdy-overlay-panel>` used to place itself — `position: fixed` with all four insets — while the
  // popup inside it read the same `--mdy-overlay-*` properties and placed itself a second time. Two
  // boxes at identical coordinates, agreeing only because both came from one measurement. Measured,
  // unpositioning either one left the popup exactly where it was, so one of them did nothing.
  //
  // The split was also hiding a defect: `max-height` was applied to the wrapper, whose only child is
  // out of flow, so it clamped nothing — and `--mdy-overlay-max-height` went unwritten, leaving the
  // popup on the foundation's `50vh` fallback. A popup taller than the room measured for it grew
  // straight past it.
  await page.goto("/");
  await page.waitForSelector("mdy-control-select", { state: "attached", timeout: 15000 });
  const trigger = page.locator(".mdy-select__trigger").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ force: true });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".mdy-select__dropdown")].some((el) => el.getBoundingClientRect().height > 0),
  );

  const boxes = await page.evaluate(() => {
    const popup = [...document.querySelectorAll(".mdy-select__dropdown")]
      .find((el) => (el as HTMLElement).getBoundingClientRect().height > 0) as HTMLElement;
    const panel = popup.closest(".mdy-overlay-panel") as HTMLElement;
    const anchor = document.querySelector(".mdy-select__trigger") as HTMLElement;
    const panelBox = panel.getBoundingClientRect();
    const popupBox = popup.getBoundingClientRect();
    return {
      panelArea: Math.round(panelBox.width * panelBox.height),
      popupPosition: getComputedStyle(popup).position,
      popupMaxHeight: getComputedStyle(popup).maxHeight,
      declaredMaxHeight: getComputedStyle(panel).getPropertyValue("--mdy-overlay-max-height").trim(),
      belowAnchor: Math.round(popupBox.top - anchor.getBoundingClientRect().bottom),
      // The wrapper must not stretch over the viewport either: the UA gives every popover
      // `inset: 0`, and a full-screen wrapper would swallow every click on the page behind it.
      cornerIsNotThePanel: !(document.elementFromPoint(4, 4) as HTMLElement)?.closest(".mdy-overlay-panel"),
    };
  });

  // The wrapper has no box at all — it hosts the top layer and nothing else.
  expect(boxes.panelArea).toBe(0);
  expect(boxes.cornerIsNotThePanel).toBe(true);
  // The popup is the positioned box, and it is on its control.
  expect(boxes.popupPosition).toBe("fixed");
  expect(boxes.belowAnchor).toBeGreaterThanOrEqual(0);
  expect(boxes.belowAnchor).toBeLessThanOrEqual(12);
  // The room the policy measured reaches the popup, rather than a wrapper that cannot use it.
  expect(boxes.declaredMaxHeight).toMatch(/^\d+px$/);
  expect(boxes.popupMaxHeight).toBe(boxes.declaredMaxHeight);
});
