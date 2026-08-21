/**
 * A chip says which one it is and how many there are, without anything being visible.
 *
 * [ADR 0128](../../docs/architecture/0128-a-chip-is-one-thing-not-a-cell.md) decided the strip is not
 * a grid: a chip is one operable thing rather than a cell with children. That trade gives up what a
 * `gridcell` supplies for free — the "row 1, column 3 of 12" scaffolding a screen reader reads out —
 * and the record names `aria-posinset`/`aria-setsize` as what replaces it. **A condition of the
 * decision, not an improvement to it**, and the ADR says in its own Verification section that nothing
 * asserted it. This is that assertion.
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
        stated: chips.map((chip) => ({
          name: chip.getAttribute("aria-label") ?? (chip.querySelector(".mdy-chip__label")?.textContent ?? "").trim(),
          posinset: chip.getAttribute("aria-posinset"),
          setsize: chip.getAttribute("aria-setsize"),
        })),
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

    const missing = read!.stated.filter((chip) => chip.posinset === null || chip.setsize === null);
    expect(
      missing.map((chip) => chip.name),
      `${missing.length} of ${read!.total} chips state no position in the set — ${read!.inView} are in ` +
        `view, so a person using a screen reader is told neither where they are nor that there is more. ` +
        `This is what ADR 0128 traded the grid's scaffolding away for, and what ADR 0127's scroll ` +
        `departure is conditional on`,
    ).toEqual([]);

    // Every chip agrees about how big the set is, and each says a different place in it. A renderer
    // that wrote the same `posinset` on every chip would satisfy "present" and say nothing.
    expect(
      new Set(read!.stated.map((chip) => chip.setsize)),
      "the chips disagree about how many there are",
    ).toEqual(new Set([String(read!.total)]));

    expect(
      new Set(read!.stated.map((chip) => chip.posinset)).size,
      `the chips give ${new Set(read!.stated.map((chip) => chip.posinset)).size} distinct positions ` +
        `between ${read!.total} of them, so at least two claim the same place`,
    ).toBe(read!.total);
  });
}
