/**
 * What a closed widget still puts in the page.
 *
 * A popup that is closed is closed for everyone. Painting it off-screen while leaving it in the tab
 * order, or in the accessibility tree, closes it only for the person looking at it — a keyboard user
 * tabs into a calendar that is not open, and a screen reader in browse mode walks a month of
 * gridcells belonging to a field nobody has touched.
 *
 * The two renderers do it differently. Lit builds a popup when it opens one. Plain keeps the popup in
 * the document and hides it visually, and for two kinds the hiding does not reach either tree:
 *
 *     plain, datepicker, aria-expanded="false"   1 tabbable, 42 announced gridcells
 *     plain, colors,     aria-expanded="false"   8 tabbable, 8 announced options
 *
 * The same renderer gets it right for `select`, `multiselect` and `timepicker`, which is what makes
 * this two kinds rather than a strategy.
 *
 * The invariant has two sides so that neither way of getting it wrong passes: while closed, a
 * widget's popup contributes nothing to either tree; once opened, it contributes something. A
 * renderer that never built a popup at all would satisfy the first and fail the second.
 *
 * The second test is the same defect as a person meets it: tab from the field above a closed widget
 * and count how many presses it takes to reach the field below. Past a closed date range in plain it
 * is more than sixty, and the field below is never reached.
 *
 * "Reachable" means what a browser and an assistive technology agree on: not `display:none`, not
 * `visibility:hidden`, not `hidden`, and not underneath an `aria-hidden="true"`. A popup hidden by
 * any of those is out of both trees and is not what this spec is about.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Kinds that declare a popup in the widget contract. */
const KINDS = ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"];

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** What a popup contributes to the two trees a person can reach it through. */
const contribution = (page: import("@playwright/test").Page, scope: string) => page.evaluate((selector) => {
  const root = document.querySelector(selector);
  if (root === null) return null;
  const popups = Array.from(root.querySelectorAll(
    ".mdy-popup, [class*='__popup'], [class*='__dropdown'], [role='grid'], [role='listbox'], [role='dialog']",
  ));
  const reachable = popups.filter((element) => {
    const style = getComputedStyle(element as HTMLElement);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if ((element as HTMLElement).hidden) return false;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      if (node.getAttribute("aria-hidden") === "true") return false;
    }
    return true;
  });
  const inside = reachable.flatMap((element) => Array.from(element.querySelectorAll("*")));
  const tabbable = inside.filter((element) => {
    const index = element.getAttribute("tabindex");
    if (index !== null) return Number(index) >= 0;
    return /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(element.tagName)
      && !(element as HTMLInputElement).disabled;
  });
  const announced = inside.filter((element) => {
    const role = element.getAttribute("role");
    return role === "gridcell" || role === "option";
  });
  return {
    tabbable: tabbable.length,
    announced: announced.length,
    expanded: root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? null,
  };
}, scope);

