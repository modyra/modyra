import { expect, test } from "@playwright/test";

/**
 * The Plain renderer's lifecycle, in a real browser, through its published entry point.
 *
 * Claims under attack: A11Y-001 (partial and late rendering never leaves a dangling id reference
 * after settling), COL-001 and COL-006 (a control neither creates nor keeps a row, and goes back to
 * waiting when the row leaves), LIF-001 (teardown leaves nothing behind).
 *
 * Every assertion reads the DOM the browser built. `page.evaluate` only drives the host's own
 * public operations — mount, declare, remove, dispose — and reads back what a screen reader would
 * have to resolve.
 */

const settled = async (page: import("@playwright/test").Page) => {
  // Two frames: the renderer's own settle beat, then the one that would show its consequence.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("the dangling-reference check reports one when there is one", async ({ page }) => {
  // A check nobody has watched fail is only a claim: the assertions below rest on this probe, so it
  // is shown catching exactly what it is there to catch.
  const found = await page.evaluate(() => {
    const control = document.createElement("input");
    control.setAttribute("aria-describedby", "nothing-points-here");
    document.querySelector("#stage")!.append(control);
    const dangling = window.battle.danglingReferences();
    control.remove();
    return dangling;
  });
  expect(found).toEqual(['input[aria-describedby="nothing-points-here"]']);
  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);
});

test("a row removed under a focused control leaves no dangling reference", async ({ page }) => {
  await page.evaluate(() => window.battle.mount("main", { key: "a" }));
  await settled(page);

  const input = page.locator('[data-form="main"] input').first();
  await input.click();
  await input.fill("typed");
  await settled(page);

  expect(await page.evaluate(() => window.battle.valueOf("main"))).toMatchObject({
    rows: { a: { code: "typed" } },
  });
  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);

  // The row goes while its control has focus.
  await page.evaluate(() => window.battle.removeRow("main", "a"));
  await settled(page);

  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);
  expect(await page.evaluate(() => window.battle.duplicateIds())).toEqual([]);
  expect(await page.evaluate(() => window.battle.valueOf("main"))).toEqual({ rows: {} });

  // Focus is somewhere real: never on an element the removal detached.
  const focus = await page.evaluate(() => window.battle.focusState());
  expect(focus.connected).toBe(true);
});

test("a control waits for its row and binds again when it returns", async ({ page }) => {
  await page.evaluate(() => window.battle.mount("main", { key: "a" }));
  await settled(page);
  const controlsWhileDeclared = await page.evaluate(() => window.battle.controlCount());

  await page.evaluate(() => window.battle.removeRow("main", "a"));
  await settled(page);
  expect(await page.evaluate(() => window.battle.controlCount())).toBe(controlsWhileDeclared);

  await page.evaluate(() => window.battle.declareRow("main", "a", { code: "back", note: "", plan: "pro" }));
  await settled(page);

  await expect(page.locator('[data-form="main"] input').first()).toHaveValue("back");
  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);
});

test("two forms over the same names keep their relationships apart when scoped", async ({ page }) => {
  await page.evaluate(() => {
    window.battle.mount("first", { key: "a", idPrefix: "first" });
    window.battle.mount("second", { key: "a", idPrefix: "second" });
  });
  await settled(page);

  expect(await page.evaluate(() => window.battle.duplicateIds())).toEqual([]);

  // A label in the second form resolves to a control inside the second form.
  const resolvesWithinOwnForm = await page.evaluate(() => {
    const label = document.querySelector('[data-form="second"] label') as HTMLLabelElement | null;
    const target = label ? document.getElementById(label.htmlFor) : null;
    const owner = target?.closest("[data-form]") as HTMLElement | null;
    return owner?.dataset.form ?? null;
  });
  expect(resolvesWithinOwnForm).toBe("second");

  // Tearing one down leaves the other's references intact.
  await page.evaluate(() => window.battle.dispose("first"));
  await settled(page);
  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);
});

test("disposing a form clears its DOM and leaves focus somewhere real", async ({ page }) => {
  await page.evaluate(() => window.battle.mount("main", { key: "a" }));
  await settled(page);
  await page.locator('[data-form="main"] input').first().click();

  await page.evaluate(() => window.battle.dispose("main"));
  await settled(page);

  expect(await page.evaluate(() => window.battle.controlCount())).toBe(0);
  expect(await page.evaluate(() => window.battle.danglingReferences())).toEqual([]);
  const focus = await page.evaluate(() => window.battle.focusState());
  expect(focus.connected).toBe(true);
});

declare global {
  interface Window {
    battle: {
      mount(id: string, options?: { key?: string; idPrefix?: string }): string;
      removeRow(id: string, key: string): void;
      declareRow(id: string, key: string, value: Record<string, unknown>): void;
      valueOf(id: string): Record<string, unknown>;
      dispose(id: string): void;
      danglingReferences(): string[];
      duplicateIds(): string[];
      focusState(): { tag: string | null; id: string | null; connected: boolean; isBody: boolean };
      controlCount(): number;
    };
  }
}
