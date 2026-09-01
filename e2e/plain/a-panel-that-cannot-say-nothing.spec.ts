import { expect, test } from "@playwright/test";

/**
 * The inspection table, drawn from a real widget.
 *
 * ADR 0188's claim is that a reader can tell "this is empty" from "nobody looked". The check is that
 * both appear in one table and neither is blank — a panel where an unread rendered as an empty cell
 * would pass every test about the values it *did* read.
 */
test("every row says something, including the ones with no value", async ({ page }) => {
  await page.goto("/lab.html#contracts");
  const table = page.locator("[data-inspection] table");
  await expect(table).toBeVisible();

  const cells = table.locator("td");
  const count = await cells.count();
  expect(count).toBeGreaterThan(6);

  for (let at = 0; at < count; at += 1) {
    const text = (await cells.nth(at).textContent()) ?? "";
    expect(text.trim(), `cell ${at} was blank, which reads as an absent value`).not.toBe("");
  }
});

test("a probe with nothing to read says so, beside one that read something", async ({ page }) => {
  await page.goto("/lab.html#contracts");
  const table = page.locator("[data-inspection] table");
  await expect(table).toBeVisible();

  // The row deliberately pointed at a part the renderer does not draw.
  await expect(table.getByText("a part nobody probes")).toBeVisible();
  await expect(table.getByText(/not read/).first()).toBeVisible();

  // And a row that did read something, so the two are visible together rather than in two runs.
  await expect(table.getByText("control id")).toBeVisible();
  const idRow = table.locator("tr", { has: page.getByText("control id") });
  await expect(idRow.locator("td").nth(1)).not.toHaveText(/not read/);
});
