/**
 * The five overlay kinds, taken out of play two different ways.
 *
 * A field that leaves play takes its overlay with it: `closeOverlayWhenOutOfPlay` is the controllers'
 * half, and ADR 0093 draws the line at **`blocksFocus`** — disabled blocks focus, readonly does not.
 * A readonly field is one a person may still read, and closing its popup would take away a value they
 * are entitled to see.
 *
 * So both directions are asserted in one file, and that is the point of it. A repair that closed the
 * overlay on any state that is not `enabled` would satisfy the first half and break the second, and a
 * file holding only the first would go green on it.
 *
 *     disable    datepicker daterange timepicker multiselect colors   → no panel, aria-expanded false
 *     readonly   the same five                                        → the panel stays, still true
 *
 * Five kinds rather than one, because the defect this replaces was **one cause across five
 * renderers**: the Lit elements painted from an `_open` of their own, written only in response to a
 * gesture, and leaving play is not a gesture. The battle that found it measured a datepicker; the
 * other four had the same hole and were closed with it. A guard that watches one of five is a guard
 * that reports one fifth of the next regression.
 *
 * Colors and timepicker carry two openers and the first is not the one that opens, so the popup is
 * reached by trying each button until a panel with a height appears — the same way a person does.
 *
 * Claims under attack: UI-005, VAL-002, A11Y-004.
 */

import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const KINDS = ["datepicker", "daterange", "timepicker", "multiselect", "colors"] as const;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

const settled = async (page: Page) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
};

/** Open the popup however this kind offers it, and report whether one is on screen. */
async function openPopup(page: Page, id: string): Promise<boolean> {
  const buttons = page.locator(`[data-form="${id}"] button`);
  const count = await buttons.count();
  for (let at = 0; at < count; at += 1) {
    await buttons.nth(at).click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(200);
    if (await panelsOn(page) > 0) return true;
  }
  return false;
}

/** Panels with a height: an element that is present and collapsed is not an open popup. */
function panelsOn(page: Page): Promise<number> {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mdy-overlay, [role='dialog'], [role='listbox'], [role='grid']")]
      .filter((each) => (each as HTMLElement).getBoundingClientRect().height > 0).length);
}

const expandedOn = (page: Page, id: string) =>
  page.evaluate((mountId) => {
    const host = document.querySelector(`[data-form="${mountId}"]`);
    const opener = host?.querySelector("[aria-expanded]");
    return opener?.getAttribute("aria-expanded") ?? null;
  }, id);

test("a field taken out of play takes its popup, and a readonly one keeps it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);

  const closed: string[] = [];
  const kept: string[] = [];

  for (const kind of KINDS) {
    for (const how of ["disable", "readonly"] as const) {
      const id = `${kind}-${how}`;
      await page.evaluate(({ id, kind, options }) => {
        const host = (window as never as Record<string, Record<string, (...a: unknown[]) => unknown>>).battleLit;
        host.mountFields(id, [{ name: "v", kind, label: "V", options }] as never);
      }, { id, kind, options: OPTIONS });
      await settled(page);

      const opened = await openPopup(page, id);
      expect(opened, `no popup opened for ${kind}, so taking it out of play measures nothing`).toBe(true);

      await page.evaluate(({ id, how }) => {
        const host = (window as never as Record<string, Record<string, (...a: unknown[]) => unknown>>).battleLit;
        host[how](id, "v");
      }, { id, how });
      await page.waitForTimeout(300);

      const panels = await panelsOn(page);
      const expanded = await expandedOn(page, id);
      if (how === "disable" && (panels > 0 || expanded === "true")) {
        closed.push(`${kind}: disabled and the popup is still there (panels ${panels}, aria-expanded ${expanded})`);
      }
      if (how === "readonly" && panels === 0) {
        kept.push(`${kind}: readonly closed the popup, taking away a value the person may still read`);
      }

      await page.evaluate((id) => {
        const host = (window as never as Record<string, Record<string, (...a: unknown[]) => unknown>>).battleLit;
        host.dispose?.(id);
      }, id);
      await settled(page);
    }
  }

  expect(closed, closed.join("\n")).toEqual([]);
  expect(kept, kept.join("\n")).toEqual([]);
});
