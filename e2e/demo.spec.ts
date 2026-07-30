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

test("the colour palette is placed by the contract, in every theme", async ({ page }) => {
  // The palette was the one popup in the catalog not wearing `mdy-popup`, so the foundation could
  // not place it — and the foundation, Material and iOS each carried their own copy of the popup
  // primitive to compensate: position, insets, `display` for open/closed, and their own `--above`
  // and `--overlay` placement rules. It wears `mdy-popup mdy-overlay` now and they do not.
  //
  // The reason this went unseen: the palette lives inside a collapsed <details> in this demo.
  // Chromium keeps a layout box for that content and never paints it, so it measures like a real
  // element and cannot be clicked — a popup nothing could open is a popup nothing could check.
  for (const theme of ["modyra", "modyra-modern", "modyra-material", "modyra-ios"]) {
    await page.goto("/");
    await page.waitForSelector("mdy-control-colors", { state: "attached", timeout: 15000 });
    await page.locator(".playground-accordion > summary").first().click();
    await page.waitForTimeout(250);
    await page.evaluate((name) => {
      const link = document.getElementById("mdy-theme-link") as HTMLLinkElement | null;
      if (link) link.href = `styles/${name}.css`;
    }, theme);
    await page.waitForTimeout(450);
    // Clicked like a user, in every theme. Material used to collapse this trigger to 44x0 — a
    // percentage height on a flex item the foundation already stretches — so it could not be
    // clicked at all there, and this test had to reach past the pointer to open the popup.
    await page.locator("mdy-control-colors .mdy-colors__toggle-area").first().click();
    await page.waitForTimeout(350);

    const placed = await page.evaluate(() => {
      const field = document.querySelector("mdy-control-colors") as HTMLElement;
      const popup = field.querySelector(".mdy-colors__dropdown") as HTMLElement;
      const anchor = field.querySelector(".mdy-colors__toggle-area") as HTMLElement;
      const b = popup.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      const cs = getComputedStyle(popup);
      return {
        onThePrimitive: popup.classList.contains("mdy-popup") && popup.classList.contains("mdy-overlay"),
        position: cs.position,
        below: b.top - a.bottom,
        inViewport: b.left >= 0 && b.top >= 0 && b.right <= window.innerWidth + 1,
        drawn: b.width > 0 && b.height > 0,
        // Each theme still gets to say what a palette looks like; what it no longer says is where.
        padding: parseFloat(cs.padding),
      };
    });

    expect(placed.onThePrimitive, theme).toBe(true);
    // Viewport coordinates, which is what `anchorOverlay` measured.
    expect(placed.position, theme).toBe("fixed");
    expect(placed.drawn, theme).toBe(true);
    expect(placed.inViewport, theme).toBe(true);
    // Below its control rather than at the page origin, which is where an unplaced popup lands.
    expect(placed.below, theme).toBeGreaterThanOrEqual(0);
    // Roomier than an ordinary popup: the palette asks for that through `--mdy-overlay-padding`.
    expect(placed.padding, theme).toBeGreaterThanOrEqual(16);
  }
});

