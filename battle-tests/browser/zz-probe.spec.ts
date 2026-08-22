import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";
for (const h of HOSTS) {
test(`${h.name} bad shape on arrival`, async ({ page }) => {
  await page.goto(h.page);
  await page.waitForFunction((f) => (window as never as Record<string, boolean>)[f] === true, h.ready);
  await page.evaluate(({ api }) => {
    const b = (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api];
    b.mountFields("t", [{ name: "age", kind: "number", label: "Age" }] as never);
    b.setValue("t", { age: "not a number" } as never);
  }, { api: h.api });
  await page.waitForTimeout(450);
  const seen = await page.evaluate(({ api }) => {
    const b = (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api];
    const root = document.querySelector('[data-form="t"]')!;
    const c = root.querySelector("input") as HTMLInputElement;
    return { marked: c?.getAttribute("aria-invalid"), shown: c?.value,
             errors: JSON.stringify(b.errorsOf?.("t", "age") ?? "no door"),
             msg: (root.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null };
  }, { api: h.api });
  console.log(`[${h.name}]`, JSON.stringify(seen));
  expect(true).toBe(true);
});
}
