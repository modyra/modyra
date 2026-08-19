/**
 * The overlay an opener says it controls.
 *
 * `@modyra/widgets` does not only describe the ARIA a popup opener carries — it *computes* it.
 * `projectOverlayOpenerA11y(kind, options)` returns the role and the attributes, derived from
 * `MDY_POPUP_OPENERS`, and its own comment states why `aria-controls` is one of them in both states:
 * an opener that drops it while closed reads as a control with no overlay at all.
 *
 * That projection is published and was named by nothing in this suite. It is the closest thing the
 * contract has to a reference implementation of a widget's accessibility, so a renderer can be
 * asked, per kind, whether the element it built carries what the projection says it must.
 *
 * `aria-controls` is the one that matters to a person rather than to a checklist. It is how a screen
 * reader offers to move from the control to the thing it opened. Without it the calendar, the option
 * list and the dial are reachable only by guessing that they exist.
 *
 * Ids are not compared across renderers — they are generated, and one renderer's `x__grid` is
 * another's `mdy-field-2__grid`. What is compared is the suffix the projection derives from
 * `MDY_POPUP_OPENERS[kind].controls`, and whether the id resolves to an element on the page.
 *
 * Claims under attack: A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, projectOverlayOpenerA11y } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

const KINDS = Object.keys(MDY_POPUP_OPENERS);
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`an opener names the overlay it opens, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares an overlay opener").toBeGreaterThan(0);

    const missingWhileClosed: string[] = [];
    const missingWhileOpen: string[] = [];
    const wrongRole: string[] = [];
    const dangling: string[] = [];

    for (const kind of KINDS) {
      const id = `a-${kind}`;
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(280);

      const read = () => page.evaluate((sel) => {
        const opener = document.querySelector(`${sel} [aria-expanded]`);
        if (opener === null) return null;
        const controls = opener.getAttribute("aria-controls");
        return {
          role: opener.getAttribute("role"),
          expanded: opener.getAttribute("aria-expanded"),
          controls,
          resolves: controls === null ? false : document.getElementById(controls) !== null,
        };
      }, `[data-form="${id}"]`);

      const closed = await read();
      if (closed === null) {
        // A field built from a native control has no opener of its own; the browser owns the popup.
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        continue;
      }

      const projected = projectOverlayOpenerA11y(kind, { open: false, widgetId: "x" });
      const wantedSuffix = `__${MDY_POPUP_OPENERS[kind].controls}`;

      if ((projected?.role ?? null) !== closed.role) wrongRole.push(`${kind}: want ${projected?.role ?? "none"}, got ${closed.role ?? "none"}`);
      if (closed.controls === null) missingWhileClosed.push(kind);
      else if (!closed.controls.endsWith(wantedSuffix)) dangling.push(`${kind}: ${closed.controls} does not name a ${MDY_POPUP_OPENERS[kind].controls}`);

      // Open it and ask again: an overlay on screen must be named by the control that opened it.
      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(240);
        if ((await read())?.expanded === "true") break;
      }

      const open = await read();
      if (open?.expanded === "true") {
        if (open.controls === null) missingWhileOpen.push(kind);
        else if (!open.resolves) dangling.push(`${kind}: aria-controls names ${open.controls}, which is not on the page`);
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(80);
    }

    // Reported together rather than one assertion each: a renderer that fails the first would hide
    // the other three, and which of them it fails is the shape of the defect.
    expect(
      { wrongRole, dangling, missingWhileOpen, missingWhileClosed },
      "an opener does not carry what the projection says it must",
    ).toEqual({ wrongRole: [], dangling: [], missingWhileOpen: [], missingWhileClosed: [] });
  });
}
