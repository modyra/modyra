/**
 * The ids the markup points at, in the document that was actually built.
 *
 * A11Y-001 is about the DOM: "partial and late rendering never produces dangling ID references after
 * settling". Everything else in this suite has checked that one relationship at a time. This checks
 * all of them, on every declared kind, in both renderers: every token of every `aria-controls`,
 * `aria-describedby`, `aria-labelledby`, `aria-activedescendant`, `aria-owns` and `for` must name an
 * element that is on the page.
 *
 * It is worth checking at this level because the two layers above it disagree.
 * `MDY_WIDGET_RELATIONS` declares, for every kind, `control --aria-describedby--> errors +
 * supportingText`; every controller's `view()` emits `aria-describedby="<id>__description"` instead,
 * and `description` is not a part any entry of `MDY_WIDGET_CONTRACTS` declares. The renderers bridge
 * that gap themselves — lit builds the id in `base.ts`, and plain's select field carries a comment
 * saying the controller's view has no description part. Whether the bridge is complete is a question
 * about the document, not about either table, so it is asked here.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Every kind a document may declare. */
/**
 * Read from the package rather than written out here. A list of kinds copied into a spec named "every
 * kind" covers every kind only until there is a new one, and then says nothing about it while keeping
 * its name.
 */
const KINDS = [...MDY_WIDGET_KINDS];

/** The attributes whose value is one or more ids of other elements. */
const POINTERS = [
  "aria-controls", "aria-describedby", "aria-labelledby", "aria-activedescendant", "aria-owns", "for",
];

for (const host of HOSTS) {
  test(`${host.name}: every id an attribute names is an id on the page`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mounted = await page.evaluate(
      ({ api, kinds }) => {
        const battle = (window as never as Record<string, { mountFields(id: string, fields: unknown[]): { mounted: boolean } }>)[api];
        return kinds.map((kind: string) => {
          const field: Record<string, unknown> = { name: kind, kind, label: `L ${kind}` };
          if (/select|radio|segmented/.test(kind)) {
            field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
          }
          return { kind, ok: battle.mountFields(`k-${kind}`, [field]).mounted };
        });
      },
      { api: host.api, kinds: KINDS },
    );

    // The premise: something is on the page. A host that mounted nothing would report no dangling
    // references and mean nothing by it.
    const standing = mounted.filter((each) => each.ok).map((each) => each.kind);
    expect(standing.length, JSON.stringify(mounted)).toBeGreaterThan(0);

    await page.waitForTimeout(300);

    const dangling = await page.evaluate((pointers) => {
      const out: Array<{ from: string; attribute: string; missing: string }> = [];
      for (const element of Array.from(document.querySelectorAll("*"))) {
        for (const attribute of pointers) {
          const value = element.getAttribute(attribute);
          if (value === null || value.trim() === "") continue;
          // `for` on a label names one id; the aria ones may name several.
          for (const token of value.trim().split(/\s+/)) {
            if (document.getElementById(token) === null) {
              out.push({
                from: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`,
                attribute,
                missing: token,
              });
            }
          }
        }
      }
      return out;
    }, POINTERS);

    // The control: the page really does carry pointers, so an empty result above is agreement rather
    // than a page with no relationships on it at all.
    const pointerCount = await page.evaluate(
      (pointers) => Array.from(document.querySelectorAll("*"))
        .reduce((total, element) => total + pointers.filter((a) => (element.getAttribute(a) ?? "").trim() !== "").length, 0),
      POINTERS,
    );
    expect(pointerCount, "the page carries no id references at all, so nothing was checked").toBeGreaterThan(standing.length);

    expect(dangling, JSON.stringify({ kindsMounted: standing.length, pointerCount, dangling }, null, 1)).toEqual([]);
  });
}

/** The kinds whose trigger opens something the markup then points at. */
const OPENABLE = ["select", "multiselect", "datepicker", "daterange", "timepicker"];

for (const host of HOSTS) {
  test(`${host.name}: an opened widget still names ids the page has`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of OPENABLE) {
      await page.evaluate(
        ({ api, k }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, fields: unknown[]): unknown }>)[api];
          const field: Record<string, unknown> = { name: k, kind: k, label: `L ${k}` };
          if (/select/.test(k)) field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
          battle.mountFields(`o-${k}`, [field]);
        },
        { api: host.api, k: kind },
      );
      await page.waitForTimeout(120);

      // Open it the way a person does. The toggle is a button; a `[role="combobox"]` is the input
      // beside it and clicking that opens nothing, so the button is preferred rather than merely
      // included. A kind with neither — lit renders `select` as a native control — has no popup to
      // check, and is skipped rather than failed; the closed page is covered by the test above.
      const button = page.locator(`[data-form="o-${kind}"] button`).first();
      const trigger = await button.count() > 0
        ? button
        : page.locator(`[data-form="o-${kind}"] [role="combobox"]`).first();
      if (await trigger.count() === 0) continue;
      await trigger.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(250);
    }

    const dangling = await page.evaluate((pointers) => {
      const out: Array<{ from: string; attribute: string; missing: string }> = [];
      for (const element of Array.from(document.querySelectorAll("*"))) {
        for (const attribute of pointers) {
          const value = element.getAttribute(attribute);
          if (value === null || value.trim() === "") continue;
          for (const token of value.trim().split(/\s+/)) {
            if (document.getElementById(token) === null) {
              out.push({ from: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`, attribute, missing: token });
            }
          }
        }
      }
      return out;
    }, POINTERS);

    // The control: something opened. Every popup staying shut would leave nothing new to check.
    const expanded = await page.evaluate(() => document.querySelectorAll('[aria-expanded="true"]').length);
    expect(expanded, "nothing opened, so this test measured the closed page twice").toBeGreaterThan(0);

    expect(dangling, JSON.stringify({ expanded, dangling }, null, 1)).toEqual([]);
  });
}
