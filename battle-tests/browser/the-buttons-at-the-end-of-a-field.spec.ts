/**
 * The small controls a field is declared to have at its end.
 *
 * `trailingAffordances(kind)` names what sits after the value: the toggle that opens a calendar, the
 * button that opens a search, the arrow that only points, and — for a number — an `increment` and a
 * `decrement`. `kindsWithAffordances()` says which kinds have any. Both are published, and neither had
 * been named by this suite.
 *
 * Each affordance is a part of the widget contract, with classes of its own. That is what makes this
 * checkable without arguing about markup: the contract names `mdy-spin-btn`, and either the page
 * carries it or it does not.
 *
 * The shipped stylesheets carry **42 rules** for `.mdy-spin-btn` and seven each for its up and down
 * modifiers. A renderer that does not build the part leaves all of them dead, and a form's number
 * field with no steppers of its own falls back to whatever the browser draws — which is a different
 * size, a different weight, absent on touch, and not the thing the stylesheet describes.
 *
 * A kind a renderer builds from a native control is excluded by name: the browser owns that widget's
 * furniture, its arrow is drawn by the platform, and no class of ours belongs on it.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, kindsWithAffordances, trailingAffordances } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

const KINDS = kindsWithAffordances();

for (const host of HOSTS) {
  test(`a field carries the controls it is declared to have, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares anything at the end of it").toBeGreaterThan(0);

    const missing: string[] = [];
    let checked = 0;

    for (const kind of KINDS) {
      const id = `ac-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(240);

      // A field the browser draws for us has no furniture of ours to look for.
      const native = await page.evaluate((sel) => document.querySelector(`${sel} select`) !== null, `[data-form="${id}"]`);
      if (!native) {
        const wanted = trailingAffordances(kind).map((each) => ({
          part: each.part,
          classes: MDY_WIDGET_CONTRACTS[kind].parts[each.part]?.classes ?? [],
        }));

        for (const affordance of wanted) {
          // The premise: the contract gives this part classes to be found by.
          expect(affordance.classes.length, `${kind}'s ${affordance.part} has no classes to look for`).toBeGreaterThan(0);
          checked += 1;

          const present = await page.evaluate(({ sel, classes }) =>
            classes.every((each: string) => document.querySelector(`${sel} .${each}`) !== null),
            { sel: `[data-form="${id}"]`, classes: affordance.classes });

          if (!present) missing.push(`${kind}.${affordance.part} (${affordance.classes.join(" ")})`);
        }
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(70);
    }

    // The control: parts were looked for at all. A run that skipped every kind would report nothing
    // missing and mean nothing by it.
    expect(checked, "no affordance was looked for, so nothing was measured").toBeGreaterThan(3);

    expect(missing, "a field does not carry a control the contract declares at the end of it").toEqual([]);
  });
}
