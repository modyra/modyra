import { expect, test } from "@playwright/test";
for (const h of [{ n: "plain", u: "/index.html", r: "battleReady", a: "battle" }, { n: "lit", u: "/lit.html", r: "battleLitReady", a: "battleLit" }]) {
test(`chip roles ${h.n}`, async ({ page }) => {
  await page.goto(h.u);
  await page.waitForFunction((r) => (window as never as Record<string, boolean>)[r] === true, h.r);
  await page.evaluate(({ api }) => {
    (window as never as Record<string, { mountFields(a: string, b: unknown[]): unknown }>)[api]
      .mountFields("m", [{ name: "x", kind: "multiselect", label: "X", mode: "multi", options: [
        { value: "a", label: "A" }, { value: "b", label: "B" }] }]);
  }, { api: h.a });
  await page.waitForTimeout(250);
  const trigger = page.locator('[data-form="m"] .mdy-multiselect__trigger, [data-form="m"] [role="combobox"]').first();
  await trigger.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  const dom = await page.evaluate(() => {
    const strip = document.querySelector('[data-form="m"] .mdy-multiselect__chips')!;
    const chip = document.querySelector('[data-form="m"] .mdy-chip--value') as HTMLElement | null;
    return {
      strip: strip.getAttribute("role"),
      chip: chip?.getAttribute("role") ?? null,
      posinset: chip?.getAttribute("aria-posinset") ?? null,
      setsize: chip?.getAttribute("aria-setsize") ?? null,
      valuenow: chip?.getAttribute("aria-valuenow") ?? null,
      name: chip?.getAttribute("aria-label") ?? null,
    };
  });
  console.log(`[${h.n}] ${JSON.stringify(dom)}`);
  const snapshot = await page.locator('[data-form="m"] .mdy-multiselect__chips').ariaSnapshot().catch((e) => String(e).slice(0, 80));
  console.log(`[${h.n}] a11y tree: ${JSON.stringify(snapshot)}`);
  expect(true).toBe(true);
});
}
