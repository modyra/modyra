/**
 * Whether the number that says how much is not shown says how much is not shown.
 *
 * A field that holds many values draws them as a row of blocks and cannot draw them all. Where the
 * row runs out, a mark at the end reports what is missing — "+3", named to assistive technology as
 * "3 more not shown". That mark is the only account a person has of the values they cannot see: the
 * blocks themselves are past the edge, so the number is not a convenience, it is the whole statement.
 *
 * **A number that is always the same number is not a measurement.** It is drawn in the shape of one,
 * which is worse than drawing nothing: a field holding thirty values, of which one is visible, that
 * says "1 more not shown" tells a person that they have seen everything but one. Nothing else on the
 * page contradicts it. The blocks it is wrong about are exactly the blocks nobody can look at.
 *
 * The check is a relation and not a threshold, so it holds whatever the layout decides:
 *
 *     the number the mark reports  ===  the blocks not wholly inside the row
 *
 * Neither side is fixed here. How many blocks fit is the stylesheet's business and changes with the
 * width, the theme and the text size; how many are chosen is the caller's. The claim is only that the
 * two agree, which is what the mark's own words promise.
 *
 * **A block cut in half by the edge counts as not shown.** It is present and it is not readable: its
 * text is severed at whatever character the boundary fell on, and a person cannot tell a value that
 * ends there from a longer one that does not. Counting it among the shown makes the number claim that
 * nothing beyond it is missing while an unreadable thing sits in plain view, belonging to neither
 * group. Counting it among the hidden overstates by one and shows a thing twice, which is the harmless
 * direction of the same error.
 *
 * **Two premises, because this file can pass by measuring nothing.** A field whose values all fit has
 * no mark and no hidden blocks, and agrees trivially; a mount that drew no blocks agrees the same way.
 * So one arrangement must be found where the mark is present and more than one block is hidden, and
 * one where everything fits and the mark is therefore absent. Without the first, the relation is never
 * put under any pressure at all.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** Widths and value counts chosen so that some arrangements overflow and one does not. */
const ARRANGEMENTS = [
  { width: 1_280, chosen: 3 },
  { width: 1_280, chosen: 10 },
  { width: 1_280, chosen: 30 },
  { width: 640, chosen: 10 },
  { width: 400, chosen: 30 },
] as const;

const optionsFor = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: `v${index}`, label: `Opzione lunga numero ${index}` }));

/** The digits a mark carries, whatever punctuation the theme puts around them. */
const numberIn = (text: string | null): number | null => {
  if (text === null) return null;
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? null : Number(digits);
};

for (const host of HOSTS) {
  test(`the mark reports the number of values it is covering for, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const chipsClass = classOf("chips");
    const chipClass = classOf("chip");
    const overflowClass = classOf("overflowCount");
    expect(
      [chipsClass, chipClass, overflowClass].filter((one) => one === ""),
      "the contract declares no class for the row, the block or the mark, so this file cannot locate "
      + "them and a selector built from an empty string would match the whole document",
    ).toEqual([]);

    const disagreeing: string[] = [];
    let everCovering = 0;
    let everComplete = 0;

    for (const { width, chosen } of ARRANGEMENTS) {
      await page.setViewportSize({ width, height: 800 });
      const id = `count_${width}_${chosen}`;
      const options = optionsFor(chosen);

      await page.evaluate(({ api, mountId, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "m", kind: "multiselect", label: "Scelte", options,
          initialValue: (options as { value: string }[]).map((one) => one.value),
        }] as never);
      }, { api: host.api, mountId: id, options });

      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      const read = await page.evaluate(({ mountId, chips, chip, overflow }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        if (root === null) return null;
        const row = root.querySelector(`.${chips}`);
        const mark = root.querySelector(`.${overflow}`);
        const blocks = Array.from(root.querySelectorAll(`.${chip}`));
        if (row === null) return { drawn: blocks.length, hidden: null, mark: null, label: null };
        const box = row.getBoundingClientRect();
        // Wholly inside: a block the edge crosses is not readable in full, so it is not shown
        // however much of it happens to be on screen. The tolerance is a whole pixel rather than half
        // of one, because a block whose edge lands a fraction short of the row's own edge is readable,
        // and a comparison tight enough to call that a covered value manufactures the defect.
        const whole = blocks.filter((one) => {
          const at = one.getBoundingClientRect();
          return at.left >= box.left - 1 && at.right <= box.right + 1;
        }).length;
        return {
          drawn: blocks.length,
          hidden: blocks.length - whole,
          mark: mark === null ? null : (mark.textContent ?? "").trim(),
          label: mark === null ? null : mark.getAttribute("aria-label"),
        };
      }, { mountId: id, chips: chipsClass, chip: chipClass, overflow: overflowClass });

      await page.evaluate(({ api, mountId }) => {
        (window as never as Api)[api].dispose?.(mountId as never);
      }, { api: host.api, mountId: id });

      expect(read, `${host.name} mounted nothing at ${width}px`).not.toBeNull();
      expect(read!.drawn, `${host.name} drew no blocks at ${width}px, so there is nothing to count`).toBeGreaterThan(0);

      const hidden = read!.hidden ?? 0;
      const reported = numberIn(read!.mark);

      if (hidden > 1 && reported !== null) everCovering += 1;
      if (hidden === 0) everComplete += 1;

      const where = `${width}px holding ${chosen}`;
      if (hidden === 0 && read!.mark !== null && read!.mark !== "") {
        disagreeing.push(`${where}: every block is whole, and the mark still says "${read!.mark}"`);
      } else if (hidden > 0 && reported === null) {
        disagreeing.push(`${where}: ${hidden} block(s) cannot be read in full and nothing reports them`);
      } else if (reported !== null && reported !== hidden) {
        disagreeing.push(
          `${where}: the mark says "${read!.mark}"`
          + `${read!.label === null ? "" : ` (named "${read!.label}")`}`
          + ` and ${hidden} block(s) are not wholly inside the row`,
        );
      }
    }

    expect(
      everCovering,
      "no arrangement hid more than one value, so the number was never asked to be anything other "
      + "than one and this file would agree with a mark that could only ever say one",
    ).toBeGreaterThan(0);

    expect(
      everComplete,
      "every arrangement overflowed, so the case that proves the mark disappears when it has nothing "
      + "to report was never reached",
    ).toBeGreaterThan(0);

    expect(
      disagreeing,
      "the mark at the end of the row is the only account a person has of the values it covers for, "
      + `and it is not reporting them:\n  ${disagreeing.join("\n  ")}`,
    ).toEqual([]);
  });
}
