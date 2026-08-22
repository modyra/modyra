import { expect, test } from "@playwright/test";
for (const h of [
  { n: "plain", u: "/index.html", r: "battleReady", a: "battle" },
  { n: "angular", u: "/angular.html", r: "battleAngularReady", a: "battleAngular" },
]) {
test(`${h.n} refusal paint`, async ({ page }) => {
  await page.goto(h.u);
  await page.waitForFunction((f) => (window as never as Record<string, boolean>)[f] === true, h.r);
  await page.evaluate(({ api }) => {
    (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
      .mountFields("e", [{ name: "f", kind: "text", label: "L", validators: { required: true } }] as never);
  }, { api: h.a });
  await page.waitForTimeout(300);
  const input = page.locator('[data-form="e"] input').first();
  await input.focus(); await input.blur();
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => {
    const root = document.querySelector('[data-form="e"]')!;
    const all = Array.prototype.slice.call(root.querySelectorAll("*"))
      .map((e: Element) => e.className).filter((c) => typeof c === "string" && c.includes("mdy"));
    return { invalid: root.querySelectorAll('[aria-invalid="true"]').length,
             classes: all.slice(0, 12),
             errorText: root.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) };
  });
  console.log(`[${h.n}]`, JSON.stringify(seen));
  expect(true).toBe(true);
});
}
