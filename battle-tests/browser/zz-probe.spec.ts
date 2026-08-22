import { expect, test } from "@playwright/test";
test("array collection through plain's mount", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
  const mounted = await page.evaluate(() => {
    const fields = [0, 1, 2].map((i) => ({ name: `rows.${i}.code`, kind: "text", label: `Code ${i}` }));
    return (window as never as { battle: { mountFields(a: string, b: unknown[], c: unknown): unknown } })
      .battle.mountFields("arr", fields, { collections: [{ path: "rows", kind: "array" }] });
  });
  await page.waitForTimeout(250);
  const read = await page.evaluate(() => ({
    value: (window as never as { battle: { valueOf(i: string): unknown } }).battle.valueOf("arr"),
    inputs: document.querySelectorAll('[data-form="arr"] input').length,
  }));
  console.log("mounted:", JSON.stringify(mounted), "read:", JSON.stringify(read));
  const inputs = page.locator('[data-form="arr"] input');
  for (let i = 0; i < 3; i += 1) { await inputs.nth(i).fill(`v${i}`); await page.waitForTimeout(60); }
  console.log("typed:", JSON.stringify(await page.evaluate(() => (window as never as { battle: { valueOf(i: string): unknown } }).battle.valueOf("arr"))));
  await page.evaluate(() => (window as never as { battle: { removeRow(i: string, k: string): void } }).battle.removeRow("arr", "1"));
  await page.waitForTimeout(200);
  await page.evaluate(() => (window as never as { battle: { submit(i: string): Promise<unknown> } }).battle.submit("arr"));
  await page.waitForTimeout(250);
  console.log("submitted:", JSON.stringify(await page.evaluate(() => (window as never as { battle: { submittedBy(i: string): unknown[] } }).battle.submittedBy("arr"))));
  console.log("after removeRow(1):", JSON.stringify(await page.evaluate(() => (window as never as { battle: { valueOf(i: string): unknown } }).battle.valueOf("arr"))));
  expect(true).toBe(true);
});
