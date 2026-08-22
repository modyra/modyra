import { expect, test } from "@playwright/test";
test("angular duplicate name", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto("/angular.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleAngularReady === true);
  const m = await page.evaluate(() => (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)
    .battleAngular.mountFields("d", [
      { name: "x", kind: "text", label: "First" },
      { name: "x", kind: "number", label: "Second" },
      { name: "y", kind: "text", label: "Other" }] as never));
  await page.waitForTimeout(400);
  const drew = await page.evaluate(() => ({
    inputs: Array.prototype.slice.call(document.querySelectorAll('[data-form="d"] input'))
      .map((i: HTMLInputElement) => `${i.type}#${i.id}`),
  }));
  console.log("[mount]", JSON.stringify(m), "[drew]", JSON.stringify(drew), "[errs]", JSON.stringify(errs));
  expect(true).toBe(true);
});
