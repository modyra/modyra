/**
 * The closed multiselect as a person meets it: the marks on its buttons, the names it truncates, the
 * search it was or was not asked for, and whether the strip scrolls or just squeezes.
 *
 * Six points were given for this control. **Three were already right** when measured against
 * `37f5eab2` and are not asserted here, because a spec's job is not to restate what works: the strip's
 * empty area opens the popup while a chip's remove button does not, and the strip carries no box of its
 * own — the control's shape is the box.
 *
 * These are the three that were not.
 *
 *     chip buttons        { text: "", aria: "Remove" }        a name and nothing to see
 *     mdy-chip__label     ellipsis · 112px shown of 188px     truncated, nothing shows the rest
 *     searchable false    1 search input, visible             the flag does nothing
 *     chips strip         overflow-x: visible, 704 = 704      does not scroll
 *
 * **The truncation and the scroll are one property, not two.** Nothing scrolls today because the
 * ellipsis absorbs the overflow — chips shrink until they fit — so a strip that scrolls only once its
 * chips have a floor width is the thing being asked for. Asserting "it scrolls" alone would pass a
 * strip whose chips had shrunk to nothing, which is why the width of a chip is measured against the
 * same chip in a control holding fewer.
 *
 * The mark on a button is asserted as **the button paints something**, never as a glyph: the mark is
 * the theme's and a spec naming one would go red on a theme that chose differently.
 *
 * The full name is asserted **without a pointer**. `title` is what a hurried fix reaches for and it
 * passes any hover check while never appearing for a keyboard or a touch user — the two entrances this
 * project spent a night restoring on the dial.
 *
 * Claims under attack: UI-009, A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const parts = MDY_WIDGET_CONTRACTS.multiselect.parts as Record<string, { classes: string[] }>;
const CHIP = parts.chip.classes[0]!;
const STRIP = parts.chips.classes[0]!;

const longOptions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    value: `v${index}`,
    label: `Opzione con un nome deliberatamente lungo numero ${index}`,
  }));

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, chosen: number, searchable = false) => {
    await page.evaluate(async ({ api, id, options, chosen, searchable }) => {
      (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
        .mountFields(id, [{
          name: "s", kind: "multiselect", label: "Scelte", searchable, options,
          initialValue: options.slice(0, chosen).map((option: { value: string }) => option.value),
        }]);
    }, { api: host.api, id, options: longOptions(14), chosen, searchable });
    await page.waitForTimeout(400);
  };

  test(`the strip draws a chip per choice and not per option, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Four offered, three taken. **The two counts must differ**: with every option chosen, a strip that
    // draws one chip per option and one that draws one per choice are the same strip, and a check made
    // that way reports a control that shows everything as a control that shows what was chosen.
    await page.evaluate(({ api }) => {
      const options = ["a", "b", "c", "d"].map((value) => ({ value, label: value.toUpperCase() }));
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields("perChoice", [{
          name: "s", kind: "multiselect", label: "S", options, initialValue: ["a", "b", "c"],
        }] as never);
    }, { api: host.api });
    await page.waitForTimeout(400);

    const drawn = await page.evaluate(({ chipClass, stripClass }) => {
      const root = document.querySelector('[data-form="perChoice"]');
      // **Scoped to the strip, not to the control.** `chip` and `option` both resolve to `.mdy-chip`,
      // and Angular keeps its popup inside the component where plain and lit portal theirs to the
      // body — so counting chips under the control counts the popup's options in one renderer and
      // nothing extra in the other two. The scope was equivalent while the options were drawn inline;
      // it stopped being equivalent when they moved, and the spec kept the old one and read the
      // difference as a defect in the renderer that had not changed.
      const strip = root?.querySelector(`.${stripClass}`);
      if (strip === null || strip === undefined) return null;
      return Array.from(strip.querySelectorAll(`.${chipClass}`))
        .map((chip) => (chip.getAttribute("aria-label") ?? chip.textContent ?? "").trim());
    }, { chipClass: CHIP, stripClass: STRIP });

    expect(drawn, "nothing was mounted").not.toBeNull();
    expect(
      drawn,
      `the strip is showing ${drawn?.length} chips for three chosen out of four offered — ` +
        `${JSON.stringify(drawn)}. A chip per option means the control shows the whole list whether or ` +
        `not a person took it, so nothing on it says what was chosen`,
    ).toEqual(["A", "B", "C"]);
  });

  test(`a chip's buttons carry a visible mark, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, "marks", 2);

    const buttons = await page.evaluate(({ chipClass }) => {
      const root = document.querySelector('[data-form="marks"]');
      if (root === null) return null;
      const found = Array.from(root.querySelectorAll(`.${chipClass} button`));
      return found.map((button) => {
        const own = getComputedStyle(button);
        const after = getComputedStyle(button, "::after");
        const before = getComputedStyle(button, "::before");
        const paints = (style: CSSStyleDeclaration) =>
          style.backgroundImage !== "none" || style.maskImage !== "none"
          || (style.content !== "none" && style.content !== "normal" && style.content !== '""');
        return {
          name: button.getAttribute("aria-label"),
          text: (button.textContent ?? "").trim(),
          marked: paints(own) || paints(after) || paints(before),
        };
      });
    }, { chipClass: CHIP });

    expect(buttons, "nothing was mounted").not.toBeNull();
    // The premise: a chip draws its buttons at all. None is finding 352, not this.
    expect(buttons!.length, "the chip drew no buttons, so there are no marks to look for").toBeGreaterThan(0);

    for (const button of buttons!) {
      expect(
        button.marked,
        `the ${JSON.stringify(button.name)} button paints nothing and its text is ` +
          `${JSON.stringify(button.text)} — a person using a pointer meets a blank square and reads it ` +
          `as decoration. Asserted as "it paints something" rather than as a glyph, because the mark ` +
          `belongs to the theme`,
      ).toBe(true);

      // **And the mark is not also a character.**
      // [ADR 0133](../../docs/architecture/0133-a-mark-that-is-never-text.md) decides the mark is
      // drawn and never written, and named this as the gap in its own verification: a renderer that
      // painted a mark *and* kept the glyph would satisfy the assertion above while doing the thing
      // the record forbids. A character in the button is a renderer deciding what a remove button
      // looks like, in three places, with a glyph no theme can change — and it is text a name can
      // absorb the day a chip stops declaring its own `aria-label`.
      expect(
        button.text,
        `the ${JSON.stringify(button.name)} button paints a mark and also writes ` +
          `${JSON.stringify(button.text)} in its text. Painted and written are not additive: the ` +
          `character is what a theme cannot change and what an accessible name can absorb`,
      ).toBe("");
    }
  });

  test(`a truncated name can be read without a pointer, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    // **A narrow field, not a long label.** A chip is shortened when a value is wider than the room
    // there is, and the room is the container — so a fixture that relies on the label being long
    // enough is relying on the bench being narrow enough, which is a property of the viewport rather
    // than of the widget. This test's premise died the day a chip stopped being capped at a constant:
    // the same label that used to overflow now fits, and the guard fired instead of the assertion.
    //
    // Sized to the widget's own limit rather than to the defect's: whatever a chip's ceiling turns
    // out to be, a field this narrow is below it.
    await page.setViewportSize({ width: 420, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, "long", 3);

    const chip = page.locator(`[data-form="long"] .${CHIP}`).first();
    expect(await chip.count(), "no chip was drawn").toBe(1);

    const truncated = await chip.evaluate((element) => {
      const label = element.querySelector(".mdy-chip__label") as HTMLElement | null;
      if (label === null) return null;
      return { shown: Math.round(label.getBoundingClientRect().width), full: label.scrollWidth };
    });

    // The premise: this name really is cut off. A chip wide enough for its label would make the
    // assertion below true for the wrong reason.
    expect(truncated, "the chip has no label element").not.toBeNull();
    expect(
      truncated!.full,
      `the label is not truncated here — ${truncated!.shown}px shown of ${truncated!.full}px — so ` +
        `nothing is hidden and this spec is measuring the wrong field`,
    ).toBeGreaterThan(truncated!.shown);

    await chip.focus();
    await page.waitForTimeout(300);

    const readable = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active === null) return null;
      const chip = active.closest(".mdy-chip") ?? active;
      const described = chip.getAttribute("aria-describedby");
      const tip = described === null ? null : document.getElementById(described);
      const visibleTip = Array.from(document.querySelectorAll('[role="tooltip"]'))
        .filter((element) => element.getBoundingClientRect().height > 0);
      return {
        focusedChip: chip.classList.contains("mdy-chip"),
        // `title` is deliberately not counted: it never appears for a keyboard or touch user, which is
        // the whole question this test asks.
        tooltipShown: visibleTip.length > 0 || (tip !== null && tip.getBoundingClientRect().height > 0),
      };
    });

    expect(readable?.focusedChip, "focus did not land on a chip, so nothing could have been revealed").toBe(true);
    expect(
      readable!.tooltipShown,
      `the chip's name is cut off at ${truncated!.shown}px of ${truncated!.full}px and focusing it ` +
        `reveals nothing. A \`title\` satisfies a hover and never appears for a keyboard or a touch ` +
        `user, so the truncation is resolvable only with a mouse`,
    ).toBe(true);
  });

  test(`a search box appears when it was asked for and not otherwise, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const searchBoxes = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll(".mdy-multiselect-overlay__input, .mdy-multiselect__search"))
          .filter((element) => element.getBoundingClientRect().height > 0).length);

    // One mount at a time: a popup is portalled out of the field, so two fields on one page cannot be
    // told apart by scope and the second reading would count the first's.
    await mount(page, "quiet", 1, false);
    await page.locator('[data-form="quiet"] .mdy-multiselect__trigger, [data-form="quiet"] [aria-haspopup]')
      .first().click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const withoutAsking = await searchBoxes();

    expect(
      withoutAsking,
      `a field that declared no search has ${withoutAsking} search box(es) on the page — the flag does ` +
        `nothing, so "the search stays when asked for" is true by never leaving`,
    ).toBe(0);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.evaluate(({ api }) => (window as never as Record<string, { dispose(i: string): void }>)[api].dispose("quiet"), { api: host.api });
    await page.waitForTimeout(200);

    // The control: the box appears when it is asked for. Without this, a renderer that simply never
    // draws one would pass the assertion above.
    await mount(page, "asking", 1, true);
    await page.locator('[data-form="asking"] .mdy-multiselect__trigger, [data-form="asking"] [aria-haspopup]')
      .first().click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);

    expect(
      await searchBoxes(),
      "a field that asked for a search has none, so the flag is being read as always-off rather than not read at all",
    ).toBe(1);
  });

  test(`the strip scrolls rather than squeezing its chips, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const chipWidth = async (id: string) =>
      page.evaluate(({ chipClass, id }) => {
        const root = document.querySelector(`[data-form="${id}"]`);
        const chip = root?.querySelector(`.${chipClass}`);
        return chip === undefined || chip === null ? null : Math.round(chip.getBoundingClientRect().width);
      }, { chipClass: CHIP, id });

    await mount(page, "few", 3);
    const roomy = await chipWidth("few");
    expect(roomy, "no chip was drawn in the three-chosen control").not.toBeNull();

    await mount(page, "many", 12);
    const crowded = await chipWidth("many");
    const strip = await page.evaluate(({ stripClass }) => {
      const element = document.querySelector(`[data-form="many"] .${stripClass}`);
      if (element === null) return null;
      return { client: element.clientWidth, scroll: element.scrollWidth, overflowX: getComputedStyle(element).overflowX };
    }, { stripClass: STRIP });

    expect(strip, "the many-chosen control drew no chips strip").not.toBeNull();

    // The property, and the reason it is two readings: a strip that scrolls *because* its chips kept
    // their width is what was asked for. Measuring the scroll alone would pass a strip whose chips had
    // shrunk to nothing, and measuring the width alone would pass one that simply overflows unseen.
    expect(
      crowded,
      `a chip is ${crowded}px with twelve chosen and ${roomy}px with three — the strip is squeezing its ` +
        `chips to fit rather than scrolling, so more choices means smaller ones and never a scroll`,
    ).toBe(roomy);

    expect(
      strip!.scroll,
      `the strip is ${strip!.scroll}px of content in ${strip!.client}px of space with overflow-x ` +
        `${strip!.overflowX} — twelve chips at their own width have nowhere to go`,
    ).toBeGreaterThan(strip!.client);
  });
}