for (const host of HOSTS) {
  test(`${host.name}: a closed popup is closed for everyone`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const leaking: Array<Record<string, unknown>> = [];
    const neverOpened: string[] = [];
    let opened = 0;

    for (const kind of KINDS) {
      const id = `c-${kind}`;
      await page.evaluate(
        ({ api, mountId, k, options }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
          const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
          if (/select/.test(k)) field.options = options;
          battle.mountFields(mountId, [field]);
        },
        { api: host.api, mountId: id, k: kind, options: OPTIONS },
      );
      await page.waitForTimeout(130);
      const scope = `[data-form="${id}"]`;

      const closed = await contribution(page, scope);
      if (closed === null) { neverOpened.push(`${kind}: nothing mounted`); continue; }
      if (closed.expanded === "true") { neverOpened.push(`${kind}: mounted already open`); continue; }
      if (closed.tabbable > 0 || closed.announced > 0) {
        leaking.push({ kind, ...closed });
      }

      // The other side: opened, it must contribute something, or the check above is satisfied by a
      // renderer that builds no popup at all.
      const toggle = page.locator(`${scope} button`).first();
      if (await toggle.count() === 0) { neverOpened.push(`${kind}: no control opens it`); continue; }
      await toggle.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(220);
      const open = await contribution(page, scope);
      if (open === null || open.expanded !== "true") { neverOpened.push(`${kind}: did not open`); continue; }
      if (open.tabbable + open.announced > 0) opened += 1;
      else neverOpened.push(`${kind}: opened and still contributes nothing`);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
    }

    console.log(`[${host.name}] opened-and-populated ${opened}, leaking ${leaking.length}, skipped ${neverOpened.length}`);
    if (neverOpened.length > 0) console.log(`[${host.name}] skipped: ${JSON.stringify(neverOpened)}`);

    // The control: at least some of these widgets really do put something in the trees when open,
    // so an empty leak list is a closed popup being closed rather than a popup that never exists.
    expect(opened, JSON.stringify({ opened, neverOpened })).toBeGreaterThan(0);

    expect(leaking, JSON.stringify({ opened, leaking }, null, 1)).toEqual([]);
  });
}

/** How many stops a compound widget may reasonably cost: its own inputs and its toggle. */
const REASONABLE_STOPS = 8;

for (const host of HOSTS) {
  test(`${host.name}: tabbing past a closed widget reaches the next field`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const trapped: Array<Record<string, unknown>> = [];
    const walked: Array<Record<string, unknown>> = [];

    for (const kind of ["text", ...KINDS]) {
      // One form holding all three, so the middle field really is between the other two. Mounting
      // them as three forms left the walk reaching the last in the same four stops whatever was in
      // the middle — the tell being that an ordinary text field cost exactly as much as a calendar.
      const id = `walk-${kind}`;
      await page.evaluate(
        ({ api, k, mountId, options }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
          const middle: Record<string, unknown> = { name: "m", kind: k, label: `L ${k}` };
          if (/select/.test(k)) middle.options = options;
          battle.mountFields(mountId, [
            { name: "before", kind: "text", label: "Before" },
            middle,
            { name: "after", kind: "text", label: "After" },
          ]);
        },
        { api: host.api, k: kind, mountId: id, options: OPTIONS },
      );
      await page.waitForTimeout(200);

      const start = page.locator(`[data-form="${id}"] input[name="before"], [data-form="${id}"] input`).first();
      if (await start.count() === 0) continue;
      await start.focus();

      let stops = 0;
      let reached = false;
      for (; stops < 40 && !reached; stops += 1) {
        await page.keyboard.press("Tab");
        // "Past it" in document order rather than by name: which attribute carries a field's
        // identity is a renderer's business, and reading one made this walk report that lit never
        // reached the next field even with an ordinary text field in the middle.
        reached = await page.evaluate(({ selector, middleLabel }) => {
          const root = document.querySelector(`[data-form="${selector}"]`);
          const active = document.activeElement;
          if (root === null || active === null) return false;
          const middle = Array.from(root.querySelectorAll("*"))
            .find((element) => element.tagName === "LABEL" && element.textContent?.includes(middleLabel))
            ?.closest("*[class]")?.parentElement ?? null;
          if (middle === null || middle.contains(active)) return false;
          return (middle.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }, { selector: id, middleLabel: `L ${kind}` });
      }

      // `text` in the middle is the control: an ordinary field costs a stop or two, so a large count
      // below is the widget rather than the walk.
      walked.push({ kind, stops, reached });
      if (!reached || stops > REASONABLE_STOPS) {
        trapped.push({ kind, stops, reachedTheNextField: reached });
      }
    }

    console.log(`[${host.name}] walk: ${JSON.stringify(walked)}`);

    const control = trapped.find((row) => row.kind === "text");
    expect(control, "an ordinary text field in the middle already costs too many stops, so this walk measures itself")
      .toBeUndefined();

    expect(trapped, JSON.stringify(trapped, null, 1)).toEqual([]);
  });
}
