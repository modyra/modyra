/**
 * What a multiselect holding twelve choices costs a person who is not using a mouse.
 *
 * These are not defects against a written promise — they are holes in the design, and they were named
 * as such. Each is pinned as a property rather than as a fix, because each has more than one
 * defensible repair and choosing one here would decide the design from a test file.
 *
 *   1. **the overflow says nothing.** Twelve chosen, six visible, the strip scrolls and nothing on it
 *      says there is more. Many desktop mice cannot scroll horizontally at all, so the chips out of
 *      view are, in practice, gone. Scroll was chosen over a counter — then something has to say
 *      "there is more", or the scrolling is a capability nobody finds.
 *   2. **every chip is a tab stop, and so is its remove button.** The cost of leaving the field grows
 *      with what is in it. A roving tabindex makes the strip one stop; this asserts the growth, not
 *      the mechanism.
 *   3. **there is no way to clear the selection.** Twelve chosen come off one at a time.
 *   4. **removing a chip drops focus.** The focused element leaves the DOM and focus falls to the
 *      body, which puts a keyboard user back at the top of the page.
 *
 * The fourth is the classic defect of this control and the reason it is worth measuring rather than
 * assuming: it is invisible to anyone testing with a pointer, and it is invisible to a spec that
 * removes a chip and then asserts on the value.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: `v${index}`, label: `Opzione numero ${index}` }));

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, chosen: number) => {
    await page.evaluate(({ api, id, options, chosen }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields(id, [
          { name: "before", kind: "text", label: "Prima" },
          { name: "s", kind: "multiselect", label: "M", options, initialValue: options.slice(0, chosen).map((o: { value: string }) => o.value) },
          { name: "after", kind: "text", label: "Dopo" },
        ] as never);
    }, { api: host.api, id, options: OPTIONS, chosen });
    await page.waitForTimeout(450);
  };

  const open = async (page: import("@playwright/test").Page) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
  };

  test(`an overflowing strip says there is more, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    await mount(page, "more", 12);

    const state = await page.evaluate(() => {
      const root = document.querySelector('[data-form="more"]');
      const strip = root?.querySelector(".mdy-multiselect__chips") as HTMLElement | null;
      if (root === null || strip === null) return null;
      const stripBox = strip.getBoundingClientRect();
      const chips = Array.from(root.querySelectorAll(".mdy-chip"));
      const visible = chips.filter((chip) => {
        const box = chip.getBoundingClientRect();
        return box.left >= stripBox.left - 1 && box.right <= stripBox.right + 1;
      }).length;
      const style = getComputedStyle(strip);
      return {
        chips: chips.length,
        visible,
        overflows: strip.scrollWidth > strip.clientWidth,
        // Any of these counts as saying "there is more". Naming one would decide the design here.
        edgeHint: style.maskImage !== "none" || style.backgroundImage !== "none",
        describedBy: strip.getAttribute("aria-describedby") ?? strip.getAttribute("aria-label"),
        scrollControls: Array.from(root.querySelectorAll("button"))
          .map((button) => button.getAttribute("aria-label") ?? "")
          .filter((label) => /more|altre|next|scroll|avanti/i.test(label)),
      };
    });

    expect(state, "nothing was mounted").not.toBeNull();
    // The premise: some chips really are out of view. Nothing to announce is not a defect.
    expect(state!.overflows, "the strip does not overflow here, so there is nothing to announce").toBe(true);
    expect(state!.visible, `all ${state!.chips} chips are visible, so this fixture proves nothing`).toBeLessThan(state!.chips);

    const says = state!.edgeHint || state!.describedBy !== null || state!.scrollControls.length > 0;
    expect(
      says,
      `${state!.visible} of ${state!.chips} chips are in view and nothing says the other ` +
        `${state!.chips - state!.visible} exist — no edge hint, no count, no control, nothing on the ` +
        `strip for a reader. Many desktop mice cannot scroll horizontally, so those chips are gone`,
    ).toBe(true);
  });

  test(`leaving the field does not cost more as it fills, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);

    const stopsToLeave = async (id: string) => {
      await page.locator(`[data-form="${id}"] input`).first().focus();
      for (let pressed = 1; pressed <= 60; pressed += 1) {
        await page.keyboard.press("Tab");
        const arrived = await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null;
          return active?.closest("[data-field]")?.getAttribute("data-field")
            ?? (active?.getAttribute("aria-label") ?? active?.tagName ?? "none");
        });
        if (arrived === "after" || arrived === "Dopo") return pressed;
      }
      return 61;
    };

    await mount(page, "few", 2);
    const cheap = await stopsToLeave("few");
    await mount(page, "many", 12);
    const dear = await stopsToLeave("many");

    expect(
      dear,
      `crossing the field costs ${cheap} tab stops with two chosen and ${dear} with twelve — every ` +
        `chip is a stop and so is its remove button, so the price of getting past this control is ` +
        `set by how much a person put in it. A roving tabindex makes the strip one stop`,
    ).toBe(cheap);
  });

  test(`a selection can be cleared, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    await mount(page, "clear", 12);

    const controls = await page.evaluate(() => {
      const root = document.querySelector('[data-form="clear"]');
      if (root === null) return null;
      return Array.from(root.querySelectorAll("button, [role=button]"))
        .map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim())
        .filter((label) => /clear|svuota|remove all|rimuovi tutt|reset|deselect/i.test(label));
    });

    expect(controls, "nothing was mounted").not.toBeNull();
    expect(
      controls!.length,
      "twelve choices come off one at a time — there is no control that clears the selection, so " +
        "undoing a filter is twelve deliberate acts",
    ).toBeGreaterThan(0);
  });

  test(`removing a chip leaves focus inside the field, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);

    for (const which of ["middle", "last"] as const) {
      await mount(page, `focus_${which}`, 12);
      const landed = await page.evaluate(async ({ id, which }) => {
        const root = document.querySelector(`[data-form="${id}"]`);
        if (root === null) return null;
        const chips = Array.from(root.querySelectorAll(".mdy-chip"));
        const chip = which === "last" ? chips[chips.length - 1] : chips[Math.floor(chips.length / 2)];
        const button = chip?.querySelector("button") as HTMLElement | null;
        if (button === null || button === undefined) return { removed: false, where: "no remove button" };
        button.focus();
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 300));
        const active = document.activeElement as HTMLElement | null;
        return {
          removed: true,
          where: active === null || active === document.body ? "the document body" : (active.getAttribute("aria-label") ?? active.tagName),
          insideField: active !== null && active !== document.body && root.contains(active),
        };
      }, { id: `focus_${which}`, which });

      expect(landed, `${host.name} mounted nothing for the ${which} case`).not.toBeNull();
      expect(landed!.removed, `no remove button on the ${which} chip, so nothing could be removed`).toBe(true);
      expect(
        landed!.insideField,
        `removing the ${which} chip left focus on ${landed!.where} — the focused element leaves the ` +
          `DOM and nothing catches it, so a person navigating by keyboard is returned to the top of ` +
          `the page and has to travel back`,
      ).toBe(true);
    }
  });
}
