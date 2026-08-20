/**
 * A control a user cannot reach, because it is inside one they can.
 *
 * The auditor spec catches this and reports it as `nested-interactive`, critical, inside a blob of
 * JSON with everything else it found. This says what it is: a colour field builds a native colour
 * input **inside** a button.
 *
 * Nesting one interactive element in another is not a styling detail. The outer element takes the
 * click, so the inner one is reachable only by accident; a screen reader in browse mode announces the
 * button and never offers the input; the accessible name of the outer swallows whatever the inner
 * would have said; and the tab order depends on which of them the browser decides is focusable, which
 * differs by browser.
 *
 * A colour field is exactly where it matters, because the native input is the thing that opens the
 * platform's own colour picker — the one route a user has to a colour that is not one of the presets.
 *
 * The check is deliberately about *any* control inside another rather than about this one
 * construction: it is the rule that is worth keeping, and the same mistake in another kind should
 * fail the same test.
 *
 * Claims under attack: A11Y-004, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Everything a user can click into or tab to. */
const INTERACTIVE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="textbox"]',
].join(",");

for (const host of HOSTS) {
  test(`no control sits inside another control, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const nested: string[] = [];
    let looked = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `n-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(200);

      const found = await page.evaluate(({ sel, interactive }) => {
        const root = document.querySelector(sel);
        if (root === null) return { controls: 0, pairs: [] as string[] };
        const controls = Array.from(root.querySelectorAll(interactive));
        const pairs: string[] = [];
        for (const outer of controls) {
          for (const inner of Array.from(outer.querySelectorAll(interactive))) {
            const name = (element: Element) =>
              `${element.tagName.toLowerCase()}${element instanceof HTMLInputElement ? `[${element.type}]` : ""}.${(element.getAttribute("class") ?? "").split(" ")[0]}`;
            pairs.push(`${name(outer)} > ${name(inner)}`);
          }
        }
        return { controls: controls.length, pairs: [...new Set(pairs)] };
      }, { sel: `[data-form="${id}"]`, interactive: INTERACTIVE });

      looked += found.controls;
      nested.push(...found.pairs.map((each) => `${kind}: ${each}`));

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(60);
    }

    // The control: controls were found at all. A run that rendered nothing interactive would report
    // no nesting and mean nothing by it.
    expect(looked, "no control was found on any kind, so nothing was examined").toBeGreaterThan(MDY_WIDGET_KINDS.length);

    expect(nested, "a control sits inside another control, so the inner one is reachable only by accident").toEqual([]);
  });
}