test("the clock shows the hours its format has, on two rings, and takes the keyboard", async ({ page }) => {
  // Reported as "in 24h mode I see 12 hours, not 24" and "the keyboard does nothing on the numbers".
  // The demo carries both pickers, so the two faces are compared against each other rather than
  // against a remembered number.
  await page.goto("/");
  await page.waitForSelector("mdy-control-timepicker", { state: "attached", timeout: 15000 });

  const read = async (index: number) => {
    const picker = page.locator("mdy-control-timepicker").nth(index);
    const toggle = picker.locator(".mdy-timepicker__toggle");
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(400);
    // Scoped to the picker that was opened: a closed panel is `visibility: hidden`, which still has
    // a box, so "the first face with a height" finds the picker nobody opened.
    const state = await picker.evaluate((root) => {
      const face = root.querySelector(".mdy-timepicker-dial__face") as HTMLElement;
      const numbers = Array.from(face.querySelectorAll(".mdy-timepicker-dial__number")) as HTMLElement[];
      const box = face.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const radius = (el: HTMLElement) => {
        const b = el.getBoundingClientRect();
        return Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy);
      };
      const inner = numbers.filter((n) => n.classList.contains("mdy-timepicker-dial__number--inner"));
      const outer = numbers.filter((n) => !n.classList.contains("mdy-timepicker-dial__number--inner"));
      return {
        labels: numbers.map((n) => n.textContent!.trim()),
        innerCount: inner.length,
        outerRadius: Math.max(...outer.map(radius)),
        innerRadius: inner.length ? Math.max(...inner.map(radius)) : 0,
        role: face.getAttribute("role"),
        valueMax: face.getAttribute("aria-valuemax"),
        valueNow: face.getAttribute("aria-valuenow"),
        focused: document.activeElement === face,
        hasPeriodToggle: !!root.querySelector(".mdy-timepicker-period-toggle"),
      };
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    return state;
  };

  const twelve = await read(0);
  const day = await read(1);

  // Twelve hours and a period beside them.
  expect(twelve.labels).toHaveLength(12);
  expect(twelve.innerCount).toBe(0);
  expect(twelve.valueMax).toBe("12");
  expect(twelve.hasPeriodToggle).toBe(true);

  // Twenty-four hours and no period at all — the value 14:00 can now be pointed at.
  expect(day.labels).toHaveLength(24);
  expect(day.labels).toContain("14");
  expect(day.labels).toContain("00");
  expect(day.valueMax).toBe("23");
  expect(day.hasPeriodToggle).toBe(false);
  // On two rings, drawn at two radii. Equal radii means twelve numbers sitting on twelve others,
  // which is what a component stylesheet's copy of the foundation's placement produced.
  expect(day.innerCount).toBe(12);
  expect(day.innerRadius).toBeGreaterThan(0);
  expect(day.outerRadius - day.innerRadius).toBeGreaterThan(20);

  // The face is the control, and it holds focus as soon as the picker opens — otherwise the arrows
  // go to the page and the clock has a keyboard nobody can reach.
  for (const state of [twelve, day]) {
    expect(state.role).toBe("slider");
    expect(state.focused).toBe(true);
    expect(Number(state.valueNow)).not.toBeNaN();
  }
});

test("a slider's track fills up to its handle, in every theme", async ({ page }) => {
  // Reported as reading like "a circle sliding in a box" rather than a slider. Measured, the track
  // never filled: `--mdy-slider-track-color` composed the gradient at token scope, where
  // `--mdy-slider-fill-pct` is unset, so both colour stops were frozen at 0% and inherited down
  // already flat. The renderer wrote the real percentage onto the control every value change and
  // nothing read it.
  const stops = (image: string) =>
    Array.from(image.matchAll(/([\d.]+)%/g)).map((m) => Number(m[1]));

  for (const theme of ["modyra", "modyra-modern", "modyra-material", "modyra-ios"]) {
    await page.goto("/");
    await page.waitForSelector("mdy-control-slider", { state: "attached", timeout: 15000 });
    await page.evaluate((name) => {
      const link = document.getElementById("mdy-theme-link") as HTMLLinkElement | null;
      if (link) link.href = `styles/${name}.css`;
    }, theme);
    await page.waitForTimeout(400);

    const slider = page.locator("mdy-control-slider .mdy-slider").first();
    const read = () => slider.evaluate((el) => ({
      image: getComputedStyle(el).backgroundImage,
      value: Number((el as HTMLInputElement).value),
      max: Number((el as HTMLInputElement).max),
    }));

    const before = await read();
    expect(before.image, `${theme}: the track must be a split, not one flat colour`).toContain("linear-gradient");
    const atStart = stops(before.image);
    expect(atStart.length, theme).toBeGreaterThan(0);
    // Filled in proportion to the value it is sitting at, not stuck at zero.
    expect(atStart[0], `${theme}: track fill at value ${before.value}/${before.max}`).toBeGreaterThan(0);

    // And it follows the value: dragging the handle to the end fills the track further.
    await slider.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = input.max;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const after = await read();
    expect(stops(after.image)[0], `${theme}: fill after moving to max`).toBeGreaterThan(atStart[0]!);
  }
});

/**
 * Hover feedback on the controls whose colours were being hardwired rather than tokenised.
 *
 * The chip's +/− steppers hovered to `rgba(255, 255, 255, 0.2)` — white, calibrated for the dark
 * selected chip and, on the unselected one, measured at a shift of exactly 0 in all four themes:
 * white over white. The tint now mixes from `currentColor`, which on those buttons is the chip's own
 * label colour, so it darkens a light chip and lightens a dark one by construction.
 *
 * The slider's handle shadow moved to `--mdy-slider-thumb-shadow`, set on the container part rather
 * than restated per vendor pseudo-element. That indirection is the thing worth guarding: get the
 * scope wrong and the shadow silently disappears, which no unit test would notice.
 */
test("chip, segment and slider show what they are doing, in every theme", async ({ page }) => {
  // Chromium reports `color-mix()` results as `color(srgb r g b / a)` with channels in 0–1, and
  // everything else as `rgb()` in 0–255. Reading one as the other is how a visible hover measures
  // as invisible.
  const rgba = (value: string): [number, number, number, number] => {
    const n = (value.match(/[\d.]+/g) ?? []).map(Number);
    const scale = value.startsWith("color(") ? 255 : 1;
    return [n[0]! * scale, n[1]! * scale, n[2]! * scale, n.length > 3 ? n[3]! : 1];
  };
  // How far the hover moves the pixel that ends up on screen. Both the backdrop and the hover can
  // be translucent — iOS tints its segmented bar and its hover with the same fill — so each is
  // composited over the page in turn. Treating the backdrop as opaque makes "the same colour twice"
  // measure as no change, when what it really does is deepen.
  const over = (top: [number, number, number, number], base: [number, number, number]) =>
    [0, 1, 2].map((i) => top[i]! * top[3]! + base[i]! * (1 - top[3]!)) as [number, number, number];
  const shift = (backdrop: string, hover: string): number => {
    const page: [number, number, number] = [255, 255, 255];
    const behind = over(rgba(backdrop), page);
    const withHover = over(rgba(hover), behind);
    return Math.max(...[0, 1, 2].map((i) => Math.abs(withHover[i]! - behind[i]!)));
  };

  for (const theme of ["modyra", "modyra-modern", "modyra-material", "modyra-ios"]) {
    await page.goto("/");
    await page.waitForSelector(".mdy-chip__btn", { state: "attached", timeout: 15000 });
    await page.evaluate((name) => {
      const link = document.getElementById("mdy-theme-link") as HTMLLinkElement | null;
      if (link) link.href = `styles/${name}.css`;
    }, theme);
    await page.waitForTimeout(400);

    // A chip's stepper responds on the unselected chip and on the selected one — the two states
    // have opposite backgrounds, which is exactly what one fixed colour could not serve.
    for (const which of ["unselected", "selected"] as const) {
      const chip =
        which === "selected"
          ? page.locator(".mdy-chip--selected, .mdy-chip--value").first()
          : page.locator(".mdy-chip:not(.mdy-chip--selected)").first();
      const btn = chip.locator(".mdy-chip__btn:not([disabled])").first();
      if (!(await btn.count())) continue;

      // The chip's own background where it has one, otherwise the page behind it.
      const backdrop = await chip.evaluate((el) => {
        const own = getComputedStyle(el).backgroundColor;
        return (own.match(/[\d.]+/g) ?? []).length > 3 && own.endsWith("0)")
          ? "rgb(255, 255, 255)"
          : own;
      });
      await btn.hover();
      await page.waitForTimeout(150);
      const hovered = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(
        shift(backdrop, hovered),
        `${theme}: hovering a ${which} chip's stepper must be visible against the chip`,
      ).toBeGreaterThan(8);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(100);
    }

    // A segmented button's hover is a colour the theme chose, not a transparent no-op.
    // `:visible` matters: a collapsed `<details>` keeps a layout box for its contents, so the first
    // match is a segmented button Chromium never paints and can never hover.
    const segment = page
      .locator(".mdy-segmented__button:not(.mdy-segmented__button--selected):visible")
      .first();
    if (await segment.count()) {
      const bar = page.locator(".mdy-segmented:visible").first();
      const backdrop = await bar.evaluate((el) => getComputedStyle(el).backgroundColor);
      await segment.hover();
      await page.waitForTimeout(150);
      const hovered = await segment.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(rgba(hovered)[3], `${theme}: segmented hover must not be fully transparent`).toBeGreaterThan(0);
      expect(
        shift(backdrop.endsWith("0)") ? "rgb(255, 255, 255)" : backdrop, hovered),
        `${theme}: hovering an unselected segment must be visible`,
      ).toBeGreaterThan(2);
      await page.mouse.move(0, 0);
    }

    // The handle keeps the elevation its theme gives it, through the token rather than a rule.
    // Asserted on the control, not on `::-webkit-slider-thumb`: Chromium's getComputedStyle reports
    // `none` for that pseudo-element whether the shadow is set by a rule or by this token, so
    // reading it there would pass and fail for reasons that have nothing to do with the styles.
    const thumbShadow = await page
      .locator("mdy-control-slider .mdy-slider")
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--mdy-slider-thumb-shadow").trim());
    if (theme === "modyra-material" || theme === "modyra-ios") {
      expect(thumbShadow, `${theme}: the handle keeps its shadow`).not.toBe("none");
      expect(thumbShadow, `${theme}: the handle's shadow reaches the control`).toContain("rgba");
    }
  }
});
