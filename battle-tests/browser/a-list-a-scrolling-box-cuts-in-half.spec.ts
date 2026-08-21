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
import { HOSTS, bench, open } from "./bench";

const OPTIONS = ["Roma", "Milano", "Napoli", "Torino", "Palermo"]
  .map((label) => ({ value: label.toLowerCase(), label }));

for (const host of HOSTS) {
  test(`an option list is not cut off by a scrolling ancestor, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "empty", { options: OPTIONS });

    // The ancestor a bare page never has. 120px is smaller than the list, on purpose: a scroller
    // taller than what it holds clips nothing and would make this spec green everywhere.
    await page.evaluate((sel) => {
      const field = document.querySelector(sel) as HTMLElement;
      const scroller = document.createElement("div");
      scroller.dataset.scroller = "yes";
      scroller.style.cssText = "height:120px;overflow:auto;width:420px";
      field.parentElement?.insertBefore(scroller, field);
      scroller.appendChild(field);
    }, root);
    await page.waitForTimeout(200);

    await open(page, root);

    const seen = await page.evaluate(() => {
      const scroller = document.querySelector('[data-scroller="yes"]');
      const lists = Array.from(document.querySelectorAll(".mdy-multiselect__options, .mdy-multiselect-overlay__grid"))
        .filter((list) => list.getBoundingClientRect().height > 0);
      if (scroller === null || lists.length === 0) return null;
      const list = lists[0]!;
      const box = list.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      const options = Array.from(list.querySelectorAll(".mdy-chip"));
      const last = options[options.length - 1]?.getBoundingClientRect();
      return {
        inside: scroller.contains(list),
        options: options.length,
        // How much of the list is below the box that would clip it, when the box is its ancestor.
        hiddenBelow: scroller.contains(list) ? Math.round(Math.max(0, box.bottom - bounds.bottom)) : 0,
        lastOptionReachable: last === undefined ? false
          : !scroller.contains(list) || last.bottom <= bounds.bottom + 1,
      };
    });

    expect(seen, "the popup did not open inside a scrolling container").not.toBeNull();
    // The premise: there is more list than box. Without it a renderer passes by having little to show.
    expect(seen!.options, "the list is showing too few options for the box to clip anything").toBeGreaterThan(2);

    expect(
      seen!.lastOptionReachable,
      `the option list is drawn inside the field, and the field's scrolling ancestor cuts ` +
        `${seen!.hiddenBelow}px off the bottom of it — the last of ${seen!.options} options cannot be ` +
        `reached. A form inside a scrolling dialog or a card is the ordinary case, and a control that ` +
        `fails there passes every check written on a bare page`,
    ).toBe(true);
  });
}
