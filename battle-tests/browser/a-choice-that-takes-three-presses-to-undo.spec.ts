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
 * The contract has a fork here and holds neither side. Either `option[]` is a set, and the whitelist
 * that already inspects every entry is where a repeat is refused; or it is not, and unselecting an
 * option removes the option rather than one copy of it.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

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
    const pressedChips = (id: string) => page.evaluate((sel) => {
      const root = document.querySelector(sel);
      return root
        ? Array.from(root.querySelectorAll("button[aria-pressed]"))
            .filter((each) => each.getAttribute("aria-pressed") === "true")
            .map((each) => each.getAttribute("title"))
        : [];
    }, `[data-form="${id}"]`);
    const valueOf = (id: string) => page.evaluate(({ api, mountId }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId),
      { api: host.api, mountId: id });

    // The control: one occurrence behaves the way a chip is meant to. Whatever the duplicate does
    // below is about the repeat rather than about a toggle that never works.
    await mount("once", ["a"]);
    expect(await pressedChips("once")).toEqual(["A"]);
    await page.locator('[data-form="once"] button[title="A"]').click();
    await page.waitForTimeout(300);
    expect(await pressedChips("once")).toEqual([]);
    expect((await valueOf("once")).picks).toEqual([]);

    // The same option, held three times. The page has one thing to show and shows it.
    await mount("thrice", ["a", "a", "a"]);
    expect(await pressedChips("thrice")).toEqual(["A"]);

    // One press, on the one chip the user can see, asking for the one selection they can see.
    await page.locator('[data-form="thrice"] button[title="A"]').click();
    await page.waitForTimeout(300);

    expect(await pressedChips("thrice"), "the chip is still pressed after being pressed").toEqual([]);
    expect((await valueOf("thrice")).picks, "the form still holds the option the user unselected").toEqual([]);
  });
}
