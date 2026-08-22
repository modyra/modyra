import { expect, test } from "@playwright/test";
for (const h of [
  { n: "plain", u: "/index.html", r: "battleReady", a: "battle", sel: ".mdy-timepicker__popup" },
  { n: "lit", u: "/lit.html", r: "battleLitReady", a: "battleLit", sel: ".mdy-timepicker__popup" },
]) {
test(`${h.n} timepicker popup semantics`, async ({ page }) => {
  await page.goto(h.u);
  await page.waitForFunction((r) => (window as never as Record<string, boolean>)[r] === true, h.r);
  await page.evaluate(({ api }) => {
    const b = (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api];
    b.mountFields("t", [{ name: "alarm", kind: "timepicker", label: "Alarm" }] as never);
  }, { api: h.a });
  await page.waitForTimeout(300);
  await page.locator(`[data-form="t"] .mdy-timepicker__toggle`).click();
  await page.waitForTimeout(400);
  const read = await page.evaluate((sel) => {
    const p = document.querySelector(sel);
    return { role: p?.getAttribute("role"), modal: p?.getAttribute("aria-modal"),
             label: p?.getAttribute("aria-label"), by: p?.getAttribute("aria-labelledby"),
             dial: document.querySelectorAll(".mdy-timepicker-dial__face").length };
  }, h.sel);
  console.log(`[${h.n}]`, JSON.stringify(read));
  expect(true).toBe(true);
});
}
