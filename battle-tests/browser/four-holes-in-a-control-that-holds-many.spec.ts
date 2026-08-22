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
import { bench } from "./bench";

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

  /**
   * The cue and the mechanism are the same affordance, or nothing joins them.
   *
   * The first version of this asked for a control whose label matched `/more|next|scroll/`, and it was
   * wrong in the way this suite exists to catch: **a pointer with no horizontal axis can already press
   * the trigger and get the popup, where every chosen value is listed and removable.** That is
   * pressable, it is not a scroll, and it reveals the rest — so the mechanism was there and the
   * assertion demanded a second one shaped like its own regular expression. Asked to build against it,
   * a renderer would have added a button that exists to satisfy a matcher.
   *
   * What is actually missing is smaller and harder to fake: **nothing says how many are out of sight,
   * and nothing connects the cue to the way through.** The gradient says *there is more* and names no
   * number; the trigger reveals everything and says nothing about the hidden ones. A person is told a
   * fact by one thing and offered an action by another, and has to guess they are related.
   *
   * So this asks for one affordance that does both: something pressable whose accessible name states
   * how many are not visible. A `+6` beside the control satisfies it; a trigger renamed to say "Scelte,
   * 6 more not shown" satisfies it; a bare arrow does not, and neither does static text.
   *
   * That is also the published answer. An outside review ranked an overflow counter second of five,
   * behind wrapping the row, and was explicit that it **must be a real button that reveals the
   * remainder, not static text** — static text tells a pointer user content exists and gives them no
   * way to get it.
   */
  test(`something says how many are out of sight and can be pressed, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    const { root } = await bench(page, host, "full");

    const reach = await page.evaluate((sel) => {
      const field = document.querySelector(sel);
      const strip = field?.querySelector(".mdy-multiselect__chips");
      if (field === null || strip === null || strip === undefined) return null;
      const box = strip.getBoundingClientRect();
      const chips = Array.from(strip.querySelectorAll(".mdy-chip"));
      const hidden = chips.filter((chip) => {
        const at = chip.getBoundingClientRect();
        return at.left < box.left - 1 || at.right > box.right + 1;
      }).length;
      const named = (element: Element) =>
        (element.getAttribute("aria-label") ?? (element.textContent ?? "").trim()).replace(/\s+/g, " ");
      const pressable = Array.from(field.querySelectorAll("button, [role=button]")).map(named);
      return {
        hidden,
        chips: chips.length,
        pressable,
        // A number in the name of something pressable. Not a particular word, and not a number
        // anywhere on the page: the fact and the way through have to be the same thing.
        saysHowMany: pressable.filter((name) => /\d/.test(name)),
      };
    }, root);

    expect(reach, "nothing was mounted").not.toBeNull();
    // The premise: something really is out of sight. A strip that fits owes no count.
    expect(reach!.hidden, `all ${reach!.chips} chips are in view, so this fixture hides nothing`).toBeGreaterThan(0);

    expect(
      reach!.saysHowMany,
      `${reach!.hidden} of ${reach!.chips} chips are out of sight and nothing pressable says so. What ` +
        `can be pressed is ${JSON.stringify(reach!.pressable)}. The gradient says there is more and ` +
        `names no number; the trigger reveals everything and mentions none of it — so the fact and the ` +
        `way through are two different things and a person has to guess they are related`,
    ).not.toEqual([]);
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

  /**
   * Where focus goes after a removal, stated as a rule rather than as a threshold.
   *
   * "Stays inside the field" is a floor, and a floor is what a renderer satisfies by accident: lit
   * passes it on a middle chip and fails on the last one, because focus is *landing* on whatever
   * occupies that index afterwards instead of being *placed*. The rule that distinguishes the two is
   * **the next chip, else the previous one, else the trigger** — it names an answer for the end of the
   * strip and for an empty strip, which are the two cases an accidental implementation gets wrong.
   */
  test(`removing a chip places focus, next then previous then the trigger, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);

    const removeAndSee = async (id: string, at: "middle" | "last" | "only") => {
      await page.evaluate(({ id, at }) => {
        const root = document.querySelector(`[data-form="${id}"]`)!;
        const chips = Array.from(root.querySelectorAll(".mdy-chip"));
        const chip = at === "last" ? chips[chips.length - 1] : at === "only" ? chips[0] : chips[Math.floor(chips.length / 2)];
        const labelOf = (element: Element | undefined) => element?.getAttribute("aria-label") ?? null;
        (window as never as Record<string, unknown>).__expected =
          at === "last" ? labelOf(chips[chips.length - 2])
          : at === "only" ? "TRIGGER"
          : labelOf(chips[Math.floor(chips.length / 2) + 1]);
        (chip?.querySelector("button") as HTMLElement | null)?.focus();
        (chip?.querySelector("button") as HTMLElement | null)?.click();
      }, { id, at });
      await page.waitForTimeout(300);
      return page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const expected = (window as never as Record<string, string | null>).__expected;
        const chip = active?.closest(".mdy-chip");
        return {
          expected,
          landedOn: active === null || active === document.body ? "the document body"
            : chip !== null && chip !== undefined ? `the chip ${JSON.stringify(chip.getAttribute("aria-label"))}`
            : (active.getAttribute("aria-label") ?? active.tagName),
          isTrigger: active?.classList.contains("mdy-multiselect__trigger") ?? false,
          chipLabel: chip?.getAttribute("aria-label") ?? null,
        };
      });
    };

    await mount(page, "place_mid", 12);
    const mid = await removeAndSee("place_mid", "middle");
    // The premise, and it is the whole test: focus falling to the body reads the chip label as `null`,
    // and a chip with no `aria-label` makes the expected value `null` too — so without this the
    // assertion below passes by comparing nothing to nothing. It did, three times, before this line.
    expect(
      mid.expected,
      "the chip after the removed one has no accessible name, so there is nothing to expect focus on " +
        "and this comparison would succeed however the renderer behaves",
    ).not.toBeNull();
    expect(
      mid.chipLabel,
      `removing a chip in the middle put focus on ${mid.landedOn}; the rule is the next chip, which ` +
        `was ${JSON.stringify(mid.expected)}`,
    ).toBe(mid.expected);

    await mount(page, "place_last", 12);
    const last = await removeAndSee("place_last", "last");
    expect(last.expected, "the chip before the removed one has no accessible name").not.toBeNull();
    expect(
      last.chipLabel,
      `removing the last chip put focus on ${last.landedOn}; there is no next chip, so the rule is the ` +
        `previous one, which was ${JSON.stringify(last.expected)}. This is the case an implementation ` +
        `that lets focus fall to whatever holds that index gets wrong while passing the middle one`,
    ).toBe(last.expected);

    await mount(page, "place_only", 1);
    const only = await removeAndSee("place_only", "only");
    expect(
      only.isTrigger,
      `removing the only chip put focus on ${only.landedOn}; the strip is empty, so the rule is the ` +
        `trigger — the one place still there to hold it`,
    ).toBe(true);
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
