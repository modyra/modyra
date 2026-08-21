import { test } from "@playwright/test";
for (const h of [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
]) {
  test(`multiselect keyboard, ${h.name}`, async ({ page }) => {
    await page.goto(h.page);
    await page.waitForFunction((f) => (window as never as Record<string, boolean>)[f] === true, h.ready);
    await page.evaluate(async ({ api }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("m", [{ name: "s", kind: "multiselect", label: "S",
          options: ["a","b","c","d"].map(v => ({ value: v, label: v.toUpperCase() })) }]);
    }, { api: h.api });
    await page.waitForTimeout(350);
    const held = () => page.evaluate(({ api }) => (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("m")?.s ?? null, { api: h.api });
    const where = () => page.evaluate(() => { const a = document.activeElement as HTMLElement | null;
      return a && a !== document.body ? (a.tagName.toLowerCase() + "." + String(a.className).split(" ")[0]).slice(0, 30) : "body"; });
    const out: string[] = [];
    // open from the keyboard, the way the contract says
    const opener = page.locator('[data-form="m"] .mdy-multiselect__search-btn, [data-form="m"] [aria-haspopup]').first();
    await opener.focus();
    out.push(`focusedOpener=${await where()}`);
    await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    out.push(`afterEnter expanded=${await page.locator('[data-form="m"] [aria-expanded="true"]').count()} focus=${await where()}`);
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(180);
    out.push(`afterDown focus=${await where()}`);
    await page.keyboard.press("Enter"); await page.waitForTimeout(220);
    out.push(`afterPickEnter held=${JSON.stringify(await held())}`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(220);
    out.push(`afterEsc expanded=${await page.locator('[data-form="m"] [aria-expanded="true"]').count()} focus=${await where()}`);
    console.log(`PROBE ${h.name}\n   ${out.join("\n   ")}`);
  });
}
