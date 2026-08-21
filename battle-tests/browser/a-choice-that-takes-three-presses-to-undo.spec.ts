/**
 * One selection to look at, three presses to undo.
 *
 * A multiselect holds `option[]`, and nothing published says that array is a set. The anti-tampering
 * whitelist checks that every entry is an offered option, which `["a","a","a"]` is. So a value
 * holding the same choice three times is accepted by every check a form applies to it.
 *
 * The control shows it once — one chip, pressed — because that is all there is to show. Pressing the
 * chip to unselect it removes one occurrence: the chip stays pressed, the form still holds the
 * option, and nothing on the page says anything happened. The user presses again, and again, and the
 * third press finally does what the first one appeared to ask for.
 *
 * Neither renderer is failing to reconcile a view with a model on purpose — UI-006 is the rule that a
 * widget does not rewrite the model's value to make itself consistent, and rewriting on mount is
 * exactly what that forbids. The gap is the other side of it: a press is the user asking for a
 * change, and removing one of three is not the change they asked for.
 *
 * A value like this is not something the control can produce. It arrives the way every other
 * untrusted value arrives: a document's `initialValue`, a restored draft, a server round trip, an
 * application calling `set`.
 *
 * The contract is not silent about which of those should happen. `multiselectValueTransition` is
 * published, and its default intent — the toggle — returns the values with *every* occurrence of the
 * option removed. `decrement` is the one that takes a single occurrence away, and it exists because
 * `option[]` is deliberately a multiset: the chip classes carry `counter`, `count` and `step` for a
 * chip that steps a quantity.
 *
 * The chip here is not that chip. It carries `mdy-chip--selected` without `mdy-chip--counter`, so it
 * is a toggle, and a toggle is published as clearing the option. What the page does is `decrement`.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/**
 * The strip's chips and the popup's options carry the *same* class — `option` and `chip` both resolve
 * to `.mdy-chip`. So neither can be found by class alone: what separates them is which container they
 * are in, and both selectors below are built from that rather than from a role. `[role="option"]` does
 * not exist here, and a spec that assumed it timed out rather than failing, which reads as a broken
 * page instead of a wrong selector.
 */
const PARTS = MDY_WIDGET_CONTRACTS.multiselect.parts as Record<string, { classes: string[] }>;
const CHIP = PARTS.chip.classes[0]!;
const STRIP = PARTS.chips.classes[0]!;
// Distributed, not joined: `.a, .b [title]` binds the attribute to `.b` alone, so the first list is
// matched bare and the click waits forever on a container that was never going to be a button.
const optionIn = (inner: string) => PARTS.options.classes.map((one) => `.${one} ${inner}`).join(", ");

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

for (const host of HOSTS) {
  test(`unselecting a choice unselects it, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, initialValue: readonly string[]) => {
      await page.evaluate(({ api, mountId, options, value }) => {
        (window as never as Record<string, { mountFields(i: string, x: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "picks", kind: "multiselect", label: "Picks", options, initialValue: value }]);
      }, { api: host.api, mountId: id, options: OPTIONS, value: initialValue });
      await page.waitForTimeout(360);
    };
    /**
     * What the closed control shows as chosen.
     *
     * Read from the chips, because that is where a closed multiselect says what it holds. This file
     * used to read `button[aria-pressed]` with a `title` — the options rendered as pressable buttons
     * in the closed control, which is the anatomy from before the options moved into the popup. A
     * spec that names the DOM it expects goes red on a redesign instead of on a defect, and this one
     * did.
     */
    const chosenChips = (id: string) => page.evaluate(({ sel, root: rootSel }) => {
      const root = document.querySelector(rootSel);
      if (root === null) return [];
      const strip = root.querySelector(`.${sel.strip}`);
      if (strip === null) return [];
      return Array.from(strip.querySelectorAll(`.${sel.chip}`))
        .map((chip) => (chip.querySelector(".mdy-chip__label")?.textContent ?? chip.getAttribute("aria-label") ?? "").trim())
        .filter((label) => label !== "");
    }, { sel: { strip: STRIP, chip: CHIP }, root: `[data-form="${id}"]` });

    /** One press on the option, the way a person reaches it: open the control, press it in the list. */
    const pressOption = async (id: string, label: string) => {
      await page.locator(`[data-form="${id}"] .mdy-multiselect__trigger, [data-form="${id}"] [aria-haspopup]`)
        .first().click({ timeout: 5_000 });
      await page.waitForTimeout(250);
      // The option inside the list the contract names, not a chip anywhere on the page. The popup is
      // portalled out of the field, so this is scoped by the list rather than by the form.
      await page.locator(optionIn(`[title="${label}"]`)).first().click({ timeout: 5_000 });
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    };
    const valueOf = (id: string) => page.evaluate(({ api, mountId }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId),
      { api: host.api, mountId: id });

    // The control: one occurrence behaves the way a choice is meant to. Whatever the duplicate does
    // below is about the repeat rather than about a toggle that never works.
    await mount("once", ["a"]);
    expect(await chosenChips("once"), "one chosen value draws no chip").toEqual(["A"]);
    await pressOption("once", "A");
    expect(await chosenChips("once")).toEqual([]);
    expect((await valueOf("once")).picks).toEqual([]);

    // The same option, held three times. The page has one thing to show and shows it.
    await mount("thrice", ["a", "a", "a"]);
    expect(await chosenChips("thrice"), "three occurrences of one option draw more than one chip").toEqual(["A"]);

    // One press, on the one option the user can see, asking for the one selection they can see.
    await pressOption("thrice", "A");

    expect(await chosenChips("thrice"), "the chip is still there after the option was unselected").toEqual([]);
    expect((await valueOf("thrice")).picks, "the form still holds the option the user unselected").toEqual([]);
  });
}
