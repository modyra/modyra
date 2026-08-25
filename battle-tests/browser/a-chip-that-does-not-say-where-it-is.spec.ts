/**
 * A chip says which one it is and how many there are, without anything being visible.
 *
 * **The property, and not the mechanism that happens to carry it.** ARIA offers two: a list-shaped set
 * says a place with `aria-posinset`/`aria-setsize` on the item, and a grid says it with `aria-colcount`
 * on the container against `aria-colindex` on the cell — the second being the one meant for a set that
 * is not all rendered, which a strip that scrolls is.
 *
 * This file asked for the first by name, because the decision standing when it was written had chosen
 * it. That decision has since been replaced, and a check naming a mechanism goes red against a correct
 * implementation of the other one — which is the failure it exists to catch in the library, committed
 * in the file that catches it.
 *
 * It is also the programmatic half of
 * [ADR 0127](../../docs/architecture/0127-a-strip-that-scrolls-against-the-practice.md)'s conditions.
 * That record takes a deliberate 1.4.10 departure — a chip row that scrolls rather than wraps — and
 * makes it conditional on the overflow being announced *independently of any visual affordance*. An
 * edge gradient is removed entirely by forced-colors mode and a polite live region is dropped by some
 * screen reader and browser pairs; this is the half that always holds.
 *
 * So the assertion is deliberately blind: it never looks at whether a chip is on screen. Six of twelve
 * chips are outside the strip's box and all twelve must still say "n of 12".
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS, bench } from "./bench";

for (const host of HOSTS) {
  test(`every chip says which one it is and how many there are, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "full");

    const read = await page.evaluate((sel) => {
      const strip = document.querySelector(sel)?.querySelector(".mdy-multiselect__chips");
      if (strip === null || strip === undefined) return null;
      const box = strip.getBoundingClientRect();
      const chips = Array.from(strip.querySelectorAll(".mdy-chip"));
      return {
        total: chips.length,
        inView: chips.filter((chip) => {
          const at = chip.getBoundingClientRect();
          return at.left >= box.left - 1 && at.right <= box.right + 1;
        }).length,
        // **Both mechanisms, because the property is what matters and ARIA offers two.** A list-shaped
        // set says it with `aria-posinset`/`aria-setsize` on the item; a grid says it with
        // `aria-colcount` on the container and `aria-colindex` on the cell — which is the one meant
        // for a set that is not all rendered, and a strip that scrolls is exactly that.
        //
        // Whichever a renderer uses, the same three things have to hold: every chip states a place,
        // they agree on how many there are, and no two claim the same one.
        stated: chips.map((chip) => {
          // The count sits on the container that owns the set, which is the strip itself or the
          // element carrying the grid role above it — a renderer may put the role either place.
          const owner = chip.closest("[aria-colcount]") ?? strip;
          const colcount = owner?.getAttribute("aria-colcount") ?? null;
          const colindex = chip.getAttribute("aria-colindex");
          const usesColumns = colcount !== null || colindex !== null;
          return {
            name: chip.getAttribute("aria-label") ?? (chip.querySelector(".mdy-chip__label")?.textContent ?? "").trim(),
            how: usesColumns ? "column" : "set",
            at: usesColumns ? colindex : chip.getAttribute("aria-posinset"),
            of: usesColumns ? colcount : chip.getAttribute("aria-setsize"),
          };
        }),
      };
    }, root);

    expect(read, "the strip drew nothing").not.toBeNull();

    // The premise: some chips really are out of view. A strip that fits announces nothing interesting,
    // and this spec would pass on it while proving nothing about the case it exists for.
    expect(
      read!.inView,
      `all ${read!.total} chips fit in the strip, so nothing here is hidden and the fixture is not the ` +
        `one this spec is about`,
    ).toBeLessThan(read!.total);

    const missing = read!.stated.filter((chip) => chip.at === null || chip.of === null);
    expect(
      missing.map((chip) => chip.name),
      `${missing.length} of ${read!.total} chips state no position in the set — ${read!.inView} are in `
      + "view, so a person using a screen reader is told neither where they are nor that there is more. "
      + "A list-shaped strip says it with aria-posinset and aria-setsize; a grid says it with "
      + "aria-colindex against the container's aria-colcount. Neither is written here.",
    ).toEqual([]);

    // Every chip agrees about how big the set is, and each says a different place in it. A renderer
    // writing the same index on every chip would satisfy "present" and say nothing.
    const how = read!.stated[0]?.how ?? "set";
    expect(
      new Set(read!.stated.map((chip) => chip.of)),
      `the chips disagree about how many there are, counting by ${how}`,
    ).toEqual(new Set([String(read!.total)]));

    expect(
      new Set(read!.stated.map((chip) => chip.at)).size,
      `the chips give ${new Set(read!.stated.map((chip) => chip.at)).size} distinct positions between `
      + `${read!.total} of them, counting by ${how}, so at least two claim the same place`,
    ).toBe(read!.total);
  });
}
