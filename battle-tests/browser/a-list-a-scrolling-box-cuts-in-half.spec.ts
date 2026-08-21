/**
 * A control's popup survives the box the page puts the control in.
 *
 * Every other spec in this directory mounts a field on a bare page, and on a bare page all three
 * renderers look correct. Put the same field inside an ordinary 120px scrolling container — the shape
 * a form takes inside a dialog, a card or a side panel — and two of the three cut their own option
 * list in half, because they draw it **inside** the field and an ancestor with `overflow` clips it.
 *
 * That is why this file exists as much as the defect is: the suite had no fixture with an ancestor in
 * it, so the failure was invisible to every check ever written, and it survived into a
 * release-candidate anatomy without once going red.
 *
 * [ADR 0130](../../docs/architecture/0130-a-popup-outlives-the-box-it-opens-from.md) settles it — a
 * popup is rendered outside the field, positioned against its trigger — and names this as the battle
 * it owes.
 *
 * The assertion is deliberately not "the popup is a child of the body". That is one way to satisfy the
 * decision and a renderer may find another; what a person cares about is that **the last option is
 * reachable**, so that is what is measured.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { ANCESTORS, HOSTS, bench, inside, open } from "./bench";

const OPTIONS = ["Roma", "Milano", "Napoli", "Torino", "Palermo"]
  .map((label) => ({ value: label.toLowerCase(), label }));

for (const host of HOSTS) {
 for (const ancestor of Object.keys(ANCESTORS) as (keyof typeof ANCESTORS)[]) {
  test(`an option list survives a ${ancestor} ancestor, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "empty", { options: OPTIONS });

    // The ancestor a bare page never has, from the bench so the next spec that needs one does not
    // build its own. 120px is smaller than the list on purpose: a scroller taller than what it holds
    // clips nothing and would make this spec green everywhere.
    const scroller = await inside(page, root, ancestor);

    await open(page, root);

    const seen = await page.evaluate((sel) => {
      const ancestorBox = document.querySelector(sel);
      const lists = Array.from(document.querySelectorAll(".mdy-multiselect__options, .mdy-multiselect-overlay__grid"))
        .filter((list) => list.getBoundingClientRect().height > 0);
      if (ancestorBox === null || lists.length === 0) return null;
      const list = lists[0]!;
      const options = Array.from(list.querySelectorAll(".mdy-chip"));
      const last = options[options.length - 1];
      if (last === undefined) return null;
      const at = last.getBoundingClientRect();

      // **Whether a person can reach it, not where its rectangle is.** A `transform` ancestor does not
      // clip anything — it only changes what `position: fixed` is fixed to — so a list whose rectangle
      // extends past that box is perfectly visible. Measuring geometry called that a defect in four
      // cases out of six, all of them mine.
      //
      // `elementFromPoint` answers the question a person asks: press here, and what gets it? A clipped
      // option is not there to be hit; an option merely hanging outside its parent's rectangle is.
      // **Brought into view first, the way a keyboard brings it.** An option list may be its own
      // scrollport — one renderer's is, 104px of 200 — and an option that has simply not been
      // scrolled to is not an option that has been taken away. Measuring before this called that a
      // clipped list, which it is not.
      last.scrollIntoView({ block: "nearest" });
      const settled = last.getBoundingClientRect();
      const centre = { x: settled.left + settled.width / 2, y: settled.top + settled.height / 2 };
      const hit = document.elementFromPoint(centre.x, centre.y);
      return {
        inside: ancestorBox.contains(list),
        options: options.length,
        onScreen: at.bottom > 0 && at.top < window.innerHeight,
        reachable: hit !== null && (hit === last || last.contains(hit) || hit.closest(".mdy-chip") === last),
        hitInstead: hit === null ? "nothing" : `${hit.tagName.toLowerCase()}.${(hit.className || "").toString().split(" ")[0]}`,
      };
    }, scroller);

    expect(seen, "the popup did not open inside the ancestor").not.toBeNull();
    // The premise: there is more list than box. Without it a renderer passes by having little to show.
    expect(seen!.options, "the list is showing too few options for anything to be cut off").toBeGreaterThan(2);
    expect(seen!.onScreen, "the last option is off the viewport, which this fixture is not about").toBe(true);

    expect(
      seen!.reachable,
      `pressing where the last of ${seen!.options} options is drawn hits ${seen!.hitInstead} instead — ` +
        `the list is drawn inside the field and a \`${ancestor}\` ancestor takes it away. A form inside ` +
        `a scrolling dialog, a card or an animated panel is the ordinary case, and a control that ` +
        `fails there passes every check written on a bare page. The three ancestors are not ` +
        `interchangeable: \`overflow\` clips, \`transform\` makes a containing block that ` +
        `\`position: fixed\` cannot escape, and \`contain\` does both`,
    ).toBe(true);
  });
 }
}
